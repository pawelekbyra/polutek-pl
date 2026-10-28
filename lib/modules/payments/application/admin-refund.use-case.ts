import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentError, PaymentProviderError } from "../domain/payment.errors";
import { syncRefundsFromStripe } from "./sync-refunds.use-case";
import { logger } from "@/lib/logger";
import { PaymentStatus } from "@prisma/client";
import Stripe from "stripe";
import { getStripeClient } from "../infrastructure/stripe-client";
import { paymentKeySet } from "@/lib/payments/stripe-key-sets";
import { recordAuditEvent } from "@/lib/modules/audit";
import { recordAlert } from "@/lib/observability";

export interface AdminRefundInput {
  paymentId: string;
  amountMinor?: number; // undefined = full refund
  /** Free-text note of the admin (stored on the payment, in the audit log and in Stripe metadata). */
  reason?: string;
  /** Stripe's own reason enum; defaults to requested_by_customer. */
  stripeReason?: "duplicate" | "fraudulent" | "requested_by_customer";
  /**
   * Generated when the refund dialog opens. A repeated submit (double click, retry after a timeout) carries
   * the same key, so Stripe returns the first refund instead of creating a second one.
   */
  idempotencyKey?: string;
}

export interface AdminRefundResult {
  stripeRefundId: string;
  amountMinor: number;
  status: string;
}

const REFUNDABLE_STATUSES: PaymentStatus[] = [
  PaymentStatus.SUCCEEDED,
  PaymentStatus.PARTIALLY_REFUNDED,
  PaymentStatus.DISPUTED,
];

/** Best effort: an audit write that fails after the money moved must not turn a done refund into an error. */
async function recordAuditBestEffort(ctx: AppContext, event: Parameters<typeof recordAuditEvent>[1]): Promise<boolean> {
  try {
    await recordAuditEvent(ctx, event);
    return true;
  } catch (error) {
    logger.error(`[AdminRefund] Audit write ${event.action} failed for ${event.targetId}:`, error);
    recordAlert('payment.refund_audit_failed', { paymentId: event.targetId, action: event.action });
    return false;
  }
}

export async function adminRefund(
  input: AdminRefundInput,
  ctx: AppContext
): Promise<UseCaseResult<AdminRefundResult, PaymentError>> {
  const repo = new PaymentRepository();

  const initial = await repo.findById(input.paymentId, ctx.db.read);
  if (!initial) {
    return fail(new PaymentError(`Payment ${input.paymentId} not found`, "PAYMENT_NOT_FOUND", 404));
  }
  if (!REFUNDABLE_STATUSES.includes(initial.status as PaymentStatus)) {
    return fail(
      new PaymentError(
        `Payment ${initial.id} has status ${initial.status} and cannot be refunded`,
        "PAYMENT_NOT_REFUNDABLE",
        422
      )
    );
  }
  if (!initial.stripeIntentId) {
    return fail(
      new PaymentError(
        `Payment ${initial.id} has no Stripe intent ID; cannot initiate refund`,
        "PAYMENT_NO_STRIPE_INTENT",
        422
      )
    );
  }

  const adminActor = { refundedById: ctx.actor.type === "admin" ? ctx.actor.userId : "unknown", reason: input.reason ?? null };

  // PA-04: the local total may be behind Stripe (a refund made in the Dashboard, a parallel refund whose
  // webhook has not arrived). Re-read it from Stripe before judging the amount; if Stripe cannot be
  // reached nothing has been refunded yet, so the request simply fails.
  const preSync = await syncRefundsFromStripe({ paymentId: initial.id }, ctx);
  if (!preSync.ok) {
    logger.error(`[AdminRefund] Could not re-read refunds from Stripe for payment ${initial.id}:`, preSync.error);
    return fail(new PaymentProviderError("Stripe refunds could not be read. Details are in the server log."));
  }

  const payment = await repo.findById(input.paymentId, ctx.db.read);
  if (!payment) {
    return fail(new PaymentError(`Payment ${input.paymentId} not found`, "PAYMENT_NOT_FOUND", 404));
  }

  if (!REFUNDABLE_STATUSES.includes(payment.status as PaymentStatus)) {
    return fail(
      new PaymentError(
        `Payment ${payment.id} has status ${payment.status} and cannot be refunded`,
        "PAYMENT_NOT_REFUNDABLE",
        422
      )
    );
  }

  const alreadyRefunded = payment.refundedAmountMinor ?? 0;
  const statusBefore = payment.status;
  const maxRefundable = payment.amountMinor - alreadyRefunded;
  if (maxRefundable <= 0) {
    return fail(new PaymentError("Payment is already fully refunded", "PAYMENT_ALREADY_REFUNDED", 422));
  }

  const requestedAmount = input.amountMinor ?? maxRefundable;
  if (requestedAmount <= 0 || requestedAmount > maxRefundable) {
    return fail(
      new PaymentError(
        `Refund amount ${requestedAmount} is invalid (max refundable: ${maxRefundable})`,
        "INVALID_REFUND_AMOUNT",
        422
      )
    );
  }

  // A retried request (network error, double click) for the same refund state reuses the key,
  // so Stripe returns the first refund instead of refunding twice. Once that refund is recorded,
  // alreadyRefunded changes and a deliberate next refund gets a new key.
  const idempotencyKey = input.idempotencyKey ? `refund-${payment.id}-${input.idempotencyKey}` : `refund-${payment.id}-${alreadyRefunded}-${requestedAmount}`;

  // PA-09: the intent is written BEFORE the money moves. If this write fails nothing has happened and the
  // request fails; if everything after Stripe fails, this row is the trace that a refund may exist
  // (the reconciliation cron then pulls the real state from Stripe).
  try {
    await recordAuditEvent(ctx, {
      action: "PAYMENT_REFUND_REQUESTED",
      targetType: "Payment",
      targetId: payment.id,
      metadata: {
        userId: payment.userId,
        amountMinor: requestedAmount,
        currency: payment.currency,
        idempotencyKey,
        refundedBeforeMinor: alreadyRefunded,
        paymentAmountMinor: payment.amountMinor,
        reason: input.reason?.slice(0, 500) ?? null,
      },
    });
  } catch (error) {
    logger.error(`[AdminRefund] Intent audit write failed for payment ${payment.id}; refund not sent:`, error);
    recordAlert('payment.refund_audit_failed', { paymentId: payment.id, action: "PAYMENT_REFUND_REQUESTED" });
    return fail(new PaymentError("Audit log is unavailable; the refund was NOT sent. Try again.", "AUDIT_UNAVAILABLE", 503));
  }

  let stripeRefund: Stripe.Refund;
  try {
    const stripe = getStripeClient(paymentKeySet(payment.metadata));
    stripeRefund = await stripe.refunds.create({
      payment_intent: payment.stripeIntentId!,
      amount: requestedAmount,
      ...(input.reason || input.stripeReason ? { reason: input.stripeReason ?? "requested_by_customer" } : {}),
      ...(input.reason ? { metadata: { adminReason: input.reason.slice(0, 500) } } : {}),
    }, { idempotencyKey });
  } catch (err: unknown) {
    logger.error(`[AdminRefund] Stripe API error for payment ${payment.id}:`, err);
    // Outcome unknown for network errors; the cron's refund sync settles it. Only the error class is recorded.
    await recordAuditBestEffort(ctx, {
      action: "PAYMENT_REFUND_FAILED",
      targetType: "Payment",
      targetId: payment.id,
      metadata: { idempotencyKey, amountMinor: requestedAmount, errorType: err instanceof Error ? err.name : "unknown" },
    });
    return fail(new PaymentProviderError("Stripe refund failed. Details are in the server log."));
  }

  // The local total is whatever Stripe says now, not "old total + this refund": a parallel refund (other
  // window, other admin) or a Dashboard refund is included, a failed one is not. The webhook for this
  // refund is then a no-op. Done BEFORE the final audit, so an audit failure cannot leave the ledger stale.
  const sync = await syncRefundsFromStripe({ paymentId: payment.id, admin: adminActor }, ctx);
  let totalRefunded = alreadyRefunded + requestedAmount;
  if (sync.ok) {
    totalRefunded = sync.data.refundedMinor;
  } else {
    logger.error(`[AdminRefund] Stripe refund created (${stripeRefund.id}) but the local ledger sync failed; the cron and the webhook will converge it:`, sync.error);
    recordAlert('payment.refund_sync_failed', { paymentId: payment.id });
  }

  await recordAuditBestEffort(ctx, {
    action: "PAYMENT_REFUNDED",
    targetType: "Payment",
    targetId: payment.id,
    metadata: {
      userId: payment.userId,
      amountMinor: requestedAmount,
      currency: payment.currency,
      totalRefundedMinor: totalRefunded,
      paymentAmountMinor: payment.amountMinor,
      stripeRefundId: stripeRefund.id,
      stripeRefundStatus: stripeRefund.status ?? null,
      reason: input.reason?.slice(0, 500) ?? null,
      stripeReason: input.stripeReason ?? null,
      idempotencyKey,
      ledgerSynced: sync.ok,
      before: { status: statusBefore, refundedAmountMinor: alreadyRefunded },
      after: { refundedAmountMinor: totalRefunded },
    },
  });

  // The refund exists at Stripe, so the admin gets success even when the local sync lags: reporting an
  // error would invite a second click (same key, so harmless) and hide that the money moved.
  return ok({
    stripeRefundId: stripeRefund.id,
    amountMinor: requestedAmount,
    status: stripeRefund.status ?? "succeeded",
  });
}
