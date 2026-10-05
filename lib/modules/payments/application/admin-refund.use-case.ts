import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentError, PaymentProviderError } from "../domain/payment.errors";
import { handleRefund } from "./handle-refund.use-case";
import { logger } from "@/lib/logger";
import { PaymentStatus } from "@prisma/client";
import Stripe from "stripe";
import { getStripeClient } from "../infrastructure/stripe-client";
import { recordAuditEvent } from "@/lib/modules/audit";

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

export async function adminRefund(
  input: AdminRefundInput,
  ctx: AppContext
): Promise<UseCaseResult<AdminRefundResult, PaymentError>> {
  const repo = new PaymentRepository();

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

  if (!payment.stripeIntentId) {
    return fail(
      new PaymentError(
        `Payment ${payment.id} has no Stripe intent ID; cannot initiate refund`,
        "PAYMENT_NO_STRIPE_INTENT",
        422
      )
    );
  }

  const alreadyRefunded = payment.refundedAmountMinor ?? 0;
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

  let stripeRefund: Stripe.Refund;
  try {
    const stripe = getStripeClient();
    stripeRefund = await stripe.refunds.create({
      payment_intent: payment.stripeIntentId,
      amount: requestedAmount,
      ...(input.reason || input.stripeReason ? { reason: input.stripeReason ?? "requested_by_customer" } : {}),
      ...(input.reason ? { metadata: { adminReason: input.reason.slice(0, 500) } } : {}),
    }, {
      // A retried request (network error, double click) for the same refund state reuses the key,
      // so Stripe returns the first refund instead of refunding twice. Once that refund is recorded,
      // alreadyRefunded changes and a deliberate next refund gets a new key.
      idempotencyKey: input.idempotencyKey ? `refund-${payment.id}-${input.idempotencyKey}` : `refund-${payment.id}-${alreadyRefunded}-${requestedAmount}`,
    });
  } catch (err: unknown) {
    logger.error(`[AdminRefund] Stripe API error for payment ${payment.id}:`, err);
    return fail(new PaymentProviderError("Stripe refund failed. Details are in the server log."));
  }

  // The refund is in the audit log whatever happens next: the Stripe webhook may record the
  // amount first, which leaves nothing for handleRefund below to change.
  await recordAuditEvent(ctx, {
    action: "PAYMENT_REFUNDED",
    targetType: "Payment",
    targetId: payment.id,
    metadata: {
      userId: payment.userId,
      amountMinor: requestedAmount,
      currency: payment.currency,
      totalRefundedMinor: alreadyRefunded + requestedAmount,
      paymentAmountMinor: payment.amountMinor,
      stripeRefundId: stripeRefund.id,
      stripeRefundStatus: stripeRefund.status ?? null,
      reason: input.reason?.slice(0, 500) ?? null,
      stripeReason: input.stripeReason ?? null,
      before: { status: payment.status, refundedAmountMinor: alreadyRefunded },
      after: { refundedAmountMinor: alreadyRefunded + requestedAmount },
    },
  });

  // Apply refund in DB immediately — webhook is idempotent via CAS and will be a no-op
  const newTotalRefunded = alreadyRefunded + requestedAmount;
  const refundResult = await handleRefund(
    {
      paymentId: payment.id,
      reportedRefundedMinor: newTotalRefunded,
      admin: {
        refundedById: ctx.actor.type === "admin" ? ctx.actor.userId : "unknown",
        reason: input.reason ?? null,
      },
    },
    ctx
  );

  if (!refundResult.ok) {
    logger.error(`[AdminRefund] Stripe refund created (${stripeRefund.id}) but DB update failed:`, refundResult.error);
    return fail(refundResult.error);
  }

  return ok({
    stripeRefundId: stripeRefund.id,
    amountMinor: requestedAmount,
    status: stripeRefund.status ?? "succeeded",
  });
}
