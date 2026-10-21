import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  computeFundraisingProgress,
  hasFundraisingBar,
  manualFundraisingProgress,
  type CurrencyTotal,
  type FundraisingGoalFields,
} from "../domain/fundraising";

/** A successful tip that still counts: fully kept, or kept minus the refunded part. */
/** experiment: premium-pass: `PAYMENT_PURPOSE_PREMIUM_PASS` of the payments module (not imported: its barrel would pull Stripe into the video module). */
const PATRON_PAYMENT_PURPOSE = "premium_pass";

const COUNTED_STATUSES = [PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED];

/**
 * Totals are cached per instance for a minute: the home page is force-dynamic,
 * and the bar doesn't need to move on every request. Concurrent callers share
 * the in-flight query. Only aggregate sums are cached, no viewer data.
 */
const TOTALS_TTL_MS = 60_000;
const totalsCache = new Map<string, { expiresAt: number; promise: Promise<CurrencyTotal[]> }>();

export function __resetFundraisingTotalsCacheForTests() {
  totalsCache.clear();
}

async function queryTipTotals(startAt: Date | null, creatorId: string | null): Promise<CurrencyTotal[]> {
  const where = {
    status: { in: COUNTED_STATUSES },
    ...(startAt ? { createdAt: { gte: startAt } } : {}),
    // Single-channel app: the channel's tips, plus old rows saved before creatorId existed.
    ...(creatorId ? { OR: [{ creatorId }, { creatorId: null }] } : {}),
  };
  const [rows, patronRows] = await Promise.all([
    prisma.payment.groupBy({ by: ["currency"], where, _sum: { amountMinor: true, refundedAmountMinor: true } }),
    // experiment: premium-pass (docs/experiments/premium-pass.md): payments for the patron zone are sales, not tips,
    // so they do not fill the tip bar. Selected by their marker and subtracted (a JSON "not equal" would also drop
    // the old rows that have no marker at all).
    prisma.payment.groupBy({
      by: ["currency"],
      where: { ...where, metadata: { path: ["purpose"], equals: PATRON_PAYMENT_PURPOSE } },
      _sum: { amountMinor: true, refundedAmountMinor: true },
    }),
  ]);
  const patronNet = new Map(patronRows.map((row) => [row.currency, (row._sum.amountMinor ?? 0) - (row._sum.refundedAmountMinor ?? 0)]));
  return rows.map((row) => ({
    currency: row.currency,
    netMinor: (row._sum.amountMinor ?? 0) - (row._sum.refundedAmountMinor ?? 0) - (patronNet.get(row.currency) ?? 0),
  }));
}

export function loadTipTotals(startAt: Date | null, creatorId: string | null, now: number = Date.now()): Promise<CurrencyTotal[]> {
  const key = `${creatorId ?? "*"}|${startAt?.toISOString() ?? "all"}`;
  const cached = totalsCache.get(key);
  if (cached && cached.expiresAt > now) return cached.promise;
  const promise = queryTipTotals(startAt, creatorId);
  totalsCache.set(key, { expiresAt: now + TOTALS_TTL_MS, promise });
  promise.catch(() => totalsCache.delete(key));
  return promise;
}

type FundraisingRow = FundraisingGoalFields & { id: string; creatorId?: string | null };

/**
 * Fraction (0..1) of each video's bar, keyed by video id; videos without a bar
 * are absent. A hand-set fill (`fundraisingManualPercent`) wins and skips the
 * payment query. Never throws: on a database error the bar is simply hidden.
 */
export async function loadFundraisingProgress(rows: FundraisingRow[]): Promise<Map<string, number>> {
  const progress = new Map<string, number>();
  await Promise.all(
    rows.filter(hasFundraisingBar).map(async (row) => {
      const manual = manualFundraisingProgress(row);
      if (manual !== null) {
        progress.set(row.id, manual);
        return;
      }
      try {
        const totals = await loadTipTotals(row.fundraisingStartAt ?? null, row.creatorId ?? null);
        const fraction = computeFundraisingProgress(row, totals);
        if (fraction !== null) progress.set(row.id, fraction);
      } catch (error) {
        logger.error("[FUNDRAISING_PROGRESS_ERROR]", error);
      }
    }),
  );
  return progress;
}

/** Adds `fundraisingProgress` (0..1 or null) to public DTOs built from these rows. */
export async function withFundraisingProgress<T extends { id: string }>(
  dtos: T[],
  rows: FundraisingRow[],
): Promise<Array<T & { fundraisingProgress: number | null }>> {
  const progress = await loadFundraisingProgress(rows);
  return dtos.map((dto) => ({ ...dto, fundraisingProgress: progress.get(dto.id) ?? null }));
}
