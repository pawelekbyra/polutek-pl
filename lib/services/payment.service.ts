import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { EmailService } from './email.service';
import { getClerkClient } from '@/lib/clerk';
import { MIN_PATRON_AMOUNT, MIN_PATRON_AMOUNT_PLN } from '../constants';
import { PaymentStatus, PatronGrantSource, Prisma } from '@prisma/client';

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

    // Idempotency check. Persist the event only after successful handling so
    // Stripe retries are not suppressed when processing fails partway through.
    const existingEvent = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
    if (existingEvent) return;

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await this.fulfillPayment(intent);
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await prisma.payment.updateMany({
            where: { stripeIntentId: intent.id },
            data: { status: PaymentStatus.FAILED }
        });
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        // Legacy/Future Checkout Session support
        // ... implementation if needed
        break;
      }
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    await this.markEventProcessed(event);
  }

  private static async markEventProcessed(event: Stripe.Event) {
    try {
      await prisma.stripeEvent.create({
        data: {
          id: event.id,
          type: event.type,
          payload: event as any,
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return;
      }
      throw error;
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
        const payment = await tx.payment.findUnique({ where: { id: paymentId } });
        if (!payment || payment.status === PaymentStatus.SUCCEEDED) return { user: null, becamePatronNow: false };

        const updatedPayment = await tx.payment.update({
          where: { id: paymentId },
          data: { status: PaymentStatus.SUCCEEDED }
        });

        const thresholdMinor = updatedPayment.currency === 'PLN' ? MIN_PATRON_AMOUNT_PLN * 100 : MIN_PATRON_AMOUNT * 100;
        const existingUser = await tx.user.findUnique({ where: { id: userId } });

        if (!existingUser) throw new Error('USER_NOT_FOUND');

        const grantsPatron = (existingUser.totalPaidMinor + updatedPayment.amountMinor) >= thresholdMinor;
        const becamePatronNow = !existingUser.isPatron && grantsPatron;

        const user = await tx.user.update({
          where: { id: userId },
          data: {
            totalPaidMinor: { increment: updatedPayment.amountMinor },
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
                    reason: 'One-time payment threshold reached'
                }
            });
        }

        return { user, becamePatronNow };
      });

      if (!user) return;

      await this.syncClerkVipStatus(user.id, user.totalPaidMinor / 100, user.isPatron);

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

  private static async syncClerkVipStatus(userId: string, totalPaid: number, isPatron: boolean) {
    try {
      const client = await getClerkClient();
      let role = isPatron ? 'PATRON' : 'USER';

      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          role,
          totalPaid,
          isPatron,
        },
      });
    } catch (error) {
      console.error('[PaymentService] Error syncing VIP status to Clerk:', error);
    }
  }
}
