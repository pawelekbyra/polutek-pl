import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PaymentStatus } from "@prisma/client";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentError } from "../domain/payment.errors";
import { logger } from "@/lib/logger";
import { recordMetric, recordAlert } from "@/lib/observability";
import { revokeSupporterGrantIfNoPaidTips } from "./supporter-grant";

const UNRECORDED_STATUSES: PaymentStatus[] = [PaymentStatus.PENDING, PaymentStatus.FAILED, PaymentStatus.CANCELED];

export interface HandleRefundInput {
  stripeIntentId?: string;
  paymentId?: string;
  reportedRefundedMinor: number;
  /**
   * Set ONLY by the admin refund path. A refund reported by the Stripe webhook
   * must not fabricate an admin actor, so it leaves this out.
   */
  admin?: { refundedById: string; reason?: string | null };
}

export async function handleRefund(
  input: HandleRefundInput,
  ctx: AppContext
): Promise<UseCaseResult<void, PaymentError>> {
  const repo = new PaymentRepository();

  try {
    await ctx.db.writeTransaction(async (tx) => {
      const payment = input.paymentId
        ? await repo.findById(input.paymentId, tx)
        : input.stripeIntentId
          ? await repo.findByIntentId(input.stripeIntentId, tx)
          : null;

      if (!payment) {
        recordAlert('payment.refund_unmatched', { hasPaymentId: Boolean(input.paymentId), hasStripeIntentId: Boolean(input.stripeIntentId) });
        return null;
      }

      // A refund implies Stripe took the money, so a payment still PENDING/FAILED/CANCELED here just
      // has not been recorded as paid yet (event order is not guaranteed; the webhook may have been
      // down). Applying the refund now would block the later fulfilment (its CAS needs an unpaid
      // status) and lower totals that were never raised. Fail so Stripe redelivers after the
      // payment_intent.succeeded / reconciliation has recorded it.
      if (UNRECORDED_STATUSES.includes(payment.status as PaymentStatus)) {
        recordAlert('payment.refund_before_fulfilment', { paymentId: payment.id, status: payment.status });
        throw new Error(`PAYMENT_NOT_RECORDED_YET: refund for payment ${payment.id} in status ${payment.status}; retry later`);
      }

      const previousRefunded = payment.refundedAmountMinor ?? 0;
      const cappedRefunded = Math.max(0, Math.min(input.reportedRefundedMinor, payment.amountMinor));
      const deltaRefundMinor = Math.max(0, cappedRefunded - previousRefunded);

      // A disputed or lost payment keeps that status; only the refunded amount is recorded.
      const keepsDisputeStatus = payment.status === PaymentStatus.DISPUTED || payment.status === PaymentStatus.CHARGEBACK_LOST;
      const newStatus = keepsDisputeStatus
        ? payment.status
        : cappedRefunded >= payment.amountMinor
          ? PaymentStatus.REFUNDED
          : cappedRefunded > 0
            ? PaymentStatus.PARTIALLY_REFUNDED
            : payment.status;

      if (deltaRefundMinor <= 0) {
        // The webhook recorded this refund first: still attribute it to the admin who made it.
        if (input.admin && cappedRefunded > 0 && !payment.refundedById) {
          await tx.payment.updateMany({
            where: { id: payment.id, refundedById: null },
            data: { refundedById: input.admin.refundedById, refundedAt: ctx.now(), refundReason: input.admin.reason ?? null },
          });
        }
        return null;
      }

      // CAS check on refundedAmountMinor to avoid race conditions
      const count = await repo.updateRefundStatusWithCAS(payment.id, previousRefunded, {
        refundedAmountMinor: cappedRefunded,
        status: newStatus,
        ...(input.admin
          ? {
              refundedById: input.admin.refundedById,
              refundedAt: ctx.now(),
              refundReason: input.admin.reason ?? null,
            }
          : {}),
      }, tx);

      if (count === 0) {
        recordAlert('payment.refund_cas_conflict', { paymentId: payment.id });
        return null;
      }

      recordMetric('payment.refund_received', { status: newStatus, deltaMinor: deltaRefundMinor, fullRefund: cappedRefunded >= payment.amountMinor });

      await repo.decrementUserPaymentTotal(payment.userId, payment.currency, deltaRefundMinor, tx);

      if (newStatus === PaymentStatus.REFUNDED) {
        // A fully refunded tip no longer counts; the supporter marker goes only when no other
        // paid tip is left. A partial refund leaves the tip counting.
        await revokeSupporterGrantIfNoPaidTips({
          userId: payment.userId,
          paymentId: payment.id,
          revokeReason: `Payment ${payment.id} fully refunded`,
        }, ctx, tx);
      }
      return { userId: payment.userId };
    });

    return ok(undefined);
  } catch (error: any) {
    logger.error(`[HandleRefund] Error handling refund for ${input.paymentId || input.stripeIntentId}:`, error);
    return fail(new PaymentError(error.message || 'Refund processing failed'));
  }
}
