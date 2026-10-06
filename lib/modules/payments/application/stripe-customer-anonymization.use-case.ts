import Stripe from "stripe";
import { AppContext } from "@/lib/modules/shared/app-context";
import { DbClient, WriteTx } from "@/lib/modules/shared/db";
import { recordAuditEvent } from "@/lib/modules/audit";
import { recordAlert } from "@/lib/observability";
import { logger } from "@/lib/logger";
import { getStripeClient } from "../infrastructure/stripe-client";

const HOUR_MS = 60 * 60 * 1000;
/** Retry backoff after a failed update: 1 h, 2 h, 4 h ... capped at one day (same backoff as other retry queues). */
const MAX_BACKOFF_MS = 24 * HOUR_MS;
const BATCH_LIMIT = 50;
/** After this many failures the stuck row raises an alert (it keeps being retried daily). */
const ALERT_AFTER_ATTEMPTS = 5;

export function stripeCustomerAnonymizationBackoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, HOUR_MS * 2 ** Math.max(0, attempts - 1));
}

/**
 * The personal fields erased on the Stripe Customer. The Customer object itself stays, so the PaymentIntents
 * and charges that reference it keep their link (accounting and anti-fraud records are Stripe's and ours to
 * keep); only the identifiers go. An empty string unsets a field in the Stripe API
 * (https://docs.stripe.com/api/customers/update: "Individual keys can be unset by posting an empty value").
 */
export const ANONYMIZED_CUSTOMER_PARAMS: Stripe.CustomerUpdateParams = {
  email: "",
  name: "",
  phone: "",
  description: "",
  metadata: { userId: "" },
};

/**
 * Queues the erasure of these Stripe Customers' personal data. Runs inside the account-deletion
 * transaction, so deleting an account never depends on Stripe being reachable.
 */
export async function enqueueStripeCustomerAnonymization(
  tx: WriteTx,
  entries: Array<{ stripeCustomerId: string | null | undefined; userId: string }>,
  now: Date,
): Promise<number> {
  let queued = 0;
  for (const entry of entries) {
    const id = entry.stripeCustomerId?.trim();
    if (!id) continue;
    await tx.stripeCustomerAnonymization.upsert({
      where: { stripeCustomerId: id },
      create: { stripeCustomerId: id, userId: entry.userId, nextAttemptAt: now },
      update: { nextAttemptAt: now },
    });
    queued++;
  }
  return queued;
}

export interface StripeCustomerAnonymizationRunResult {
  anonymized: number;
  alreadyGone: number;
  failed: number;
}

/**
 * Works off the queue: for every due row it clears e-mail, name, phone, description and the userId metadata
 * of the Customer in Stripe. Naturally idempotent (setting the same empty values again changes nothing), so
 * a retry after a timeout is safe. A Customer Stripe does not know (`resource_missing`: deleted there, or a
 * test-mode customer under a live key) counts as done. Failures stay queued with a backoff. Every success
 * leaves a STRIPE_CUSTOMER_ANONYMIZED audit row.
 */
export async function processStripeCustomerAnonymizations(
  ctx: AppContext,
  options: { stripeCustomerIds?: string[]; stripe?: Pick<Stripe, "customers"> } = {},
): Promise<StripeCustomerAnonymizationRunResult> {
  const db = ctx.prisma as DbClient;
  const now = ctx.now();
  const due = await db.stripeCustomerAnonymization.findMany({
    where: {
      nextAttemptAt: { lte: now },
      ...(options.stripeCustomerIds ? { stripeCustomerId: { in: options.stripeCustomerIds } } : {}),
    },
    orderBy: { nextAttemptAt: "asc" },
    take: BATCH_LIMIT,
  });

  const result: StripeCustomerAnonymizationRunResult = { anonymized: 0, alreadyGone: 0, failed: 0 };
  if (due.length === 0) return result;

  for (const row of due) {
    let outcome: "updated" | "not_found";
    try {
      const stripe = options.stripe ?? getStripeClient();
      try {
        await stripe.customers.update(row.stripeCustomerId, ANONYMIZED_CUSTOMER_PARAMS);
        outcome = "updated";
      } catch (error) {
        if ((error as { code?: string } | null)?.code !== "resource_missing") throw error;
        outcome = "not_found";
      }
    } catch (error) {
      const attempts = row.attempts + 1;
      const reason = error instanceof Error ? error.name : "unknown";
      await db.stripeCustomerAnonymization.updateMany({
        where: { id: row.id },
        data: { attempts, lastError: `STRIPE_UPDATE_FAILED:${reason}`, nextAttemptAt: new Date(now.getTime() + stripeCustomerAnonymizationBackoffMs(attempts)) },
      });
      logger.warn("[stripe-customer-anonymization] Stripe customer update failed, will retry", { attempts, reason });
      if (attempts >= ALERT_AFTER_ATTEMPTS) recordAlert("stripe.customer_anonymization_stuck", { attempts });
      result.failed += 1;
      continue;
    }

    await db.stripeCustomerAnonymization.deleteMany({ where: { id: row.id } });
    try {
      await recordAuditEvent(ctx, {
        action: "STRIPE_CUSTOMER_ANONYMIZED",
        targetType: "User",
        targetId: row.userId ?? row.stripeCustomerId,
        metadata: { stripeCustomerId: row.stripeCustomerId, outcome, attempts: row.attempts + 1 },
      });
    } catch (error) {
      // The erasure is done and the row gone; a missing audit row must not be retried as a Stripe call.
      logger.error("[stripe-customer-anonymization] audit write failed after a successful erasure", error);
    }
    if (outcome === "updated") result.anonymized += 1;
    else result.alreadyGone += 1;
  }
  return result;
}
