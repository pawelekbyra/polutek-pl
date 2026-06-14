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
  disputeId?: string;
  status: string; // 'warning', 'needs_response', 'under_review', 'chargeback_lost', 'chargeback_won' (mapped from Stripe)
  isLost: boolean;
  isWon: boolean;
}

function disputeSuspensionReason(disputeId: string): string {
  return `Payment dispute temporarily suspended access: stripeDisputeId=${disputeId}`;
}

function disputeLostReason(disputeId?: string): string {
  return disputeId
    ? `Payment disputed: lost; stripeDisputeId=${disputeId}`
    : 'Payment disputed: lost';
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
        if (payment.status === PaymentStatus.CHARGEBACK_LOST) {
          return null;
        }

        const count = await repo.updatePaymentStatusWithCAS(payment.id, payment.status, PaymentStatus.CHARGEBACK_LOST, tx);
        if (count === 0) {
          return null;
        }

        const netAdjustment = Math.max(0, payment.amountMinor - (payment.refundedAmountMinor ?? 0));
        await repo.decrementUserPaymentTotal(payment.userId, payment.currency, netAdjustment, tx);

        await tx.patronGrant.updateMany({
          where: { paymentId: payment.id },
          data: { revokedAt: new Date(), reason: disputeLostReason(input.disputeId) }
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
        if (payment.status === PaymentStatus.REFUNDED || payment.status === PaymentStatus.CHARGEBACK_LOST) {
          return null;
        }

        await repo.updatePayment(payment.id, { status: PaymentStatus.SUCCEEDED }, tx);

        if (input.disputeId) {
          await tx.patronGrant.updateMany({
            where: {
              paymentId: payment.id,
              revokedAt: { not: null },
              reason: disputeSuspensionReason(input.disputeId),
            },
            data: {
              revokedAt: null,
              reason: `Payment dispute won; access reactivated: stripeDisputeId=${input.disputeId}`,
            },
          });
        }

        const recalcResult = await recalculatePatronStatus(payment.userId, ctx, tx);
        if (!recalcResult.ok) {
            throw new Error(`PATRON_RECALC_FAILED: ${recalcResult.error.message}`);
        }
        const { isPatron, normalizedTotal } = recalcResult.data;
        logger.info(`[HandleDispute] Dispute WON for payment ${payment.id}. Patron status restored if it was suspended by the same dispute lifecycle.`);
        return { userId: payment.userId, isPatron, normalizedTotal };
      }

      // Default: DISPUTED
      const disputeId = input.disputeId || `unknown:${input.stripeIntentId}`;
      await repo.updatePayment(payment.id, { status: PaymentStatus.DISPUTED }, tx);
      await tx.patronGrant.updateMany({
        where: { paymentId: payment.id, revokedAt: null },
        data: { revokedAt: new Date(), reason: disputeSuspensionReason(disputeId) },
      });
      const recalcResult = await recalculatePatronStatus(payment.userId, ctx, tx);
      if (!recalcResult.ok) {
        throw new Error(`PATRON_RECALC_FAILED: ${recalcResult.error.message}`);
      }
      const { isPatron, normalizedTotal } = recalcResult.data;
      recordAlert('payment.dispute_opened', { paymentId: payment.id, status: input.status });
      return { userId: payment.userId, isPatron, normalizedTotal };
    });

    if (syncData) {
      await UserAccessService.syncClerkAccess(syncData.userId, syncData.isPatron, syncData.normalizedTotal);
    }

    return ok(undefined);
  } catch (error:
any) {
    logger.error(`[HandleDispute] Error handling dispute for ${input.stripeIntentId}:`, error);
    return fail(new PaymentError(error.message || 'Dispute processing failed'));
  }
}
