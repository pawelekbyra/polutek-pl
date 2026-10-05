import { PaymentStatus } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { logger } from "@/lib/logger";
import { syncRefundsFromStripe } from "./sync-refunds.use-case";

/** Payments whose money was received and can still gain or lose refunds at Stripe. */
const REFUND_CHECK_STATUSES: PaymentStatus[] = [
  PaymentStatus.SUCCEEDED,
  PaymentStatus.PARTIALLY_REFUNDED,
  PaymentStatus.REFUNDED,
  PaymentStatus.DISPUTED,
];

/** Each payment is re-checked at most this often (the cron runs every 15 minutes). */
export const REFUND_RECHECK_AFTER_MS = 6 * 60 * 60 * 1000;
/** Refunds are possible for months (cards: 180 days; some local methods longer); older payments are not polled. */
export const REFUND_CHECK_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
/** Stripe calls per cron run; with a 6 h recheck interval this covers ~2400 payments a day. */
export const REFUND_CHECK_BATCH = 25;

export interface RefundReconcileResult {
  checked: number;
  /** Payments whose local refund total was changed to match Stripe (a missed webhook, a Dashboard refund, a failed refund). */
  corrected: number;
  errors: number;
}

/**
 * Safety net for the refund ledger (PA-04), next to the refund webhooks: asks Stripe for the refunds of the
 * payments that have not been checked for longest (never checked first) and brings the local total in line.
 * One failing payment never stops the batch.
 */
export async function reconcileRefundsWithStripe(ctx: AppContext): Promise<RefundReconcileResult> {
  const now = ctx.now();
  const payments = await ctx.db.read.payment.findMany({
    where: {
      status: { in: REFUND_CHECK_STATUSES },
      stripeIntentId: { not: null },
      createdAt: { gt: new Date(now.getTime() - REFUND_CHECK_WINDOW_MS) },
      OR: [{ refundsCheckedAt: null }, { refundsCheckedAt: { lt: new Date(now.getTime() - REFUND_RECHECK_AFTER_MS) } }],
    },
    orderBy: { refundsCheckedAt: { sort: "asc", nulls: "first" } },
    take: REFUND_CHECK_BATCH,
    select: { id: true },
  });

  const result: RefundReconcileResult = { checked: 0, corrected: 0, errors: 0 };
  for (const { id } of payments) {
    result.checked++;
    const sync = await syncRefundsFromStripe({ paymentId: id }, ctx);
    if (!sync.ok) {
      result.errors++;
    } else if (sync.data.deltaMinor !== 0) {
      result.corrected++;
      logger.warn(`[ReconcileRefunds] Payment ${id}: local refund total corrected by ${sync.data.deltaMinor} to ${sync.data.refundedMinor} (Stripe is the source of truth).`);
    }
  }
  return result;
}
