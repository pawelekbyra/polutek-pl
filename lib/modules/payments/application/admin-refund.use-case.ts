import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentError, PaymentProviderError } from "../domain/payment.errors";
import { handleRefund } from "./handle-refund.use-case";
import { logger } from "@/lib/logger";
import { PaymentStatus } from "@prisma/client";
import Stripe from "stripe";

export interface AdminRefundInput {
  paymentId: string;
  amountMinor?: number; // undefined = full refund
  reason?: string;
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

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is missing");
  return new Stripe(key, { apiVersion: "2024-12-18.acacia" as any });
}

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
    const stripe = getStripe();
    stripeRefund = await stripe.refunds.create({
      payment_intent: payment.stripeIntentId,
      amount: requestedAmount,
      ...(input.reason ? { reason: "requested_by_customer" } : {}),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[AdminRefund] Stripe API error for payment ${payment.id}:`, err);
    return fail(new PaymentProviderError(`Stripe refund failed: ${msg}`));
  }

  // Apply refund in DB immediately — webhook is idempotent via CAS and will be a no-op
  const newTotalRefunded = alreadyRefunded + requestedAmount;
  const refundResult = await handleRefund(
    { paymentId: payment.id, reportedRefundedMinor: newTotalRefunded },
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
