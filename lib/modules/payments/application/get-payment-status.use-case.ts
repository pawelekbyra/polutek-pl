import { PaymentStatus } from '@prisma/client';
import Stripe from 'stripe';
import { AppContext } from '@/lib/modules/shared/app-context';
import { UseCaseResult, ok, fail } from '@/lib/modules/shared/result';
import { PaymentError } from '../domain/payment.errors';
import { fulfillPayment } from './fulfill-payment.use-case';
import { logger } from '@/lib/logger';

export type PaymentUiStatus = 'PENDING_WEBHOOK' | 'SUCCEEDED' | 'ACCESS_SYNC_PENDING' | 'FAILED_CANCELED' | 'REFUNDED_DISPUTED';

type OwnedPendingPayment = {
  id: string;
  userId: string;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  stripeIntentId: string | null;
};

function toUiStatus(status: PaymentStatus, hasActiveGrant: boolean): PaymentUiStatus {
  if (status === PaymentStatus.SUCCEEDED) return hasActiveGrant ? 'SUCCEEDED' : 'ACCESS_SYNC_PENDING';
  if (status === PaymentStatus.FAILED || status === PaymentStatus.CANCELED) return 'FAILED_CANCELED';
  if (status === PaymentStatus.REFUNDED || status === PaymentStatus.PARTIALLY_REFUNDED || status === PaymentStatus.DISPUTED || status === PaymentStatus.CHARGEBACK_LOST) return 'REFUNDED_DISPUTED';
  return 'PENDING_WEBHOOK';
}

/**
 * Actively reconciles a still-PENDING payment against the Stripe API instead of passively
 * waiting for the webhook. Stripe.js already knows the outcome the instant it redirects the
 * browser back (see `redirect_status` on the return URL), so there is no reason to leave the
 * user staring at a "waiting" screen until an async webhook happens to land. This is purely a
 * fast-path: fulfillment itself always goes through the canonical, idempotent `fulfillPayment()`
 * (never a manual status write), so it is safe to race with — or run redundantly alongside — the
 * webhook handler.
 *
 * Ownership is enforced by the caller: this is only ever invoked with a payment row already
 * scoped to `where: { id, userId }` for the authenticated Clerk user, so there is no cross-user
 * Stripe lookup oracle here.
 */
async function reconcilePendingPaymentWithStripe(payment: OwnedPendingPayment, ctx: AppContext): Promise<void> {
  if (payment.status !== PaymentStatus.PENDING || !payment.stripeIntentId) return;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return;

  try {
    const stripe = new Stripe(stripeKey);
    const intent = await stripe.paymentIntents.retrieve(payment.stripeIntentId);

    if (intent.status === 'succeeded') {
      // fulfillPayment() grants patron status via grantPatron(), which is gated to
      // admin/system actors only (PatronPolicy.canGrantPatron). The caller's ctx here carries
      // the paying user's own `user` actor, so running fulfillPayment with it verbatim always
      // throws PATRON_GRANT_FAILED — and since fulfillPayment runs inside one DB transaction,
      // that throw also rolls back the payment's SUCCEEDED status write, silently no-opping
      // this entire fast path on every poll. Ownership (`{id, userId}` lookup by the caller)
      // and payment success (the Stripe retrieve above) are already independently verified at
      // this point, so switching to a system actor for this one trusted internal call is safe
      // and mirrors exactly what the Stripe webhook route does for the same fulfillPayment() call.
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
    }
  } catch (error) {
    // Best-effort fast path only — any failure here just falls back to the normal
    // webhook-driven flow and the next poll tick (or the webhook itself) will resolve it.
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
  accessSynced: boolean;
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
      createdAt: true,
      updatedAt: true,
    } as const;

    let payment = await ctx.db.read.payment.findFirst({
      where: { id: input.paymentId, userId: input.userId },
      select,
    });

    if (!payment) return ok(null);

    if (payment.status === PaymentStatus.PENDING && payment.stripeIntentId) {
      await reconcilePendingPaymentWithStripe(payment, ctx);
      // Re-read after the reconciliation attempt so a fulfillment that just landed
      // (from this fast path or a concurrent webhook) is reflected immediately.
      const refreshed = await ctx.db.read.payment.findFirst({
        where: { id: input.paymentId, userId: input.userId },
        select,
      });
      if (refreshed) payment = refreshed;
    }

    const activeGrant = await ctx.db.read.patronGrant.findFirst({
      where: { paymentId: payment.id, userId: payment.userId, revokedAt: null },
      select: { id: true },
    });

    const accessSynced = payment.status === PaymentStatus.SUCCEEDED && Boolean(activeGrant);

    return ok({
      id: payment.id,
      status: payment.status,
      uiStatus: toUiStatus(payment.status, Boolean(activeGrant)),
      accessSynced,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    });
  } catch (error) {
    return fail(new PaymentError(error instanceof Error ? error.message : 'Payment status lookup failed'));
  }
}
