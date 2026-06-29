import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok } from "@/lib/modules/shared/result";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentError } from "../domain/payment.errors";
import { logger } from "@/lib/logger";
import { recordAlert, recordMetric } from "@/lib/observability";
import { fulfillPayment } from "./fulfill-payment.use-case";
import Stripe from "stripe";

const PAYMENT_STATUS_PENDING = "PENDING" as const;
const PAYMENT_STATUS_FAILED = "FAILED" as const;

export interface StripeReconciliationResult {
  checked: number;
  fulfilled: number;
  failed: number;
  skipped: number;
}

// Only reconcile payments that have been pending for at least this long,
// giving normal webhook delivery time to process first.
const PENDING_STALENESS_MINUTES = 30;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is missing");
  return new Stripe(key, { apiVersion: "2024-12-18.acacia" as any });
}

export async function stripeReconciliation(
  ctx: AppContext
): Promise<UseCaseResult<StripeReconciliationResult, PaymentError>> {
  const repo = new PaymentRepository();
  const stripe = getStripe();

  const staleThreshold = new Date(Date.now() - PENDING_STALENESS_MINUTES * 60 * 1000);

  // Find stale PENDING payments that have a stripeIntentId (checkout completed but webhook missed)
  const stalePayments = await ctx.db.read.payment.findMany({
    where: {
      status: PAYMENT_STATUS_PENDING,
      stripeIntentId: { not: null },
      createdAt: { lt: staleThreshold },
    },
    select: {
      id: true,
      stripeIntentId: true,
      amountMinor: true,
      currency: true,
      userId: true,
    },
    take: 50,
  });

  let fulfilled = 0;
  let failed = 0;
  let skipped = 0;

  for (const payment of stalePayments) {
    if (!payment.stripeIntentId) {
      skipped++;
      continue;
    }

    try {
      const intent = await stripe.paymentIntents.retrieve(payment.stripeIntentId);

      if (intent.status === "succeeded") {
        const result = await fulfillPayment(
          {
            paymentId: payment.id,
            stripeIntentId: payment.stripeIntentId,
            amountMinor: payment.amountMinor,
            currency: payment.currency,
          },
          ctx
        );

        if (result.ok) {
          fulfilled++;
          logger.info(`[StripeReconciliation] Fulfilled stale payment ${payment.id}`);
          recordMetric("stripe_reconciliation.fulfilled");
        } else {
          failed++;
          logger.error(`[StripeReconciliation] Failed to fulfill payment ${payment.id}: ${result.error.message}`);
          recordAlert("stripe_reconciliation.fulfill_error", { paymentId: payment.id });
        }
      } else if (intent.status === "canceled") {
        await ctx.prisma.payment.updateMany({
          where: { id: payment.id, status: PAYMENT_STATUS_PENDING },
          data: { status: PAYMENT_STATUS_FAILED },
        });
        failed++;
        logger.info(`[StripeReconciliation] Marked payment ${payment.id} as FAILED (Stripe status: ${intent.status})`);
        recordMetric("stripe_reconciliation.failed");
      } else {
        // still processing or in another state — skip
        skipped++;
      }
    } catch (err: any) {
      logger.error(`[StripeReconciliation] Error reconciling payment ${payment.id}:`, err);
      recordAlert("stripe_reconciliation.error", { paymentId: payment.id, error: err.message });
      skipped++;
    }
  }

  return ok({ checked: stalePayments.length, fulfilled, failed, skipped });
}
