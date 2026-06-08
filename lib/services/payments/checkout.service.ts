import { logger } from "@/lib/logger";
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { PaymentStatus } from '@prisma/client';
import { MainChannelService } from '@/lib/channel/main-channel.service';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is missing');
  }
  return new Stripe(key);
}

export class PaymentCheckoutService {
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
    requestId,
  }: {
    userId: string;
    amountMinor: number;
    currency: string;
    title: string;
    requestId?: string;
  }) {
    const stripe = getStripe();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    if (!user) throw new Error('USER_NOT_FOUND');

    const mainChannel = await MainChannelService.getRequired();
    const creatorId = mainChannel.id;

    const stripeCustomerId = await this.getOrCreateStripeCustomer(userId, user.email);

    // Deduplication check: look for an existing pending payment with the same requestId
    if (requestId) {
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
            logger.info(`[PaymentCheckoutService.createPayment] Deduplicated request ${requestId} for user ${userId}. Returning existing payment ${existingWithId.id}`);
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
            ...(requestId ? { requestId } : {}),
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

        logger.info(`[PaymentCheckoutService.createPayment] Created new payment ${payment.id} with intent ${paymentIntent.id} for request ${requestId || 'none'}`);
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
}
