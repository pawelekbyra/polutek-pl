import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PaymentStatus } from "@prisma/client";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentError } from "../domain/payment.errors";
import { logger } from "@/lib/logger";
import { recordMetric, recordAlert } from "@/lib/observability";
import { UserAccessService } from "@/lib/services/user-access.service";
import { revokePatron, recalculatePatronStatus } from "@/lib/modules/patron";

export interface HandleRefundInput {
  stripeIntentId?: string;
  paymentId?: string;
  reportedRefundedMinor: number;
}

export async function handleRefund(
  input: HandleRefundInput,
  ctx: AppContext
): Promise<UseCaseResult<void, PaymentError>> {
  const repo = new PaymentRepository();

  try {
    const syncData = await ctx.db.writeTransaction(async (tx) => {
      const payment = input.paymentId
        ? await repo.findById(input.paymentId, tx)
        : input.stripeIntentId
          ? await repo.findByIntentId(input.stripeIntentId, tx)
          : null;

      if (!payment) {
        recordAlert('payment.refund_unmatched', { hasPaymentId: Boolean(input.paymentId), hasStripeIntentId: Boolean(input.stripeIntentId) });
        return null;
      }

      const previousRefunded = payment.refundedAmountMinor ?? 0;
      const cappedRefunded = Math.max(0, Math.min(input.reportedRefundedMinor, payment.amountMinor));
      const deltaRefundMinor = Math.max(0, cappedRefunded - previousRefunded);

      const newStatus = cappedRefunded >= payment.amountMinor
        ? PaymentStatus.REFUNDED
        : cappedRefunded > 0
          ? PaymentStatus.PARTIALLY_REFUNDED
          : payment.status;

      if (deltaRefundMinor <= 0) return null;

      // CAS check on refundedAmountMinor to avoid race conditions
      const count = await repo.updateRefundStatusWithCAS(payment.id, previousRefunded, {
        refundedAmountMinor: cappedRefunded,
        status: newStatus
      }, tx);

      if (count === 0) {
        recordAlert('payment.refund_cas_conflict', { paymentId: payment.id });
        return null;
      }

      recordMetric('payment.refund_received', { status: newStatus, deltaMinor: deltaRefundMinor, fullRefund: cappedRefunded >= payment.amountMinor });

      await repo.decrementUserPaymentTotal(payment.userId, payment.currency, deltaRefundMinor, tx);

      if (cappedRefunded >= payment.amountMinor) {
        // Full refund: Revoke Patron status
        const revokeResult = await revokePatron({
          userId: payment.userId,
          note: 'Payment fully refunded',
        }, ctx);

        if (!revokeResult.ok) {
            throw new Error(`PATRON_REVOKE_FAILED: ${revokeResult.error.message}`);
        }

        return { userId: payment.userId, isPatron: revokeResult.data.isPatron, normalizedTotal: revokeResult.data.normalizedTotal };
      } else {
        // Partial refund: Recalculate status (threshold might have changed)
        const recalcResult = await recalculatePatronStatus(payment.userId, ctx, tx);
        if (!recalcResult.ok) {
            throw new Error(`PATRON_RECALC_FAILED: ${recalcResult.error.message}`);
        }
        return { userId: payment.userId, isPatron: recalcResult.data.isPatron, normalizedTotal: recalcResult.data.normalizedTotal };
      }
    });

    if (syncData) {
      await UserAccessService.syncClerkAccess(syncData.userId, syncData.isPatron, syncData.normalizedTotal);
    }

    return ok(undefined);
  } catch (error: any) {
    logger.error(`[HandleRefund] Error handling refund for ${input.paymentId || input.stripeIntentId}:`, error);
    return fail(new PaymentError(error.message || 'Refund processing failed'));
  }
}
