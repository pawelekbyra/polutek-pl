import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { logger } from "@/lib/logger";
import { recordAlert } from "@/lib/observability";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { getStripeClient } from "../infrastructure/stripe-client";
import { fetchEffectiveRefundedMinor } from "../infrastructure/stripe-refunds";
import { PaymentError } from "../domain/payment.errors";
import { applyRefundedTotal } from "./handle-refund.use-case";

export interface SyncRefundsInput {
  paymentId?: string;
  stripeIntentId?: string;
  /** Only the admin refund path: attributes a refund that is new to the local ledger to this admin. */
  admin?: { refundedById: string; reason?: string | null };
}

export interface SyncRefundsResult {
  /** False when no local payment matched (e.g. an intent of another integration). */
  matched: boolean;
  refundedMinor: number;
  /** Signed change applied locally (negative: a failed/canceled refund stopped counting). */
  deltaMinor: number;
}

/**
 * Makes the local refund total equal to what Stripe says now (PA-04). Used by every refund-related
 * webhook event, by the admin refund (before checking the limit and after creating the refund) and by the
 * reconciliation cron, so the ledger converges whatever happened first: parallel admin refunds, a refund
 * made in the Stripe Dashboard, a refund that failed later (BLIK/P24/bank refunds), a lost or replayed event.
 *
 * Stripe is read WHILE the payment row is locked (SELECT ... FOR UPDATE): concurrent syncs run one after
 * the other, each with a fresh answer, so an older snapshot can never overwrite a newer one.
 */
export async function syncRefundsFromStripe(
  input: SyncRefundsInput,
  ctx: AppContext,
): Promise<UseCaseResult<SyncRefundsResult, PaymentError>> {
  const repo = new PaymentRepository();
  try {
    const result = await ctx.db.writeTransaction(async (tx): Promise<SyncRefundsResult> => {
      const found = input.paymentId
        ? await repo.findById(input.paymentId, tx)
        : input.stripeIntentId
          ? await repo.findByIntentId(input.stripeIntentId, tx)
          : null;
      if (!found) {
        recordAlert('payment.refund_unmatched', { hasPaymentId: Boolean(input.paymentId), hasStripeIntentId: Boolean(input.stripeIntentId) });
        return { matched: false, refundedMinor: 0, deltaMinor: 0 };
      }

      await repo.lockPaymentRow(found.id, tx);
      const payment = await repo.findById(found.id, tx);
      if (!payment) return { matched: false, refundedMinor: 0, deltaMinor: 0 };
      if (!payment.stripeIntentId) {
        return { matched: true, refundedMinor: payment.refundedAmountMinor ?? 0, deltaMinor: 0 };
      }

      const stripeTotal = await fetchEffectiveRefundedMinor(getStripeClient(), payment.stripeIntentId);
      const applied = await applyRefundedTotal(payment, stripeTotal, { allowDecrease: true, admin: input.admin }, ctx, tx, repo);
      await repo.markRefundsChecked(payment.id, ctx.now(), tx);
      return { matched: true, ...applied };
    });
    return ok(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[SyncRefunds] ${input.paymentId ?? input.stripeIntentId}: ${message}`);
    return fail(new PaymentError(message || 'Refund sync failed'));
  }
}
