import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PaymentStatus } from "@prisma/client";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentError } from "../domain/payment.errors";
import { logger } from "@/lib/logger";
import { recordMetric, recordAlert } from "@/lib/observability";
import { UserAccessService } from "@/lib/services/user-access.service";
import { recalculatePatronStatus } from "@/lib/modules/patron";

export interface HandleDisputeInput {
  stripeIntentId: string;
  status: string; // 'warning', 'needs_response', 'under_review', 'chargeback_lost', 'chargeback_won' (mapped from Stripe)
  isLost: boolean;
  isWon: boolean;
}

export async function handleDispute(
  input: HandleDisputeInput,
  ctx: AppContext
): Promise<UseCaseResult<void, PaymentError>> {
  const repo = new PaymentRepository();

  try {
    const syncData = await ctx.db.writeTransaction(async (tx) => {
      const payment = await repo.findByIntentId(input.stripeIntentId, tx);
      if (!payment) {
        recordAlert('payment.dispute_unmatched', { stripeIntentId: input.stripeIntentId });
        return null;
      }

      if (input.isLost) {
        const count = await repo.updatePaymentStatusWithCAS(payment.id, payment.status, PaymentStatus.CHARGEBACK_LOST, tx);
        if (count === 0 && payment.status !== PaymentStatus.CHARGEBACK_LOST) {
            // Already lost or race? If not lost, conflict
            return null;
        }

        const netAdjustment = Math.max(0, payment.amountMinor - (payment.refundedAmountMinor ?? 0));
        await repo.decrementUserPaymentTotal(payment.userId, payment.currency, netAdjustment, tx);

        // Revoke via recalculate (grants tied to this payment should be revoked in a more formal outbox/event pattern,
        // but for now we follow legacy decrementUserNetPaymentTotals pattern which didn't explicitly revoke grants but recalculated user status)
        // Actually, legacy applyLostChargeback DID revoke grants.
        await tx.patronGrant.updateMany({
            where: { paymentId: payment.id, revokedAt: null },
            data: { revokedAt: new Date(), reason: `Payment disputed: lost` }
        });

        const recalcResult = await recalculatePatronStatus(payment.userId, ctx, tx);
        if (!recalcResult.ok) {
            throw new Error(`PATRON_RECALC_FAILED: ${recalcResult.error.message}`);
        }
        const { isPatron, normalizedTotal } = recalcResult.data;
        recordAlert('payment.dispute_lost', { paymentId: payment.id, currency: payment.currency });
        return { userId: payment.userId, isPatron, normalizedTotal };
      }

      if (input.isWon) {
        await repo.updatePayment(payment.id, { status: PaymentStatus.SUCCEEDED }, tx);
        const recalcResult = await recalculatePatronStatus(payment.userId, ctx, tx);
        if (!recalcResult.ok) {
            throw new Error(`PATRON_RECALC_FAILED: ${recalcResult.error.message}`);
        }
        const { isPatron, normalizedTotal } = recalcResult.data;
        logger.info(`[HandleDispute] Dispute WON for payment ${payment.id}. Patron status restored if applicable.`);
        return { userId: payment.userId, isPatron, normalizedTotal };
      }

      // Default: DISPUTED
      await repo.updatePayment(payment.id, { status: PaymentStatus.DISPUTED }, tx);
      recordAlert('payment.dispute_opened', { paymentId: payment.id, status: input.status });
      return null;
    });

    if (syncData) {
      await UserAccessService.syncClerkAccess(syncData.userId, syncData.isPatron, syncData.normalizedTotal);
    }

    return ok(undefined);
  } catch (error: any) {
    logger.error(`[HandleDispute] Error handling dispute for ${input.stripeIntentId}:`, error);
    return fail(new PaymentError(error.message || 'Dispute processing failed'));
  }
}
