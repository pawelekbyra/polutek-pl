import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentError, PaymentProviderError } from "../domain/payment.errors";
import { handleDispute } from "./handle-dispute.use-case";
import { logger } from "@/lib/logger";
import Stripe from "stripe";

export interface AdminDisputeSyncInput {
  paymentId: string;
}

export interface AdminDisputeSyncResult {
  disputeId: string | null;
  disputeStatus: string | null;
  synced: boolean;
  message: string;
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is missing");
  return new Stripe(key, { apiVersion: "2024-12-18.acacia" as any });
}

function mapStripeDisputeStatus(status: string): {
  mappedStatus: string;
  isLost: boolean;
  isWon: boolean;
} {
  switch (status) {
    case "lost":
      return { mappedStatus: "chargeback_lost", isLost: true, isWon: false };
    case "won":
      return { mappedStatus: "chargeback_won", isLost: false, isWon: true };
    case "warning_needs_response":
    case "warning_under_review":
    case "warning_closed":
      return { mappedStatus: "warning", isLost: false, isWon: false };
    case "needs_response":
      return { mappedStatus: "needs_response", isLost: false, isWon: false };
    case "under_review":
      return { mappedStatus: "under_review", isLost: false, isWon: false };
    default:
      return { mappedStatus: status, isLost: false, isWon: false };
  }
}

export async function adminDisputeSync(
  input: AdminDisputeSyncInput,
  ctx: AppContext
): Promise<UseCaseResult<AdminDisputeSyncResult, PaymentError>> {
  const repo = new PaymentRepository();

  const payment = await repo.findById(input.paymentId, ctx.db.read);
  if (!payment) {
    return fail(new PaymentError(`Payment ${input.paymentId} not found`, "PAYMENT_NOT_FOUND", 404));
  }

  if (!payment.stripeIntentId) {
    return fail(
      new PaymentError(
        `Payment ${payment.id} has no Stripe intent ID; cannot sync dispute`,
        "PAYMENT_NO_STRIPE_INTENT",
        422
      )
    );
  }

  let dispute: Stripe.Dispute | null = null;
  try {
    const stripe = getStripe();
    const charges = await stripe.charges.list({ payment_intent: payment.stripeIntentId, limit: 1 });
    const charge = charges.data[0];

    if (!charge) {
      return ok({ disputeId: null, disputeStatus: null, synced: false, message: "No charges found for this payment intent" });
    }

    if (!charge.dispute) {
      return ok({ disputeId: null, disputeStatus: null, synced: false, message: "No dispute found for this payment" });
    }

    const disputeId = typeof charge.dispute === "string" ? charge.dispute : charge.dispute.id;
    dispute = await stripe.disputes.retrieve(disputeId);
  } catch (err: any) {
    logger.error(`[AdminDisputeSync] Stripe API error for payment ${payment.id}:`, err);
    return fail(new PaymentProviderError(`Stripe dispute fetch failed: ${err.message}`));
  }

  const { mappedStatus, isLost, isWon } = mapStripeDisputeStatus(dispute.status);

  const syncResult = await handleDispute(
    {
      stripeIntentId: payment.stripeIntentId,
      disputeId: dispute.id,
      status: mappedStatus,
      isLost,
      isWon,
    },
    ctx
  );

  if (!syncResult.ok) {
    logger.error(`[AdminDisputeSync] handleDispute failed for payment ${payment.id}:`, syncResult.error);
    return fail(syncResult.error);
  }

  return ok({
    disputeId: dispute.id,
    disputeStatus: dispute.status,
    synced: true,
    message: `Dispute ${dispute.id} synced (status: ${dispute.status})`,
  });
}
