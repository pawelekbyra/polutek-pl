/**
 * ONE definition of revenue (admin-panel.md F1), used by Przychody, Dzisiaj and the CSV:
 *   revenue = tips with status SUCCEEDED or PARTIALLY_REFUNDED, counted at amountMinor - refundedAmountMinor.
 * PENDING, FAILED, CANCELED never count; DISPUTED (money held by the bank), REFUNDED (fully returned) and
 * CHARGEBACK_LOST are shown separately and are not revenue. Gross = amountMinor of the same rows. Stripe fees
 * are NOT subtracted (we do not store balance_transaction fees), so "net" means net of refunds.
 */
import { minorToPln, netMinor, REVENUE_STATUSES } from "@/lib/modules/admin-overview";

export type PaymentFact = { amountMinor: number; refundedAmountMinor: number; currency: string; status: string; createdAt: Date };

export type RevenueByCurrency = { currency: string; grossMinor: number; refundedMinor: number; netMinor: number; count: number };
export type RevenueSummary = {
  byCurrency: RevenueByCurrency[];
  count: number;
  netPln: number;
  /** Currencies without a display rate: listed, not guessed. */
  unconvertedCurrencies: string[];
  medianPln: number | null;
  refundCount: number;
  refundedPln: number;
  disputed: number;
  chargebackLost: number;
};

const isRevenue = (s: string) => (REVENUE_STATUSES as readonly string[]).includes(s);

export function summarizeRevenue(rows: PaymentFact[]): RevenueSummary {
  const map = new Map<string, RevenueByCurrency>();
  const nets: number[] = [];
  let netPln = 0;
  let refundedPln = 0;
  let refundCount = 0;
  const unconverted = new Set<string>();
  for (const r of rows) {
    if (r.refundedAmountMinor > 0) refundCount += 1;
    if (!isRevenue(r.status)) continue;
    const cur = r.currency.toUpperCase();
    const e = map.get(cur) ?? { currency: cur, grossMinor: 0, refundedMinor: 0, netMinor: 0, count: 0 };
    e.grossMinor += r.amountMinor;
    e.refundedMinor += r.refundedAmountMinor;
    e.netMinor += netMinor(r);
    e.count += 1;
    map.set(cur, e);
    const pln = minorToPln(netMinor(r), cur);
    if (pln === null) unconverted.add(cur);
    else {
      netPln += pln;
      nets.push(pln);
    }
    const refundedInPln = minorToPln(r.refundedAmountMinor, cur);
    if (refundedInPln !== null) refundedPln += refundedInPln;
  }
  nets.sort((a, b) => a - b);
  const mid = Math.floor(nets.length / 2);
  const medianPln = nets.length === 0 ? null : nets.length % 2 ? nets[mid] : (nets[mid - 1] + nets[mid]) / 2;
  return {
    byCurrency: [...map.values()].sort((a, b) => b.netMinor - a.netMinor),
    count: [...map.values()].reduce((n, e) => n + e.count, 0),
    netPln,
    unconvertedCurrencies: [...unconverted],
    medianPln,
    refundCount,
    refundedPln,
    disputed: rows.filter((r) => r.status === "DISPUTED").length,
    chargebackLost: rows.filter((r) => r.status === "CHARGEBACK_LOST").length,
  };
}

/** Money math for the refund dialog: "12,50" -> 1250 minor units; null when not a valid positive amount with <= 2 decimals. */
export function parseMoneyToMinor(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const minor = Math.round(Number(s) * 100);
  return minor > 0 && Number.isSafeInteger(minor) ? minor : null;
}

export const STRIPE_ID = /^(pi|ch|re|dp)_[A-Za-z0-9]{6,}$/;

/** "Zobacz w Stripe": a dashboard link for a Stripe object id; mode from the key prefix (test objects live under /test). */
export function stripeDashboardUrl(id: string | null | undefined, live: boolean | null): string | null {
  if (!id || !STRIPE_ID.test(id)) return null;
  const kind = id.startsWith("dp_") ? "disputes" : id.startsWith("re_") ? "refunds" : "payments";
  return `https://dashboard.stripe.com/${live === false ? "test/" : ""}${kind}/${id}`;
}
