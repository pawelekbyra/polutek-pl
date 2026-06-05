import { logger } from "@/lib/logger";
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { EmailService } from './email.service';
import { UserAccessService } from './user-access.service';
import { grantPatronStatus } from './patron.service';
import { writeAuditLog } from './audit.service';
import { DISPLAY_EUR_TO_PLN_RATE } from '../constants';
import { PaymentStatus, WebhookEventStatus, Prisma } from '@prisma/client';


type RefundCalculationInput = {
  amountMinor: number;
  refundedAmountMinor?: number | null;
};

export function calculateRefundAdjustment(payment: RefundCalculationInput, reportedRefundedMinor: number) {
  const previousRefunded = Math.max(0, payment.refundedAmountMinor ?? 0);
  const cappedRefunded = Math.max(0, Math.min(reportedRefundedMinor, payment.amountMinor));
  const deltaRefundMinor = Math.max(0, cappedRefunded - previousRefunded);
  const status = cappedRefunded >= payment.amountMinor
    ? PaymentStatus.REFUNDED
    : cappedRefunded > 0
      ? PaymentStatus.PARTIALLY_REFUNDED
      : undefined;

  return {
    previousRefunded,
    newRefundedAmountMinor: cappedRefunded,
    deltaRefundMinor,
    isFullRefund: cappedRefunded >= payment.amountMinor,
    status,
  };
}


export function calculateChargebackNetAdjustment(payment: RefundCalculationInput) {
  return Math.max(0, payment.amountMinor - Math.max(0, payment.refundedAmountMinor ?? 0));
}

import { normalizePaymentTotals } from './user-access.service';

function getPatronMinTipAmountMinor() {
  const raw = process.env.PATRON_MIN_TIP_AMOUNT;

  if (!raw && process.env.NODE_ENV === "production") {
    throw new Error("CRITICAL: PATRON_MIN_TIP_AMOUNT is missing in production.");
  }

  const parsed = Number(raw ?? 500);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`CRITICAL: PATRON_MIN_TIP_AMOUNT="${raw}" is not a valid positive number.`);
  }

  return Math.floor(parsed);
}

async function decrementUserNetPaymentTotals(
  tx: Prisma.TransactionClient,
  userId: string,
  currency: string,
  deltaMinor: number,
) {
  if (deltaMinor <= 0) return;

  const total = await tx.userPaymentTotal.findUnique({
    where: { userId_currency: { userId, currency } },
    select: { amountMinor: true },
  });

  if (total) {
    await tx.userPaymentTotal.update({
      where: { userId_currency: { userId, currency } },
      data: { amountMinor: Math.max(0, total.amountMinor - deltaMinor) },
    });
  }
}

export async function applyLostChargeback(
  tx: Prisma.TransactionClient,
  payment: { id: string; userId: string; currency: string; amountMinor: number; refundedAmountMinor?: number | null; status: PaymentStatus },
  disputeStatus: string,
) {
  // Conditional update using updateMany for atomicity
  const { count } = await tx.payment.updateMany({
    where: {
      id: payment.id,
      status: { not: PaymentStatus.CHARGEBACK_LOST }
    },
    data: { status: PaymentStatus.CHARGEBACK_LOST },
  });

  if (count === 0) {
    logger.info(`[PaymentService] Payment ${payment.id} already marked as CHARGEBACK_LOST or not found. Skipping adjustment.`);
    return;
  }

  await decrementUserNetPaymentTotals(
    tx,
    payment.userId,
    payment.currency,
    calculateChargebackNetAdjustment(payment),
  );

  await tx.patronGrant.updateMany({
    where: { paymentId: payment.id, revokedAt: null },
    data: { revokedAt: new Date(), reason: `Payment disputed: ${disputeStatus}` },
  });
}


function getSafeStripeEventPayload(event: Stripe.Event): Prisma.InputJsonValue {
  return {
    id: event.id,
    type: event.type,
    created: event.created,
    livemode: event.livemode,
    object: event.object,
  };
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is missing');
  }
  return new Stripe(key);
}

export class PaymentService {
  private static async getOrCreateStripeCustomer(userId: string, email: string) {
    const stripe = getStripe();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true }
    });

    if (user?.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await stripe.customers.create({
      email,
      metadata: { userId }
    });

    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id }
    });

    return customer.id;
  }

  static async createPayment({
    userId,
    amountMinor,
    currency,
    title,
    creatorId,
    requestId,
  }: {
    userId: string;
    amountMinor: number;
    currency: string;
    title: string;
    creatorId?: string;
    requestId?: string;
  }) {
    const stripe = getStripe();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    if (!user) throw new Error('USER_NOT_FOUND');

    const stripeCustomerId = await this.getOrCreateStripeCustomer(userId, user.email);

    // Deduplication check: look for an existing pending payment with the same requestId
    if (requestId) {
        // Find by metadata.requestId using Prisma JSON filter.
        const existingWithId = await prisma.payment.findFirst({
            where: {
                userId,
                status: PaymentStatus.PENDING,
                metadata: {
                    path: ['requestId'],
                    equals: requestId
                }
            }
        });

        if (existingWithId && existingWithId.stripeIntentId) {
            const intent = await stripe.paymentIntents.retrieve(existingWithId.stripeIntentId);
            return {
                id: existingWithId.id,
                clientSecret: intent.client_secret
            };
        }
    }

    const payment = await prisma.payment.create({
      data: {
        userId,
        creatorId,
        amountMinor,
        currency: currency.toUpperCase(),
        status: PaymentStatus.PENDING,
        metadata: requestId ? { requestId } : {},
      }
    });

    try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountMinor,
          currency: currency.toLowerCase(),
          customer: stripeCustomerId,
          description: title,
          metadata: {
            userId,
            paymentId: payment.id,
            requestId: requestId || null,
            ...(creatorId ? { creatorId } : {}),
          },
          automatic_payment_methods: { enabled: true },
        }, {
            idempotencyKey: requestId ? `payment-intent-${userId}-${requestId}` : undefined
        });

        await prisma.payment.update({
          where: { id: payment.id },
          data: { stripeIntentId: paymentIntent.id }
        });

        return {
            id: payment.id,
            clientSecret: paymentIntent.client_secret
        };
    } catch (error) {
        await prisma.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.FAILED }
        });
        throw error;
    }
  }

  static async handleWebhook(body: string, sig: string) {
    const stripe = getStripe();
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) throw new Error('STRIPE_WEBHOOK_SECRET is missing');

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err: unknown) {
      throw new Error(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    // Atomic idempotency check with lock
    const STRIPE_STALE_MS = 10 * 60_000;
    try {
      await prisma.stripeEvent.create({
        data: {
          id: event.id,
          type: event.type,
          status: WebhookEventStatus.PROCESSING,
          payload: getSafeStripeEventPayload(event)
        }
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        const now = new Date();
        const staleThreshold = new Date(now.getTime() - STRIPE_STALE_MS);

        const { count } = await prisma.stripeEvent.updateMany({
          where: {
            id: event.id,
            OR: [
              { status: WebhookEventStatus.FAILED },
              {
                status: WebhookEventStatus.PROCESSING,
                updatedAt: { lt: staleThreshold }
              }
            ]
          },
          data: {
            status: WebhookEventStatus.PROCESSING,
            updatedAt: now,
            error: null
          }
        });

        if (count === 0) {
          const existing = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
          if (existing?.status === WebhookEventStatus.PROCESSED) {
            logger.info(`[PaymentService] Event ${event.id} already PROCESSED.`);
          } else {
            logger.info(`[PaymentService] Event ${event.id} is being processed elsewhere.`);
          }
          return;
        }
        logger.info(`[PaymentService] Retrying failed or stale event ${event.id}.`);
      } else {
        throw e;
      }
    }

    try {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const intent = event.data.object as Stripe.PaymentIntent;
                await this.fulfillPayment(intent);
                break;
            }
            case 'charge.refunded': {
                const charge = event.data.object as Stripe.Charge;
                await this.handleRefund(charge);
                break;
            }
            case 'charge.dispute.created':
            case 'charge.dispute.closed': {
                const dispute = event.data.object as Stripe.Dispute;
                const syncData = await this.handleDispute(dispute);
                if (syncData) {
                    await UserAccessService.syncClerkAccess(syncData.userId, syncData.isPatron, syncData.normalizedTotal);
                }
                break;
            }
            case 'payment_intent.payment_failed': {
                const intent = event.data.object as Stripe.PaymentIntent;
                const { count } = await prisma.payment.updateMany({
                    where: { stripeIntentId: intent.id },
                    data: { status: PaymentStatus.FAILED }
                });
                if (count === 0) {
                    logger.warn(`[PaymentService] No payment record found for failed intent: ${intent.id}`);
                }
                break;
            }
            default:
                logger.info(`Unhandled Stripe event type: ${event.type}`);
        }

        // Mark as PROCESSED
        await prisma.stripeEvent.update({
            where: { id: event.id },
            data: {
                status: WebhookEventStatus.PROCESSED,
                processedAt: new Date()
            }
        });
    } catch (error: unknown) {
        logger.error(`[PaymentService] Error handling event ${event.id}:`, error);
        await prisma.stripeEvent.update({
            where: { id: event.id },
            data: {
                status: WebhookEventStatus.FAILED,
                error: error instanceof Error ? error.message : String(error)
            }
        });
        throw error; // Throw so Stripe can retry
    }
  }

  private static async handleRefund(charge: Stripe.Charge) {
    const paymentId = charge.metadata?.paymentId;
    const stripeIntentId = typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;

    logger.info(`[PaymentService] Handling refund. paymentId=${paymentId || 'none'}, intentId=${stripeIntentId || 'none'}`);

    const syncData = await prisma.$transaction(async (tx) => {
        const payment = paymentId
          ? await tx.payment.findUnique({ where: { id: paymentId } })
          : stripeIntentId
            ? await tx.payment.findUnique({ where: { stripeIntentId } })
            : null;

        if (!payment) return null;

        const reportedRefundedMinor = charge.amount_refunded || 0;
        const refund = calculateRefundAdjustment(payment, reportedRefundedMinor);

        if (!refund.status) return null;

        const { count } = await tx.payment.updateMany({
            where: {
                id: payment.id,
                refundedAmountMinor: payment.refundedAmountMinor ?? 0,
            },
            data: {
                refundedAmountMinor: refund.newRefundedAmountMinor,
                status: refund.status,
            }
        });

        if (count === 0) {
            logger.info(`[PaymentService] Refund for payment ${payment.id} already processed or CAS failed.`);
            return null;
        }

        await decrementUserNetPaymentTotals(tx, payment.userId, payment.currency, refund.deltaRefundMinor);

        let resultData;
        if (!refund.isFullRefund) {
            logger.info(`[PaymentService] Payment ${payment.id} partially refunded (${refund.newRefundedAmountMinor}/${payment.amountMinor}); retaining grants.`);
            const user = await tx.user.findUnique({
                where: { id: payment.userId },
                include: { paymentTotals: true },
            });
            resultData = user
                ? { userId: payment.userId, isPatron: user.isPatron, normalizedTotal: normalizePaymentTotals(user.paymentTotals) }
                : null;
        } else {
            // Revoke associated grants only after a full refund.
            await tx.patronGrant.updateMany({
                where: { paymentId: payment.id, revokedAt: null },
                data: { revokedAt: new Date(), reason: 'Payment fully refunded' }
            });

            // Recalculate status after grant revocation and total correction.
            const { isPatron, normalizedTotal } = await UserAccessService.recalculateUserPatronStatus(payment.userId, tx);
            resultData = { userId: payment.userId, isPatron, normalizedTotal };
        }

        return resultData;
    });

    if (syncData) {
        await UserAccessService.syncClerkAccess(syncData.userId, syncData.isPatron, syncData.normalizedTotal).catch(e => {
            logger.error("[PaymentService] Post-refund sync failed:", e);
        });
    }
    return syncData;
}

  private static async handleDispute(dispute: Stripe.Dispute) {
    const stripeIntentId = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id;
    if (!stripeIntentId) return;

    const payment = await prisma.payment.findUnique({ where: { stripeIntentId } });
    if (!payment) return;

    logger.info(`[PaymentService] Handling dispute (${dispute.status}) for payment ${payment.id}`);

    if (dispute.status === 'lost') {
        const syncData = await prisma.$transaction(async (tx) => {
            await applyLostChargeback(tx, payment, dispute.status);
            const { isPatron, normalizedTotal } = await UserAccessService.recalculateUserPatronStatus(payment.userId, tx);
            return { userId: payment.userId, isPatron, normalizedTotal };
        });

        if (syncData) {
            await UserAccessService.syncClerkAccess(syncData.userId, syncData.isPatron, syncData.normalizedTotal).catch(e => {
                logger.error("[PaymentService] Post-dispute sync failed:", e);
            });
        }
        return syncData;
    }

    await prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.DISPUTED }
    });
  }

  private static async sendPaymentEmailSafely(
    type: 'DONATION' | 'PATRON',
    email: string,
    amount: number,
    currency: string,
    language: 'pl' | 'en',
    userId: string,
    paymentId: string
  ): Promise<void> {
    try {
      if (type === 'DONATION') {
        await EmailService.sendDonationThankYouEmail(email, amount, currency, language);
      } else {
        await EmailService.sendBecomePatronEmail(email, language);
      }
    } catch (error) {
      logger.error(`[${type}_EMAIL_FAILED]`, error);
      await writeAuditLog({
        action: "EMAIL_SEND_FAILED",
        targetType: "Payment",
        targetId: paymentId,
        actorUserId: userId,
        metadata: {
          emailType: type === 'DONATION' ? "donation_thank_you" : "become_patron",
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private static async fulfillPayment(intent: Stripe.PaymentIntent) {
    const paymentId = intent.metadata.paymentId;
    const userId = intent.metadata.userId;

    if (!paymentId || !userId) {
      logger.error('[PaymentService] Missing metadata in intent', intent.id);
      return;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Try to update PENDING -> SUCCEEDED (first time)
        const { count } = await tx.payment.updateMany({
            where: { id: paymentId, status: PaymentStatus.PENDING },
            data: { status: PaymentStatus.SUCCEEDED }
        });

        const updatedPayment = await tx.payment.findUnique({ where: { id: paymentId } });

        if (count === 0) {
            // If it was already SUCCEEDED, we continue to ensure metadata sync.
            // If it's something else (FAILED, REFUNDED), we stop.
            if (updatedPayment?.status === PaymentStatus.SUCCEEDED) {
              logger.info(`[PaymentService] Payment ${paymentId} already SUCCEEDED; proceeding with replay-safe sync.`);
            } else {
              logger.info(`[PaymentService] Payment ${paymentId} already fulfilled or not in a fulfillable state.`);
              return null;
            }
        }

        if (!updatedPayment) throw new Error('PAYMENT_RECORD_LOST');

        if (updatedPayment.amountMinor !== intent.amount) {
            throw new Error(`PAYMENT_AMOUNT_MISMATCH: Expected ${updatedPayment.amountMinor}, got ${intent.amount}`);
        }
        if (updatedPayment.currency.toLowerCase() !== intent.currency.toLowerCase()) {
            throw new Error(`PAYMENT_CURRENCY_MISMATCH: Expected ${updatedPayment.currency}, got ${intent.currency}`);
        }

        const existingUser = await tx.user.findUnique({
            where: { id: userId },
            include: { paymentTotals: true }
        });

        if (!existingUser) throw new Error('USER_NOT_FOUND');

        let updatedTotal;
        if (count > 0) {
          // Only increment total on the first successful fulfillment
          updatedTotal = await tx.userPaymentTotal.upsert({
              where: { userId_currency: { userId, currency: updatedPayment.currency } },
              create: {
                  userId,
                  currency: updatedPayment.currency,
                  amountMinor: updatedPayment.amountMinor
              },
              update: {
                  amountMinor: { increment: updatedPayment.amountMinor }
              }
          });
        } else {
          // On replay, just fetch the current total
          updatedTotal = await tx.userPaymentTotal.findUnique({
              where: { userId_currency: { userId, currency: updatedPayment.currency } }
          });
          if (!updatedTotal) {
            // This should not happen if it was already SUCCEEDED
             throw new Error('USER_PAYMENT_TOTAL_LOST');
          }
        }

        const patronMinTipAmountMinor = getPatronMinTipAmountMinor();
        // By default every successful one-time tip grants Patron status.
        // Set PATRON_MIN_TIP_AMOUNT (minor units) only if business rules require a separate Patron threshold.
        const grantsPatron = updatedPayment.amountMinor >= patronMinTipAmountMinor;
        let user = { ...existingUser, paymentTotals: existingUser.paymentTotals.map(t =>
            t.currency === updatedPayment.currency ? updatedTotal : t
        ) };
        let becamePatronNow = false;
        let normalizedTotal = normalizePaymentTotals(user.paymentTotals);

        if (grantsPatron) {
            const grantResult = await grantPatronStatus(userId, {
                source: 'stripe_tip',
                paymentId: updatedPayment.id,
                note: 'Granted after successful one-time Stripe tip',
            }, tx);
            user = grantResult.user;
            becamePatronNow = grantResult.becamePatronNow;
            normalizedTotal = grantResult.normalizedTotal;
        }

        return { user, becamePatronNow, normalizedTotal, isFirstFulfillment: count > 0 };
      });

      if (!result) return;
      const { user, becamePatronNow, normalizedTotal, isFirstFulfillment } = result;

      await UserAccessService.syncClerkAccess(user.id, user.isPatron, normalizedTotal);

      const language = (user.language as 'pl' | 'en') || 'pl';
      const amount = intent.amount / 100;

      // Emails are side effects, send them safely outside transaction only on first fulfillment
      if (isFirstFulfillment) {
          await this.sendPaymentEmailSafely(
            'DONATION',
            user.email,
            amount,
            intent.currency.toUpperCase(),
            language,
            user.id,
            paymentId
          );

          if (becamePatronNow) {
            await this.sendPaymentEmailSafely(
              'PATRON',
              user.email,
              amount,
              intent.currency.toUpperCase(),
              language,
              user.id,
              paymentId
            );
          }
      }

      logger.info(`[PaymentService] Payment fulfilled for user ${userId}: ${amount} ${intent.currency}`);
    } catch (error) {
      logger.error('[PaymentService] Error fulfilling payment:', error);
      throw error;
    }
  }
}
