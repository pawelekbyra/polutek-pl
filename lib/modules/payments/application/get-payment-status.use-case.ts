import { PaymentStatus } from '@prisma/client';
import { AppContext } from '@/lib/modules/shared/app-context';
import { UseCaseResult, ok, fail } from '@/lib/modules/shared/result';
import { PaymentError } from '../domain/payment.errors';
import { fulfillPayment } from './fulfill-payment.use-case';
import { getStripeClient } from '../infrastructure/stripe-client';
import { logger } from '@/lib/logger';
import { paymentKeySet, stripeSecretKeyFor } from '@/lib/payments/stripe-key-sets';

/** What the payer's screen needs to know about one tip. A tip never grants access, so there is no "access" state. */
export type PaymentUiStatus = 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';

type OwnedPayment = {
  id: string;
  userId: string;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  stripeIntentId: string | null;
  metadata?: unknown;
};

/** Local statuses that the fast path re-checks with Stripe (a "failed" tip may still have succeeded on a later attempt). */
const RECHECK_STATUSES: PaymentStatus[] = [PaymentStatus.PENDING, PaymentStatus.FAILED, PaymentStatus.CANCELED];

export function toPaymentUiStatus(status: PaymentStatus): PaymentUiStatus {
  switch (status) {
    case PaymentStatus.SUCCEEDED:
      return 'SUCCEEDED';
    case PaymentStatus.FAILED:
    case PaymentStatus.CANCELED:
      return 'FAILED';
    case PaymentStatus.REFUNDED:
    case PaymentStatus.PARTIALLY_REFUNDED:
    case PaymentStatus.DISPUTED:
    case PaymentStatus.CHARGEBACK_LOST:
      return 'REFUNDED';
    default:
      return 'PROCESSING';
  }
}

/**
 * Fast path: asks Stripe about a not-yet-recorded payment instead of waiting for the webhook, so
 * the payer's thank-you screen resolves at once. Fulfilment still goes through the canonical,
 * idempotent fulfillPayment(), so racing the webhook or the cron is safe.
 *
 * Ownership is enforced by the caller (`{ id, userId }` lookup for the signed-in user), so this
 * is no cross-user Stripe lookup oracle. fulfillPayment runs as a system actor because creating
 * the supporter marker is a system action, exactly as in the webhook.
 */
async function reconcileWithStripe(payment: OwnedPayment, ctx: AppContext): Promise<void> {
  const keySet = paymentKeySet(payment.metadata);
  if (!payment.stripeIntentId || !stripeSecretKeyFor(keySet)) return;

  try {
    const intent = await getStripeClient(keySet).paymentIntents.retrieve(payment.stripeIntentId);
    if (intent.status !== 'succeeded') return;

    const result = await fulfillPayment({
      paymentId: payment.id,
      stripeIntentId: intent.id,
      metadataUserId: intent.metadata?.userId ?? null,
      amountMinor: intent.amount,
      currency: intent.currency,
    }, { ...ctx, actor: { type: 'system', reason: 'payment-status-fast-path-reconciliation' } });

    if (!result.ok) {
      logger.error(`[getOwnedPaymentStatus] Reconciliation fulfillPayment failed for ${payment.id}: ${result.error.message}`);
    }
  } catch (error) {
    // Best effort only; the webhook or the cron records the payment anyway.
    logger.error(`[getOwnedPaymentStatus] Stripe reconciliation failed for payment ${payment.id}`, error);
  }
}

export async function getOwnedPaymentStatus(
  input: { paymentId: string; userId: string },
  ctx: AppContext,
): Promise<UseCaseResult<{
  id: string;
  status: PaymentStatus;
  uiStatus: PaymentUiStatus;
  amountMinor: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
} | null, PaymentError>> {
  try {
    const select = {
      id: true,
      userId: true,
      amountMinor: true,
      currency: true,
      status: true,
      stripeIntentId: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    } as const;
    const where = { id: input.paymentId, userId: input.userId };

    let payment = await ctx.db.read.payment.findFirst({ where, select });
    if (!payment) return ok(null);

    if (RECHECK_STATUSES.includes(payment.status) && payment.stripeIntentId) {
      await reconcileWithStripe(payment, ctx);
      // Re-read so a fulfilment that just landed (here or in a concurrent webhook) shows at once.
      const refreshed = await ctx.db.read.payment.findFirst({ where, select });
      if (refreshed) payment = refreshed;
    }

    return ok({
      id: payment.id,
      status: payment.status,
      uiStatus: toPaymentUiStatus(payment.status),
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    });
  } catch (error) {
    return fail(new PaymentError(error instanceof Error ? error.message : 'Payment status lookup failed'));
  }
}
