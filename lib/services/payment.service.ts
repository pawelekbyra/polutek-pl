import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { EmailService } from './email.service';
import { UserAccessService } from './user-access.service';
import { MIN_PATRON_AMOUNT, MIN_PATRON_AMOUNT_PLN } from '../constants';
import { PaymentStatus, PatronGrantSource, WebhookEventStatus, Prisma } from '@prisma/client';


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

function normalizePaymentTotals(paymentTotals: Array<{ currency: string; amountMinor: number }>) {
  const totalPLN = paymentTotals.find(t => t.currency === 'PLN')?.amountMinor || 0;
  const totalEUR = paymentTotals.find(t => t.currency === 'EUR')?.amountMinor || 0;
  return (totalPLN / 100) + (totalEUR / 100 * 4.3);
}

async function decrementUserNetPaymentTotals(
  tx: Prisma.TransactionClient,
  userId: string,
  currency: string,
  deltaMinor: number,
) {
  if (deltaMinor <= 0) return;

  const [user, total] = await Promise.all([
    tx.user.findUnique({ where: { id: userId }, select: { totalPaidMinor: true } }),
    tx.userPaymentTotal.findUnique({ where: { userId_currency: { userId, currency } }, select: { amountMinor: true } }),
  ]);

  if (user) {
    await tx.user.update({
      where: { id: userId },
      data: { totalPaidMinor: Math.max(0, user.totalPaidMinor - deltaMinor) },
    });
  }

  if (total) {
    await tx.userPaymentTotal.update({
      where: { userId_currency: { userId, currency } },
      data: { amountMinor: Math.max(0, total.amountMinor - deltaMinor) },
    });
  }
}

export async function applyLostChargeback(
  tx: Prisma.TransactionClient,
  payment: { id: string; userId: string; currency: string; amountMinor: number; refundedAmountMinor?: number | null },
  disputeStatus: string,
) {
  await tx.payment.update({
    where: { id: payment.id },
    data: { status: PaymentStatus.CHARGEBACK_LOST },
  });
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
  }: {
    userId: string;
    amountMinor: number;
    currency: string;
    title: string;
    creatorId?: string;
  }) {
    const stripe = getStripe();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    if (!user) throw new Error('USER_NOT_FOUND');

    const stripeCustomerId = await this.getOrCreateStripeCustomer(userId, user.email);

    const payment = await prisma.payment.create({
      data: {
        userId,
        creatorId,
        amountMinor,
        currency: currency.toUpperCase(),
        status: PaymentStatus.PENDING,
      }
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountMinor,
      currency: currency.toLowerCase(),
      customer: stripeCustomerId,
      description: title,
      metadata: {
        userId,
        paymentId: payment.id,
        ...(creatorId ? { creatorId } : {}),
      },
      automatic_payment_methods: { enabled: true },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { stripeIntentId: paymentIntent.id }
    });

    return {
        id: payment.id,
        clientSecret: paymentIntent.client_secret
    };
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

    // Idempotency check
    const existingEvent = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
    if (existingEvent) {
        if (existingEvent.status === WebhookEventStatus.PROCESSED) {
            console.log(`[PaymentService] Event ${event.id} already processed.`);
            return;
        }

        if (existingEvent.status === WebhookEventStatus.PROCESSING) {
            const STALE_PROCESSING_MINUTES = 10;
            const now = new Date();
            const updatedAt = existingEvent.updatedAt || now;
            const diffMs = now.getTime() - updatedAt.getTime();
            const diffMins = diffMs / (1000 * 60);

            if (diffMins < STALE_PROCESSING_MINUTES) {
                console.log(`[PaymentService] Event ${event.id} is currently being processed and is fresh.`);
                return;
            }

            console.log(`[PaymentService] Event ${event.id} was stuck in PROCESSING. Retrying.`);
            // We allow re-processing of stale events
        }
        // If FAILED, we allow re-processing
    }

    // Create or update event to PROCESSING
    await prisma.stripeEvent.upsert({
        where: { id: event.id },
        create: {
            id: event.id,
            type: event.type,
            status: WebhookEventStatus.PROCESSING,
            payload: getSafeStripeEventPayload(event)
        },
        update: {
            status: WebhookEventStatus.PROCESSING,
            error: null
        }
    });

    try {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const intent = event.data.object as Stripe.PaymentIntent;
                await this.fulfillPayment(intent);
                break;
            }
            case 'charge.refunded': {
                const charge = event.data.object as Stripe.Charge;
                const syncData = await this.handleRefund(charge);
                if (syncData) {
                    await UserAccessService.syncClerkAccess(syncData.userId, syncData.isPatron, syncData.normalizedTotal);
                }
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
                    console.warn(`[PaymentService] No payment record found for failed intent: ${intent.id}`);
                }
                break;
            }
            default:
                console.log(`Unhandled Stripe event type: ${event.type}`);
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
        console.error(`[PaymentService] Error handling event ${event.id}:`, error);
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

    console.log(`[PaymentService] Handling refund. paymentId=${paymentId || 'none'}, intentId=${stripeIntentId || 'none'}`);

    return await prisma.$transaction(async (tx) => {
        const payment = paymentId
          ? await tx.payment.findUnique({ where: { id: paymentId } })
          : stripeIntentId
            ? await tx.payment.findUnique({ where: { stripeIntentId } })
            : null;

        if (!payment) return null;

        const reportedRefundedMinor = charge.amount_refunded || 0;
        const refund = calculateRefundAdjustment(payment, reportedRefundedMinor);

        if (!refund.status) return null;

        await tx.payment.update({
            where: { id: payment.id },
            data: {
                refundedAmountMinor: refund.newRefundedAmountMinor,
                status: refund.status,
            }
        });

        await decrementUserNetPaymentTotals(tx, payment.userId, payment.currency, refund.deltaRefundMinor);

        if (!refund.isFullRefund) {
            console.log(`[PaymentService] Payment ${payment.id} partially refunded (${refund.newRefundedAmountMinor}/${payment.amountMinor}); retaining grants.`);
            const user = await tx.user.findUnique({
                where: { id: payment.userId },
                include: { paymentTotals: true },
            });
            return user
                ? { userId: payment.userId, isPatron: user.isPatron, normalizedTotal: normalizePaymentTotals(user.paymentTotals) }
                : null;
        }

        // Revoke associated grants only after a full refund.
        await tx.patronGrant.updateMany({
            where: { paymentId: payment.id, revokedAt: null },
            data: { revokedAt: new Date(), reason: 'Payment fully refunded' }
        });

        // Recalculate status after grant revocation and total correction.
        const { isPatron, normalizedTotal } = await UserAccessService.recalculateUserPatronStatus(payment.userId, tx);
        return { userId: payment.userId, isPatron, normalizedTotal };
    });
}

  private static async handleDispute(dispute: Stripe.Dispute) {
    const stripeIntentId = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id;
    if (!stripeIntentId) return;

    const payment = await prisma.payment.findUnique({ where: { stripeIntentId } });
    if (!payment) return;

    console.log(`[PaymentService] Handling dispute (${dispute.status}) for payment ${payment.id}`);

    if (dispute.status === 'lost') {
        return await prisma.$transaction(async (tx) => {
            await applyLostChargeback(tx, payment, dispute.status);
            const { isPatron, normalizedTotal } = await UserAccessService.recalculateUserPatronStatus(payment.userId, tx);
            return { userId: payment.userId, isPatron, normalizedTotal };
        });
    }

    await prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.DISPUTED }
    });
  }

  private static async fulfillPayment(intent: Stripe.PaymentIntent) {
    const paymentId = intent.metadata.paymentId;
    const userId = intent.metadata.userId;

    if (!paymentId || !userId) {
      console.error('[PaymentService] Missing metadata in intent', intent.id);
      return;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const { count } = await tx.payment.updateMany({
            where: { id: paymentId, status: PaymentStatus.PENDING },
            data: { status: PaymentStatus.SUCCEEDED }
        });

        if (count === 0) {
            console.log(`[PaymentService] Payment ${paymentId} already fulfilled or not found.`);
            return null;
        }

        const updatedPayment = await tx.payment.findUnique({ where: { id: paymentId } });
        if (!updatedPayment) throw new Error('PAYMENT_RECORD_LOST');

        if (updatedPayment.amountMinor !== intent.amount) {
            throw new Error(`PAYMENT_AMOUNT_MISMATCH: Expected ${updatedPayment.amountMinor}, got ${intent.amount}`);
        }
        if (updatedPayment.currency.toLowerCase() !== intent.currency.toLowerCase()) {
            throw new Error(`PAYMENT_CURRENCY_MISMATCH: Expected ${updatedPayment.currency}, got ${intent.currency}`);
        }

        const thresholdMinor = updatedPayment.currency === 'PLN' ? MIN_PATRON_AMOUNT_PLN * 100 : MIN_PATRON_AMOUNT * 100;
        const existingUser = await tx.user.findUnique({
            where: { id: userId },
            include: { paymentTotals: true }
        });

        if (!existingUser) throw new Error('USER_NOT_FOUND');

        const updatedTotal = await tx.userPaymentTotal.upsert({
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

        const grantsPatron = updatedPayment.amountMinor >= thresholdMinor;
        const becamePatronNow = !existingUser.isPatron && grantsPatron;

        const user = await tx.user.update({
          where: { id: userId },
          data: {
            totalPaidMinor: { increment: updatedPayment.amountMinor },
            isPatron: existingUser.isPatron || grantsPatron,
            patronSince: becamePatronNow ? new Date() : undefined
          },
          include: { paymentTotals: true }
        });

        if (becamePatronNow) {
            await tx.patronGrant.create({
                data: {
                    userId,
                    source: PatronGrantSource.PAYMENT,
                    paymentId: updatedPayment.id,
                    reason: 'Single payment threshold reached'
                }
            });
        }

        const totals = user.paymentTotals.map(t =>
            t.currency === updatedPayment.currency ? updatedTotal : t
        );
        const totalPLN = totals.find(t => t.currency === 'PLN')?.amountMinor || 0;
        const totalEUR = totals.find(t => t.currency === 'EUR')?.amountMinor || 0;
        const normalizedTotal = (totalPLN / 100) + (totalEUR / 100 * 4.3);

        return { user, becamePatronNow, normalizedTotal };
      });

      if (!result) return;
      const { user, becamePatronNow, normalizedTotal } = result;

      await UserAccessService.syncClerkAccess(user.id, user.isPatron, normalizedTotal);

      const language = (user.language as 'pl' | 'en') || 'pl';
      const amount = intent.amount / 100;
      await EmailService.sendDonationThankYouEmail(user.email, amount, intent.currency.toUpperCase(), language);

      if (becamePatronNow) {
        await EmailService.sendBecomePatronEmail(user.email, language);
      }

      console.log(`[PaymentService] Payment fulfilled for user ${userId}: ${amount} ${intent.currency}`);
    } catch (error) {
      console.error('[PaymentService] Error fulfilling payment:', error);
      throw error;
    }
  }
}
