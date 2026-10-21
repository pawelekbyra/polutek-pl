import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { WriteTx } from "@/lib/modules/shared/db";
import { PaymentStatus } from "@prisma/client";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentError } from "../domain/payment.errors";
import { PaymentDto } from "../domain/payment.dto";
import { logger } from "@/lib/logger";
import { isPremiumPassPayment } from "../domain/payment.purpose";
import { recordMetric, recordAlert } from "@/lib/observability";
import { revokeSupporterGrantIfNoPaidTips, restoreSupporterGrantRevokedFor } from "./supporter-grant";

const UNRECORDED_STATUSES: PaymentStatus[] = [PaymentStatus.PENDING, PaymentStatus.FAILED, PaymentStatus.CANCELED];

export interface RefundTotalOptions {
  /**
   * True only when `reportedRefundedMinor` is Stripe's CURRENT effective total read from the refund list
   * (see sync-refunds.use-case.ts): then a lower number than the local one is a refund that failed or was
   * canceled and must stop counting. A bare webhook/admin number stays monotonic (older events never undo).
   */
  allowDecrease?: boolean;
  /**
   * Set ONLY by the admin refund path. A refund reported by the Stripe webhook
   * must not fabricate an admin actor, so it leaves this out.
   */
  admin?: { refundedById: string; reason?: string | null };
}

export interface HandleRefundInput extends RefundTotalOptions {
  stripeIntentId?: string;
  paymentId?: string;
  reportedRefundedMinor: number;
}

export interface RefundTotalResult {
  /** Local refunded total after the call. */
  refundedMinor: number;
  /** Signed change applied to the local total (negative = a refund stopped counting). */
  deltaMinor: number;
}

/**
 * Moves one payment's refunded total to `reportedRefundedMinor` (capped to the payment amount) inside the
 * caller's transaction: CAS on the old total, status, per-person total and supporter marker follow.
 * Throws a retryable error for a payment that is not recorded as paid yet.
 */
export async function applyRefundedTotal(
  payment: PaymentDto,
  reportedRefundedMinor: number,
  options: RefundTotalOptions,
  ctx: AppContext,
  tx: WriteTx,
  repo: PaymentRepository = new PaymentRepository(),
): Promise<RefundTotalResult> {
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
  const previousStatus = payment.status;
  const cappedRefunded = Math.max(0, Math.min(reportedRefundedMinor, payment.amountMinor));
  const rawDelta = cappedRefunded - previousRefunded;
  const deltaRefundMinor = options.allowDecrease ? rawDelta : Math.max(0, rawDelta);

  // A disputed or lost payment keeps that status; only the refunded amount is recorded.
  const keepsDisputeStatus = payment.status === PaymentStatus.DISPUTED || payment.status === PaymentStatus.CHARGEBACK_LOST;
  const newStatus = keepsDisputeStatus
    ? payment.status
    : cappedRefunded >= payment.amountMinor
      ? PaymentStatus.REFUNDED
      : cappedRefunded > 0
        ? PaymentStatus.PARTIALLY_REFUNDED
        : PaymentStatus.SUCCEEDED;

  if (deltaRefundMinor === 0) {
    // The webhook recorded this refund first: still attribute it to the admin who made it.
    if (options.admin && cappedRefunded > 0 && !payment.refundedById) {
      await tx.payment.updateMany({
        where: { id: payment.id, refundedById: null },
        data: { refundedById: options.admin.refundedById, refundedAt: ctx.now(), refundReason: options.admin.reason ?? null },
      });
    }
    return { refundedMinor: previousRefunded, deltaMinor: 0 };
  }

  // CAS check on refundedAmountMinor to avoid race conditions
  const count = await repo.updateRefundStatusWithCAS(payment.id, previousRefunded, {
    refundedAmountMinor: cappedRefunded,
    status: newStatus,
    ...(deltaRefundMinor < 0 && cappedRefunded === 0
      ? { refundedById: null, refundedAt: null, refundReason: null }
      : options.admin
        ? { refundedById: options.admin.refundedById, refundedAt: ctx.now(), refundReason: options.admin.reason ?? null }
        : {}),
  }, tx);

  if (count === 0) {
    recordAlert('payment.refund_cas_conflict', { paymentId: payment.id });
    return { refundedMinor: previousRefunded, deltaMinor: 0 };
  }

  if (deltaRefundMinor > 0) {
    recordMetric('payment.refund_received', { status: newStatus, deltaMinor: deltaRefundMinor, fullRefund: cappedRefunded >= payment.amountMinor });
    await repo.decrementUserPaymentTotal(payment.userId, payment.currency, deltaRefundMinor, tx);

    if (newStatus === PaymentStatus.REFUNDED && isPremiumPassPayment(payment.metadata)) {
      // patron zone: a fully refunded patron-zone payment takes its period of access back.
      const { revokePatronAccessForPayment, readPaymentProductId } = await import("@/lib/modules/patron-zone");
      await revokePatronAccessForPayment(tx, { userId: payment.userId, paymentId: payment.id, productId: readPaymentProductId(payment.metadata), amountMinor: payment.amountMinor, now: ctx.now() });
    } else if (newStatus === PaymentStatus.REFUNDED) {
      // A fully refunded tip no longer counts; the supporter marker goes only when no other
      // paid tip is left. A partial refund leaves the tip counting.
      await revokeSupporterGrantIfNoPaidTips({
        userId: payment.userId,
        paymentId: payment.id,
        revokeReason: fullRefundRevokeReason(payment.id),
      }, ctx, tx);
    }
  } else {
    // A refund failed or was canceled (BLIK/P24/bank refunds can come back): the money was not returned,
    // so the tip counts again. A tip lost in a dispute was already taken out of the total in full.
    recordAlert('payment.refund_reverted', { paymentId: payment.id, deltaMinor: deltaRefundMinor });
    if (previousStatus !== PaymentStatus.CHARGEBACK_LOST) {
      await repo.incrementUserPaymentTotal(payment.userId, payment.currency, -deltaRefundMinor, tx);
    }
    if (previousStatus === PaymentStatus.REFUNDED && newStatus !== PaymentStatus.REFUNDED) {
      const active = await tx.patronGrant.findFirst({ where: { userId: payment.userId, revokedAt: null }, select: { id: true } });
      if (!active) {
        await restoreSupporterGrantRevokedFor({ userId: payment.userId, revokeReason: fullRefundRevokeReason(payment.id) }, ctx, tx);
      }
    }
  }
  return { refundedMinor: cappedRefunded, deltaMinor: deltaRefundMinor };
}

function fullRefundRevokeReason(paymentId: string) {
  return `Payment ${paymentId} fully refunded`;
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
      return await applyRefundedTotal(payment, input.reportedRefundedMinor, input, ctx, tx, repo);
    });

    return ok(undefined);
  } catch (error: any) {
    logger.error(`[HandleRefund] Error handling refund for ${input.paymentId || input.stripeIntentId}:`, error);
    return fail(new PaymentError(error.message || 'Refund processing failed'));
  }
}
