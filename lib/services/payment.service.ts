import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { EmailService } from './email.service';
import { UserAccessService } from './user-access.service';
import { MIN_PATRON_AMOUNT, MIN_PATRON_AMOUNT_PLN } from '../constants';
import { PaymentStatus, PatronGrantSource, StripeEventStatus } from '@prisma/client';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is missing');
  }
  return new Stripe(key);
}

export class PaymentService {
  static async createPayment({
    userId,
    amount,
    currency,
    title,
    creatorId,
  }: {
    userId: string;
    amount: number;
    currency: string;
    title: string;
    creatorId?: string;
  }) {
    const stripe = getStripe();
    const amountMinor = Math.round(amount * 100);

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
        if (existingEvent.status === StripeEventStatus.PROCESSED) {
            console.log(`[PaymentService] Event ${event.id} already processed.`);
            return;
        }

        if (existingEvent.status === StripeEventStatus.PROCESSING) {
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
            status: StripeEventStatus.PROCESSING,
            payload: event as any
        },
        update: {
            status: StripeEventStatus.PROCESSING,
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
                await this.handleRefund(charge);
                break;
            }
            case 'charge.dispute.created':
            case 'charge.dispute.closed': {
                const dispute = event.data.object as Stripe.Dispute;
                await this.handleDispute(dispute);
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
            // TODO: Decide and implement patron revocation policy for:
            // - charge.refunded
            // - charge.dispute.created
            // - charge.dispute.closed
            default:
                console.log(`Unhandled Stripe event type: ${event.type}`);
        }

        // Mark as PROCESSED
        await prisma.stripeEvent.update({
            where: { id: event.id },
            data: {
                status: StripeEventStatus.PROCESSED,
                processedAt: new Date()
            }
        });
    } catch (error: any) {
        console.error(`[PaymentService] Error handling event ${event.id}:`, error);
        await prisma.stripeEvent.update({
            where: { id: event.id },
            data: {
                status: StripeEventStatus.FAILED,
                error: error.message || String(error)
            }
        });
        throw error; // Throw so Stripe can retry
    }
  }

  private static async handleRefund(charge: Stripe.Charge) {
    const paymentId = charge.metadata?.paymentId;
    if (!paymentId) return;

    console.log(`[PaymentService] Handling refund for payment ${paymentId}`);

    await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({ where: { id: paymentId } });
        if (!payment || payment.status === PaymentStatus.REFUNDED) return;

        await tx.payment.update({
            where: { id: paymentId },
            data: { status: PaymentStatus.REFUNDED }
        });

        // Revoke associated grants
        await tx.patronGrant.updateMany({
            where: { paymentId: payment.id, revokedAt: null },
            data: { revokedAt: new Date(), reason: 'Payment refunded' }
        });

        // Recalculate status
        await UserAccessService.recalculateUserPatronStatus(payment.userId, tx);
    });
  }

  private static async handleDispute(dispute: Stripe.Dispute) {
    // Find payment by stripeIntentId if it matches dispute.payment_intent
    const stripeIntentId = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id;
    if (!stripeIntentId) return;

    const payment = await prisma.payment.findUnique({ where: { stripeIntentId } });
    if (!payment) return;

    console.log(`[PaymentService] Handling dispute (${dispute.status}) for payment ${payment.id}`);

    if (dispute.status === 'lost' || dispute.status === 'warning_needs_response') {
        await prisma.$transaction(async (tx) => {
            // Revoke grants for lost disputes or as a precaution
            await tx.patronGrant.updateMany({
                where: { paymentId: payment.id, revokedAt: null },
                data: { revokedAt: new Date(), reason: `Payment disputed: ${dispute.status}` }
            });
            await UserAccessService.recalculateUserPatronStatus(payment.userId, tx);
        });
    }
  }

  private static async fulfillPayment(intent: Stripe.PaymentIntent) {
    const paymentId = intent.metadata.paymentId;
    const userId = intent.metadata.userId;

    if (!paymentId || !userId) {
      console.error('[PaymentService] Missing metadata in intent', intent.id);
      return;
    }

    try {
      const { user, becamePatronNow } = await prisma.$transaction(async (tx) => {
        // Atomic update to prevent double fulfillment
        const { count } = await tx.payment.updateMany({
            where: { id: paymentId, status: PaymentStatus.PENDING },
            data: { status: PaymentStatus.SUCCEEDED }
        });

        if (count === 0) {
            console.log(`[PaymentService] Payment ${paymentId} already fulfilled or not found.`);
            return { user: null, becamePatronNow: false };
        }

        const updatedPayment = await tx.payment.findUnique({ where: { id: paymentId } });
        if (!updatedPayment) throw new Error('PAYMENT_RECORD_LOST');

        const thresholdMinor = updatedPayment.currency === 'PLN' ? MIN_PATRON_AMOUNT_PLN * 100 : MIN_PATRON_AMOUNT * 100;
        const existingUser = await tx.user.findUnique({ where: { id: userId } });

        if (!existingUser) throw new Error('USER_NOT_FOUND');

        // Multi-currency handling: Update UserPaymentTotal
        await tx.userPaymentTotal.upsert({
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

        // Determine Patron status based on this single payment threshold
        const grantsPatron = updatedPayment.amountMinor >= thresholdMinor;
        const becamePatronNow = !existingUser.isPatron && grantsPatron;

        const user = await tx.user.update({
          where: { id: userId },
          data: {
            totalPaidMinor: { increment: updatedPayment.amountMinor }, // Diagnostics/Legacy
            isPatron: existingUser.isPatron || grantsPatron,
            patronSince: becamePatronNow ? new Date() : undefined
          },
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

        return { user, becamePatronNow };
      });

      if (!user) return;

      await UserAccessService.syncClerkAccess(user.id, user.isPatron, user.totalPaidMinor / 100);

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
