import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { EmailService } from './email.service';
import { getClerkClient } from '@/lib/clerk';
import { MIN_PATRON_AMOUNT, MIN_PATRON_AMOUNT_PLN } from '../constants';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is missing');
  }
  return new Stripe(key, {
    apiVersion: '2024-04-10' as any,
  });
}

export class PaymentService {
  static async createCheckoutSession({
    userId,
    amount,
    currency,
    title,
    creatorId,
    successUrl,
    cancelUrl,
  }: {
    userId: string;
    amount: number;
    currency: string;
    title: string;
    creatorId: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      automatic_payment_methods: { enabled: true },
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: title,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        creatorId,
      },
    } as any);

    return session;
  }

  static async createPaymentIntent({
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
    creatorId: string;
  }) {
    const stripe = getStripe();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      description: title,
      metadata: {
        userId,
        creatorId,
      },
      automatic_payment_methods: { enabled: true },
    } as any);

    return paymentIntent;
  }

  static async handleWebhook(body: string, sig: string) {
    const stripe = getStripe();
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is missing');
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err: any) {
      throw new Error(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      await this.fulfillOrder({
        userId: session.metadata?.userId,
        creatorId: session.metadata?.creatorId,
        amount: (session.amount_total || 0) / 100,
        currency: session.currency?.toUpperCase() || 'EUR',
        stripeId: session.id,
      });
    } else if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await this.fulfillOrder({
        userId: paymentIntent.metadata?.userId,
        creatorId: paymentIntent.metadata?.creatorId,
        amount: (paymentIntent.amount_received || 0) / 100,
        currency: paymentIntent.currency?.toUpperCase() || 'EUR',
        stripeId: paymentIntent.id,
      });
    }
  }

  private static async fulfillOrder({
    userId,
    creatorId,
    amount,
    currency,
    stripeId,
  }: {
    userId?: string;
    creatorId?: string;
    amount: number;
    currency: string;
    stripeId: string;
  }) {

    if (!userId) {
      console.error('[PaymentService] Missing userId in session metadata');
      return;
    }

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Create transaction record
        // Prevent duplicate fulfillment by checking stripeId
        const existing = await tx.transaction.findFirst({
            where: { stripeSessionId: stripeId }
        });

        if (existing) {
            console.log(`[PaymentService] Transaction ${stripeId} already fulfilled.`);
            return;
        }

        await tx.transaction.create({
          data: {
            userId,
            creatorId,
            amount,
            currency,
            stripeSessionId: stripeId,
            status: 'COMPLETED',
          },
        });

        // 2. Check if this payment grants Patron status
        const threshold = currency.toUpperCase() === 'PLN' ? MIN_PATRON_AMOUNT_PLN : MIN_PATRON_AMOUNT;
        const existingUser = await tx.user.findUnique({ where: { id: userId } });

        const grantsPatron = amount >= threshold;
        const willBePatron = !!(existingUser?.isPatron || grantsPatron);
        const becamePatronNow = !existingUser?.isPatron && grantsPatron;

        // 3. Update user's total paid and Patron status
        const user = await tx.user.update({
          where: { id: userId },
          data: {
            totalPaid: { increment: amount },
            isPatron: willBePatron,
            patronSince: becamePatronNow ? new Date() : undefined
          },
        });

        // 4. Sync status to Clerk
        await this.syncClerkVipStatus(user.id, user.totalPaid, user.isPatron);

        // 5. Send emails
        const language = (user.language as 'pl' | 'en') || 'pl';
        await EmailService.sendDonationThankYouEmail(user.email, amount, currency, language);

        if (becamePatronNow) {
          await EmailService.sendBecomePatronEmail(user.email, language);
        }
      });
      console.log(`[PaymentService] Order fulfilled for user ${userId}: ${amount} ${currency}`);
    } catch (error) {
      console.error('[PaymentService] Error fulfilling order:', error);
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
      console.log(`[PaymentService] Synced Clerk status for ${userId}: ${role} (${totalPaid}, isPatron: ${isPatron})`);
    } catch (error) {
      console.error('[PaymentService] Error syncing VIP status to Clerk:', error);
    }
  }
}
