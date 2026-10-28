import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { StripeEventLockService } from "../infrastructure/stripe-event-lock.service";
import { fulfillPayment } from "./fulfill-payment.use-case";
import { syncRefundsFromStripe } from "./sync-refunds.use-case";
import { handleDispute } from "./handle-dispute.use-case";
import {
  PaymentError,
  PaymentWebhookConfigError,
  PaymentWebhookEventInProgressError,
  PaymentWebhookProcessingError,
  PaymentWebhookSignatureError,
} from "../domain/payment.errors";
import { logger } from "@/lib/logger";
import { startTimer, recordDurationMetric, recordAlert } from "@/lib/observability";
import Stripe from 'stripe';
import { getStripeClient } from "../infrastructure/stripe-client";
import {
  paymentKeySet,
  premiumKeysConfigured,
  secretKeyIsLive,
  stripeWebhookSecretFor,
  PREMIUM_STRIPE_ENV,
  type StripeKeySet,
} from "@/lib/payments/stripe-key-sets";

export interface HandleStripeWebhookInput {
  /** The raw request body, exactly as received (the signature covers these bytes). */
  body: string;
  signature: string;
}

/**
 * processed: handled (or a type we don't act on, recorded in StripeEvent).
 * duplicate: this event id was already processed.
 * ignored:   valid, but not ours to act on (other mode, or an intent created outside the app).
 */
export type StripeWebhookOutcome = 'processed' | 'duplicate' | 'ignored';

/**
 * The signing secrets this server accepts, each tagged with the key set it belongs to. One URL receives two Stripe
 * endpoints: the live one (tips, STRIPE_WEBHOOK_SECRET) and, when the premium set is configured, the test-mode one
 * of the patron-zone checkout (PREMIUM_PASS_STRIPE_WEBHOOK_SECRET). A missing secret only removes its own set.
 */
function acceptedWebhookSecrets(): Array<{ keySet: StripeKeySet; secret: string }> {
  const accepted: Array<{ keySet: StripeKeySet; secret: string }> = [];
  const live = stripeWebhookSecretFor('default');
  if (live) accepted.push({ keySet: 'default', secret: live });
  const premium = premiumKeysConfigured() ? stripeWebhookSecretFor('premium') : undefined;
  if (premium) accepted.push({ keySet: 'premium', secret: premium });
  return accepted;
}

/** True (and alerts) when the payment was made with the other key set than the one that verified this event. */
function crossesKeySets(payment: { id: string; metadata: unknown } | null, verifiedWith: StripeKeySet, event: Stripe.Event): boolean {
  if (!payment || paymentKeySet(payment.metadata) === verifiedWith) return false;
  logger.warn(`[StripeWebhook] Ignored ${event.id} (${event.type}): payment ${payment.id} belongs to the ${paymentKeySet(payment.metadata)} Stripe key set but the event was signed for the ${verifiedWith} set.`);
  recordAlert('stripe.webhook.key_set_mismatch', { eventType: event.type });
  return true;
}

function intentIdOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

/**
 * Stripe webhook: verifies the signature on the raw body, deduplicates by event id (StripeEvent
 * row written before any processing) and hands each event to the canonical use cases. Every
 * received and every rejected event leaves one log line (ids and types only, never the payload).
 */
export async function handleStripeWebhook(
  input: HandleStripeWebhookInput,
  ctx: AppContext
): Promise<UseCaseResult<{ received: true; outcome: StripeWebhookOutcome }, PaymentError>> {
  const startedAt = startTimer();
  const repo = new PaymentRepository();
  const lockService = new StripeEventLockService({ read: ctx.db.read, write: ctx.prisma });

  const accepted = acceptedWebhookSecrets();
  if (accepted.length === 0) {
    logger.error('[StripeWebhook] Rejected: STRIPE_WEBHOOK_SECRET is not set on this server.');
    recordAlert('stripe.webhook.config_missing', {});
    return fail(new PaymentWebhookConfigError('STRIPE_WEBHOOK_SECRET is missing'));
  }

  let event: Stripe.Event | null = null;
  let keySet: StripeKeySet = 'default';
  let lastReason = '';
  for (const candidate of accepted) {
    try {
      // Pure signature check; needs no API key, only the endpoint's signing secret. The first secret that
      // verifies decides the key set; a payload that verifies with none is rejected.
      event = Stripe.webhooks.constructEvent(input.body, input.signature, candidate.secret);
      keySet = candidate.keySet;
      break;
    } catch (err: unknown) {
      lastReason = err instanceof Error ? err.message : String(err);
    }
  }
  if (!event) {
    logger.warn(`[StripeWebhook] Rejected: signature verification failed (${lastReason}). Check that STRIPE_WEBHOOK_SECRET (or ${PREMIUM_STRIPE_ENV.webhookSecret}) is the signing secret of this exact endpoint and mode, and that nothing in front of the app changes the body.`);
    recordAlert('stripe.webhook.signature_invalid', {});
    return fail(new PaymentWebhookSignatureError('Webhook signature verification failed'));
  }

  // Each set's events must match the mode of that set's own secret key: a test-mode event never reaches a payment
  // of the live set and a live event never reaches one of the (test) premium set.
  const keyIsLive = secretKeyIsLive(keySet);
  if (keyIsLive !== null && event.livemode !== keyIsLive) {
    logger.warn(`[StripeWebhook] Ignored ${event.id} (${event.type}): event livemode=${event.livemode} but the ${keySet} Stripe secret key is ${keyIsLive ? 'live' : 'test'}.`);
    recordAlert('stripe.webhook.mode_mismatch', { eventType: event.type });
    return ok({ received: true, outcome: 'ignored' });
  }

  logger.info(`[StripeWebhook] Received ${event.id} (${event.type}, livemode=${event.livemode}).`);

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
    logger.info(`[StripeWebhook] ${event.id} already processed; acknowledged as duplicate.`);
    return ok({ received: true, outcome: 'duplicate' });
  }
  if (lockStatus === 'CONFLICT') {
    // Non-2xx so Stripe retries later, when the first delivery has finished.
    logger.warn(`[StripeWebhook] ${event.id} is being processed by another delivery; asking Stripe to retry.`);
    return fail(new PaymentWebhookEventInProgressError(event.id));
  }

  try {
    const outcome = await dispatchEvent(event, keySet, repo, ctx);
    await lockService.releaseWithSuccess(event.id);
    logger.info(`[StripeWebhook] ${event.id} (${event.type}) ${outcome}.`);
    recordDurationMetric('stripe.webhook.processing_time', startedAt, { eventType: event.type, status: outcome });
    return ok({ received: true, outcome });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[StripeWebhook] ${event.id} (${event.type}) failed: ${message}`);
    await lockService.releaseWithFailure(event.id, message);
    recordDurationMetric('stripe.webhook.processing_time', startedAt, { eventType: event.type, status: 'failed' }, { level: 'error', alert: true });
    return fail(new PaymentWebhookProcessingError(message || 'Webhook processing failed'));
  }
}

async function dispatchEvent(event: Stripe.Event, keySet: StripeKeySet, repo: PaymentRepository, ctx: AppContext): Promise<StripeWebhookOutcome> {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object;
      if (!intent.metadata?.paymentId) {
        // Payment Link, a Dashboard charge or another integration on the same account: not ours.
        logger.info(`[StripeWebhook] ${event.id}: intent ${intent.id} has no paymentId metadata; not created by this app.`);
        return 'ignored';
      }
      if (crossesKeySets(await repo.findById(intent.metadata.paymentId, ctx.db.read), keySet, event)) return 'ignored';
      const result = await fulfillPayment({
        paymentId: intent.metadata.paymentId,
        stripeIntentId: intent.id,
        metadataUserId: intent.metadata.userId,
        amountMinor: intent.amount,
        currency: intent.currency
      }, ctx);
      if (!result.ok) throw result.error;
      return 'processed';
    }
    case 'payment_intent.payment_failed': {
      // One failed attempt (wrong BLIK code, declined card, failed 3DS). The intent returns to
      // requires_payment_method and a later attempt may still succeed, so the payment stays
      // PENDING; abandoned ones are canceled by the reconciliation cron.
      const intent = event.data.object;
      recordAlert('payment.attempt_failed', {
        stripeIntentId: intent.id,
        code: intent.last_payment_error?.code ?? 'unknown',
      });
      return 'processed';
    }
    case 'payment_intent.canceled': {
      const intent = event.data.object;
      const payment = await repo.findByIntentId(intent.id, ctx.db.read);
      if (!payment) return 'ignored';
      if (crossesKeySets(payment, keySet, event)) return 'ignored';
      await repo.markUnpaidPaymentCanceled(payment.id, ctx.prisma);
      return 'processed';
    }
    case 'charge.refunded':
    case 'charge.refund.updated':
    case 'refund.created':
    case 'refund.updated':
    case 'refund.failed': {
      // Event order is not guaranteed and a refund can fail or be canceled after `charge.refunded`
      // (BLIK/P24/bank refunds), so the event only says WHICH payment changed; the amount comes from
      // Stripe's current refund list (PA-04), like disputes below.
      const object = event.data.object as Stripe.Charge | Stripe.Refund;
      const stripeIntentId = intentIdOf(object.payment_intent);
      const paymentId = object.object === 'charge' ? object.metadata?.paymentId : undefined;
      if (!stripeIntentId && !paymentId) {
        // A refund of a charge without a PaymentIntent cannot belong to a payment of this app.
        logger.info(`[StripeWebhook] ${event.id}: ${event.type} has no payment_intent; not a payment of this app.`);
        return 'ignored';
      }
      const known = paymentId ? await repo.findById(paymentId, ctx.db.read) : await repo.findByIntentId(stripeIntentId!, ctx.db.read);
      if (crossesKeySets(known, keySet, event)) return 'ignored';
      const result = await syncRefundsFromStripe({ paymentId, stripeIntentId: stripeIntentId ?? undefined }, ctx);
      if (!result.ok) throw result.error;
      return 'processed';
    }
    case 'charge.dispute.created':
    case 'charge.dispute.updated':
    case 'charge.dispute.closed': {
      const eventDispute = event.data.object;
      const stripeIntentId = intentIdOf(eventDispute.payment_intent);
      if (!stripeIntentId) return 'ignored';
      // Stripe does not guarantee event order: act on the dispute's state now, not on the
      // snapshot inside this (possibly late) event.
      if (crossesKeySets(await repo.findByIntentId(stripeIntentId, ctx.db.read), keySet, event)) return 'ignored';
      const current = await getStripeClient(keySet).disputes.retrieve(eventDispute.id);
      const result = await handleDispute({
        stripeIntentId,
        disputeId: current.id,
        status: current.status,
      }, ctx);
      if (!result.ok) throw result.error;
      return 'processed';
    }
    default:
      return 'processed';
  }
}
