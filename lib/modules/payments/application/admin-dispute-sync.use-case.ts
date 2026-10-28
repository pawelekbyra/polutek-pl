import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentError, PaymentProviderError } from "../domain/payment.errors";
import { handleDispute } from "./handle-dispute.use-case";
import { logger } from "@/lib/logger";
import { recordAuditEvent } from "@/lib/modules/audit";
import Stripe from "stripe";
import { getStripeClient } from "../infrastructure/stripe-client";
import { paymentKeySet } from "@/lib/payments/stripe-key-sets";

export interface AdminDisputeSyncInput {
  paymentId: string;
}

export interface AdminDisputeSyncResult {
  disputeId: string | null;
  disputeStatus: string | null;
  synced: boolean;
  message: string;
  /** When the evidence must be submitted in Stripe (ISO), if Stripe says so. */
  evidenceDueBy?: string | null;
  reason?: string | null;
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
    const stripe = getStripeClient(paymentKeySet(payment.metadata));
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

  // Keep the facts the panel's dispute list needs (deadline, reason) on the payment: webhooks only
  // carry the status, so this is the one place they are stored.
  const dueBy = dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : null;
  try {
    const current = (payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata) ? payment.metadata : {}) as Record<string, unknown>;
    await ctx.prisma.payment.update({
      where: { id: payment.id },
      data: { metadata: { ...current, dispute: { id: dispute.id, status: dispute.status, reason: dispute.reason ?? null, dueBy, amount: dispute.amount, currency: dispute.currency, syncedAt: ctx.now().toISOString() } } as never },
    });
  } catch (err) {
    logger.error(`[AdminDisputeSync] Could not store dispute details for payment ${payment.id}:`, err);
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
    evidenceDueBy: dueBy,
    reason: dispute.reason ?? null,
    message: `Dispute ${dispute.id} synced (status: ${dispute.status})`,
  });
}
