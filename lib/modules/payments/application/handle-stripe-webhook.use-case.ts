import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { StripeEventLockService } from "../infrastructure/stripe-event-lock.service";
import { fulfillPayment } from "./fulfill-payment.use-case";
import { handleRefund } from "./handle-refund.use-case";
import { handleDispute } from "./handle-dispute.use-case";
import { PaymentError } from "../domain/payment.errors";
import { logger } from "@/lib/logger";
import { startTimer, recordDurationMetric, recordAlert } from "@/lib/observability";
import Stripe from 'stripe';
import { PaymentStatus } from "@prisma/client";

export interface HandleStripeWebhookInput {
  body: string;
  signature: string;
}

export async function handleStripeWebhook(
  input: HandleStripeWebhookInput,
  ctx: AppContext
): Promise<UseCaseResult<{ received: boolean }, PaymentError>> {
  const startedAt = startTimer();
  const repo = new PaymentRepository();
  const lockService = new StripeEventLockService({ read: ctx.db.read, write: ctx.prisma });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' as any });
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    return fail(new PaymentError('STRIPE_WEBHOOK_SECRET is missing'));
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(input.body, input.signature, endpointSecret);
  } catch (err: any) {
    return fail(new PaymentError(`Webhook Signature Error: ${err.message}`));
  }

  // 1. Acquire Lock (Idempotency)
  const lockStatus = await lockService.acquireLock({
    id: event.id,
    type: event.type,
    payload: {
      id: event.id,
      type: event.type,
      created: event.created,
      livemode: event.livemode,
      object: event.object,
    }
  });

  if (lockStatus === 'ALREADY_PROCESSED') {
    return ok({ received: true });
  }
  if (lockStatus === 'CONFLICT') {
    return ok({ received: true }); // Acknowledge Stripe even if we have a conflict, to stop retries if another process is handling it
  }

  // 2. Handle Event
  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await fulfillPayment({
          paymentId: intent.metadata.paymentId,
          userId: intent.metadata.userId,
          amountMinor: intent.amount,
          currency: intent.currency
        }, ctx);
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await handleRefund({
          paymentId: charge.metadata?.paymentId,
          stripeIntentId: typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id,
          reportedRefundedMinor: charge.amount_refunded || 0
        }, ctx);
        break;
      }
      case 'charge.dispute.created':
      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute;
        await handleDispute({
          stripeIntentId: (typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id)!,
          disputeId: dispute.id,
          status: dispute.status,
          isLost: dispute.status === 'lost',
          isWon: dispute.status === 'won'
        }, ctx);
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const payment = await repo.findByIntentId(intent.id, ctx.db.read);
        if (payment) {
          await repo.updatePayment(payment.id, { status: PaymentStatus.FAILED }, ctx.prisma as any);
        }
        recordAlert('payment.failure', { stripeIntentId: intent.id });
        break;
      }
    }

    // 3. Success Release
    await lockService.releaseWithSuccess(event.id);
    recordDurationMetric('stripe.webhook.processing_time', startedAt, { eventType: event.type, status: 'processed' });
    return ok({ received: true });
  } catch (error: any) {
    // 4. Failure Release
    logger.error(`[HandleStripeWebhook] Error processing event ${event.id}:`, error);
    await lockService.releaseWithFailure(event.id, error.message || String(error));
    recordDurationMetric('stripe.webhook.processing_time', startedAt, { eventType: event.type, status: 'failed' }, { level: 'error', alert: true });
    return fail(new PaymentError(error.message || 'Webhook processing failed'));
  }
}
