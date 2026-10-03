import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentError, PaymentProviderError } from "../domain/payment.errors";
import { handleDispute } from "./handle-dispute.use-case";
import { logger } from "@/lib/logger";
import { recordAuditEvent } from "@/lib/modules/audit";
import Stripe from "stripe";
import { getStripeClient } from "../infrastructure/stripe-client";

export interface AdminDisputeSyncInput {
  paymentId: string;
}

export interface AdminDisputeSyncResult {
  disputeId: string | null;
  disputeStatus: string | null;
  synced: boolean;
  message: string;
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
    const stripe = getStripeClient();
    const charges = await stripe.charges.list({ payment_intent: payment.stripeIntentId, limit: 1 });
    const charge = charges.data[0];

    if (!charge) {
      return ok({ disputeId: null, disputeStatus: null, synced: false, message: "No charges found for this payment intent" });
    }

    const disputes = await stripe.disputes.list({ charge: charge.id, limit: 1 });
    if (!disputes.data[0]) {
      return ok({ disputeId: null, disputeStatus: null, synced: false, message: "No dispute found for this payment" });
    }
    dispute = disputes.data[0];
  } catch (err: unknown) {
    logger.error(`[AdminDisputeSync] Stripe API error for payment ${payment.id}:`, err);
    return fail(new PaymentProviderError("Stripe dispute fetch failed. Details are in the server log."));
  }

  // Stripe's raw status goes straight in: handleDispute classifies every status itself (mapping
  // warning_closed to a generic "warning" used to re-open a closed inquiry).
  const syncResult = await handleDispute(
    {
      stripeIntentId: payment.stripeIntentId,
      disputeId: dispute.id,
      status: dispute.status,
    },
    ctx
  );

  if (!syncResult.ok) {
    logger.error(`[AdminDisputeSync] handleDispute failed for payment ${payment.id}:`, syncResult.error);
    return fail(syncResult.error);
  }

  try {
    await recordAuditEvent(ctx, {
      action: "PAYMENT_DISPUTE_SYNCED",
      targetType: "Payment",
      targetId: payment.id,
      metadata: { disputeId: dispute.id, disputeStatus: dispute.status, outcome: syncResult.data.outcome, changed: syncResult.data.changed },
    });
  } catch (err) {
    // The dispute is already applied; a failed audit write must not report it as failed.
    logger.error(`[AdminDisputeSync] Audit write failed for payment ${payment.id}:`, err);
  }

  return ok({
    disputeId: dispute.id,
    disputeStatus: dispute.status,
    synced: true,
    message: `Dispute ${dispute.id} synced (status: ${dispute.status})`,
  });
}
