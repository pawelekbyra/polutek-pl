/**
 * Money arithmetic of a sale (stage 6). Pure, integer minor units only, no floats outside the rounding step.
 *
 * gross = what the buyer paid (VAT included, the platform is merchant of record)
 * vat   = the VAT part of gross (rate in basis points, 2300 = 23%)
 * net   = gross - vat
 * fee   = the platform's commission on net
 * share = net - fee, what the platform owes the channel
 *
 * Invariants (also enforced by a CHECK constraint on "Order"): gross = vat + net, net = fee + share, all >= 0.
 * Payment processor fees are not modelled here: they are a platform cost, covered by the commission.
 */
export type SaleSplit = {
  grossMinor: number;
  vatMinor: number;
  netMinor: number;
  platformFeeMinor: number;
  creatorShareMinor: number;
  vatRateBp: number;
  feeRateBp: number;
};

const isMinor = (n: number) => Number.isSafeInteger(n) && n >= 0;

export function splitSale(input: { grossMinor: number; vatRateBp: number; feeRateBp: number }): SaleSplit {
  const { grossMinor, vatRateBp, feeRateBp } = input;
  if (!isMinor(grossMinor)) throw new RangeError("grossMinor must be a non-negative integer");
  if (!isMinor(vatRateBp) || vatRateBp > 30_000) throw new RangeError("vatRateBp out of range");
  if (!isMinor(feeRateBp) || feeRateBp > 10_000) throw new RangeError("feeRateBp out of range");
  const vatMinor = Math.round((grossMinor * vatRateBp) / (10_000 + vatRateBp));
  const netMinor = grossMinor - vatMinor;
  const platformFeeMinor = Math.round((netMinor * feeRateBp) / 10_000);
  const creatorShareMinor = netMinor - platformFeeMinor;
  return { grossMinor, vatMinor, netMinor, platformFeeMinor, creatorShareMinor, vatRateBp, feeRateBp };
}

/**
 * The part of the channel's share to take back when `refundedBefore` of `grossMinor` was already refunded and
 * `refundNow` more is refunded. Computed on cumulative amounts so that any sequence of partial refunds sums to
 * exactly the creator share when the order is fully refunded (no cent is lost to rounding).
 */
export function creatorShareReversal(args: { grossMinor: number; creatorShareMinor: number; refundedBefore: number; refundNow: number }): number {
  const { grossMinor, creatorShareMinor, refundedBefore, refundNow } = args;
  if (grossMinor <= 0) return 0;
  if (!isMinor(refundedBefore) || !isMinor(refundNow) || refundedBefore + refundNow > grossMinor) {
    throw new RangeError("refund exceeds what is left to refund");
  }
  const cumulative = (refunded: number) => Math.round((creatorShareMinor * refunded) / grossMinor);
  return cumulative(refundedBefore + refundNow) - cumulative(refundedBefore);
}

export function payoutAvailableAt(paidAt: Date, holdDays: number): Date {
  return new Date(paidAt.getTime() + Math.max(0, Math.trunc(holdDays)) * 86_400_000);
}

export type PriceSpec = { currency: string; amountMinor: number; payWhatYouWant: boolean; minAmountMinor: number | null };

/** Smallest amount that makes sense to charge (payment processors reject less); one unit of the currency. */
export const MIN_CHARGE_MINOR = 100;
export const MAX_CHARGE_MINOR = 1_000_000;

/** The amount a buyer is charged: fixed price, or the amount chosen by the buyer within the allowed range. */
export function resolveChargeAmount(price: PriceSpec, chosenMinor?: number): { ok: true; amountMinor: number } | { ok: false; code: "AMOUNT_TOO_LOW" | "AMOUNT_TOO_HIGH" | "AMOUNT_INVALID" } {
  if (!price.payWhatYouWant) return { ok: true, amountMinor: price.amountMinor };
  if (chosenMinor === undefined || !isMinor(chosenMinor)) return { ok: false, code: "AMOUNT_INVALID" };
  const floor = Math.max(price.minAmountMinor ?? price.amountMinor, MIN_CHARGE_MINOR);
  if (chosenMinor < floor) return { ok: false, code: "AMOUNT_TOO_LOW" };
  if (chosenMinor > MAX_CHARGE_MINOR) return { ok: false, code: "AMOUNT_TOO_HIGH" };
  return { ok: true, amountMinor: chosenMinor };
}
