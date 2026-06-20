import { logger } from "@/lib/logger";
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { fulfillPayment as fulfillPaymentUseCase } from '@/lib/modules/payments/application/fulfill-payment.use-case';


/**
 * @deprecated Use fulfillPayment use case from @/lib/modules/payments.
 * R10 cleanup candidate.
 */
export class PaymentFulfillmentService {
  static async fulfillPayment(intent: Stripe.PaymentIntent) {
    const paymentId = intent.metadata.paymentId;
    const metadataUserId = intent.metadata.userId;

    if (!paymentId) {
      logger.error('[PaymentFulfillmentService] Missing paymentId metadata in intent', intent.id);
      return;
    }

    const ctx = createAppContext({
      actor: { type: 'system', reason: 'legacy payment fulfillment delegate' },
      prisma,
    });

    const result = await fulfillPaymentUseCase({
      paymentId,
      stripeIntentId: intent.id,
      metadataUserId,
      amountMinor: intent.amount,
      currency: intent.currency,
    }, ctx);

    if (!result.ok) {
      throw result.error;
    }

    logger.info(`[PaymentFulfillmentService] Delegated fulfillment for payment ${paymentId} to hardened modular use case.`);
  }
}
