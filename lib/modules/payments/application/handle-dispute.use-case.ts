import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PaymentStatus } from "@prisma/client";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentError } from "../domain/payment.errors";
import { logger } from "@/lib/logger";
import { recordAlert } from "@/lib/observability";
import { restoreSupporterGrantRevokedFor, revokeSupporterGrantIfNoPaidTips } from "./supporter-grant";

export interface HandleDisputeInput {
  stripeIntentId: string;
  disputeId: string;
  /**
   * Stripe's own `dispute.status`, read from Stripe when the event is handled (not from the event
   * payload), so events that arrive out of order still land on the dispute's current state.
   */
  status: string;
}

export type DisputeOutcome = "open" | "lost" | "closed_in_favour";

/** Maps every Stripe dispute status (including inquiries/early warnings) onto what it means for us. */
export function classifyDisputeStatus(status: string): DisputeOutcome {
  switch (status) {
    case "lost":
      return "lost";
    case "won":
    case "warning_closed":
    case "prevented":
      return "closed_in_favour";
    default:
      // warning_needs_response, warning_under_review, needs_response, under_review
      return "open";
  }
}

export function disputeSuspensionReason(disputeId: string): string {
  return `Payment disputed: stripeDisputeId=${disputeId}`;
}

const UNRECORDED_STATUSES: PaymentStatus[] = [PaymentStatus.PENDING, PaymentStatus.FAILED, PaymentStatus.CANCELED];

/** Statuses an open dispute may move to DISPUTED from; anything else is never moved backwards. */
const DISPUTABLE_STATUSES: PaymentStatus[] = [PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED];

export async function handleDispute(
  input: HandleDisputeInput,
  ctx: AppContext
): Promise<UseCaseResult<{ outcome: DisputeOutcome; changed: boolean }, PaymentError>> {
  const repo = new PaymentRepository();
  const outcome = classifyDisputeStatus(input.status);

  try {
    const changed = await ctx.db.writeTransaction(async (tx) => {
      const payment = await repo.findByIntentId(input.stripeIntentId, tx);
      if (!payment) {
        recordAlert('payment.dispute_unmatched', { stripeIntentId: input.stripeIntentId });
        return false;
      }

      // A dispute implies Stripe took the money: a payment still unpaid locally has not been recorded
      // yet (event order, webhook outage). Fail so Stripe redelivers once it is recorded, instead of
      // dropping the dispute or decrementing totals that were never raised.
      if (outcome !== "closed_in_favour" && UNRECORDED_STATUSES.includes(payment.status)) {
        recordAlert('payment.dispute_before_fulfilment', { paymentId: payment.id, status: payment.status });
        throw new Error(`PAYMENT_NOT_RECORDED_YET: dispute ${input.disputeId} for payment ${payment.id} in status ${payment.status}; retry later`);
      }

      if (outcome === "lost") {
        if (payment.status === PaymentStatus.CHARGEBACK_LOST) return false;

        const count = await repo.updatePaymentStatusWithCAS(payment.id, payment.status, PaymentStatus.CHARGEBACK_LOST, tx);
        if (count === 0) return false;

        const netAdjustment = Math.max(0, payment.amountMinor - (payment.refundedAmountMinor ?? 0));
        await repo.decrementUserPaymentTotal(payment.userId, payment.currency, netAdjustment, tx);
        await revokeSupporterGrantIfNoPaidTips({
          userId: payment.userId,
          paymentId: payment.id,
          revokeReason: `Payment dispute lost: stripeDisputeId=${input.disputeId}`,
        }, ctx, tx);
        recordAlert('payment.dispute_lost', { paymentId: payment.id, currency: payment.currency });
        return true;
      }

      if (outcome === "closed_in_favour") {
        // Only a payment this dispute actually suspended goes back; a refunded, lost or never
        // disputed payment stays as it is.
        if (payment.status !== PaymentStatus.DISPUTED) return false;

        const restoredStatus = (payment.refundedAmountMinor ?? 0) > 0
          ? PaymentStatus.PARTIALLY_REFUNDED
          : PaymentStatus.SUCCEEDED;
        const count = await repo.updatePaymentStatusWithCAS(payment.id, PaymentStatus.DISPUTED, restoredStatus, tx);
        if (count === 0) return false;

        await restoreSupporterGrantRevokedFor({
          userId: payment.userId,
          revokeReason: disputeSuspensionReason(input.disputeId),
        }, ctx, tx);
        logger.info(`[HandleDispute] Dispute ${input.disputeId} closed in the payer's favour (${input.status}); payment ${payment.id} back to ${restoredStatus}.`);
        return true;
      }

      if (!DISPUTABLE_STATUSES.includes(payment.status)) return false;

      const count = await repo.updatePaymentStatusWithCAS(payment.id, payment.status, PaymentStatus.DISPUTED, tx);
      if (count === 0) return false;

      await revokeSupporterGrantIfNoPaidTips({
        userId: payment.userId,
        paymentId: payment.id,
        revokeReason: disputeSuspensionReason(input.disputeId),
      }, ctx, tx);
      recordAlert('payment.dispute_opened', { paymentId: payment.id, status: input.status });
      return true;
    });

    return ok({ outcome, changed });
  } catch (error: any) {
    logger.error(`[HandleDispute] Error handling dispute for ${input.stripeIntentId}:`, error);
    return fail(new PaymentError(error.message || 'Dispute processing failed'));
  }
}
