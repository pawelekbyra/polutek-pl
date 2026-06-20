import Stripe from 'stripe';
import { fulfillPayment } from '@/lib/modules/payments/application/fulfill-payment.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';

/**
 * @deprecated Legacy production callers delegate to the hardened modular
 * fulfillPayment use case so there is only one Stripe fulfillment path.
 */
export class PaymentFulfillmentService {
  static async fulfillPayment(intent: Stripe.PaymentIntent) {
    const result = await fulfillPayment({
      paymentId: intent.metadata.paymentId,
      stripeIntentId: intent.id,
      metadataUserId: intent.metadata.userId,
      amountMinor: intent.amount,
      currency: intent.currency,
    }, createAppContext({ actor: { type: 'system', reason: 'legacy Stripe fulfillment delegate' } }));

    if (!result.ok) throw result.error;
  }
}
