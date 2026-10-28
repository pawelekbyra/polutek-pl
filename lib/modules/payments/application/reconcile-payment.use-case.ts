import { PaymentStatus } from "@prisma/client";
import Stripe from "stripe";
import { AppContext } from "@/lib/modules/shared/app-context";
import { logger } from "@/lib/logger";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { getStripeClient } from "../infrastructure/stripe-client";
import { fulfillPayment } from "./fulfill-payment.use-case";
import { paymentKeySet, stripeSecretKeyFor } from "@/lib/payments/stripe-key-sets";

/** An unpaid tip older than this is treated as abandoned: its intent is canceled. */
export const ABANDONED_PAYMENT_AFTER_MS = 24 * 60 * 60 * 1000;

/** Payments older than this are recorded without a (very late) thank-you e-mail. */
const THANK_YOU_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Intent states in which nothing has been paid yet and the payer may still act. */
const UNPAID_OPEN_STATES: ReadonlySet<Stripe.PaymentIntent.Status> = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
]);

export type ReconcileResult = "fulfilled" | "canceled" | "unchanged" | "errors";

/**
 * Brings one local payment in line with its PaymentIntent (used by the reconciliation cron).
 * Never trusts the local status over Stripe's: a FAILED/CANCELED row whose intent succeeded is
 * still fulfilled.
 */
export async function reconcilePaymentWithStripe(
  payment: { id: string; status: PaymentStatus; stripeIntentId: string | null; createdAt: Date; metadata?: unknown },
  ctx: AppContext,
): Promise<ReconcileResult> {
  const repo = new PaymentRepository();
  const age = ctx.now().getTime() - payment.createdAt.getTime();
  const abandoned = age > ABANDONED_PAYMENT_AFTER_MS;

  try {
    if (!payment.stripeIntentId) {
      // Intent creation never finished (crash between the two writes): nothing to pay.
      if (abandoned && payment.status === PaymentStatus.PENDING) {
        await repo.markUnpaidPaymentCanceled(payment.id, ctx.prisma);
        return "canceled";
      }
      return "unchanged";
    }

    // Each payment is read with the key set it was created with (a test-mode premium intent read with the live key
    // would be "unknown to Stripe"). If that set is not configured any more (the owner went back to demo), the
    // payment cannot be asked about: it is left alone, and an abandoned unpaid row is closed locally.
    const keySet = paymentKeySet(payment.metadata);
    if (keySet === "premium" && !stripeSecretKeyFor(keySet)) {
      if (abandoned && payment.status === PaymentStatus.PENDING) {
        logger.warn(`[ReconcilePayment] Payment ${payment.id} belongs to the ${keySet} Stripe key set, which is not configured; canceling the abandoned row.`);
        const count = await repo.markUnpaidPaymentCanceled(payment.id, ctx.prisma);
        return count > 0 ? "canceled" : "unchanged";
      }
      return "unchanged";
    }
    const stripe = getStripeClient(keySet);
    const intent = await stripe.paymentIntents.retrieve(payment.stripeIntentId);

    if (intent.status === "succeeded") {
      const result = await fulfillPayment({
        paymentId: payment.id,
        stripeIntentId: intent.id,
        metadataUserId: intent.metadata?.userId ?? null,
        amountMinor: intent.amount,
        currency: intent.currency,
        notifyPayer: age <= THANK_YOU_WINDOW_MS,
      }, ctx);
      if (!result.ok) {
        logger.error(`[ReconcilePayment] fulfillPayment failed for ${payment.id}: ${result.error.message}`);
        return "errors";
      }
      if (result.data.isFirstFulfillment) {
        logger.info(`[ReconcilePayment] Recorded payment ${payment.id} (was ${payment.status}; Stripe succeeded).`);
        return "fulfilled";
      }
      return "unchanged";
    }

    if (intent.status === "canceled") {
      const count = await repo.markUnpaidPaymentCanceled(payment.id, ctx.prisma);
      return count > 0 ? "canceled" : "unchanged";
    }

    if (abandoned && UNPAID_OPEN_STATES.has(intent.status)) {
      // Close the abandoned intent in Stripe too, so it can't be paid later on a stale screen.
      await stripe.paymentIntents.cancel(intent.id, { cancellation_reason: "abandoned" });
      const count = await repo.markUnpaidPaymentCanceled(payment.id, ctx.prisma);
      logger.info(`[ReconcilePayment] Canceled abandoned intent for payment ${payment.id} (${intent.status}).`);
      return count > 0 ? "canceled" : "unchanged";
    }

    // processing / requires_capture / still fresh: leave it for the next run.
    return "unchanged";
  } catch (error) {
    // An abandoned row whose intent Stripe does not know at all (typically a test-mode intent read with a
    // live key after going live) can never be resolved by retrying; left PENDING it would occupy a slot in
    // every batch (oldest first) and eventually starve real payments. A later ?scope=recover run still
    // re-checks CANCELED rows, so a wrong-key mistake is recoverable.
    if (abandoned && payment.status === PaymentStatus.PENDING && (error as { code?: string } | null)?.code === "resource_missing") {
      logger.warn(`[ReconcilePayment] Intent of payment ${payment.id} is unknown to Stripe (other mode or deleted); canceling the abandoned row.`);
      const count = await repo.markUnpaidPaymentCanceled(payment.id, ctx.prisma);
      return count > 0 ? "canceled" : "unchanged";
    }
    logger.error(`[ReconcilePayment] Error reconciling payment ${payment.id}:`, error);
    return "errors";
  }
}
