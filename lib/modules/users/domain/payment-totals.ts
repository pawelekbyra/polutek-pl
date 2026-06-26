import { DISPLAY_EUR_TO_PLN_RATE, DISPLAY_USD_TO_PLN_RATE } from "@/lib/constants";

export interface PaymentTotal {
  currency: string;
  amountMinor: number;
}

/**
 * Estimated lifetime total in PLN for display purposes.
 * Note: Access decisions must rely on active PatronGrant truth, not this normalized sum or legacy User.isPatron cache.
 */
export function normalizePaymentTotals(paymentTotals: PaymentTotal[]): number {
  const totalPLN = paymentTotals.find((t) => t.currency === 'PLN')?.amountMinor || 0;
  const totalEUR = paymentTotals.find((t) => t.currency === 'EUR')?.amountMinor || 0;
  const totalUSD = paymentTotals.find((t) => t.currency === 'USD')?.amountMinor || 0;

  // Using simple fixed rates for estimation; these are display-only and do not grant access.
  return (totalPLN / 100) +
         (totalEUR / 100 * DISPLAY_EUR_TO_PLN_RATE) +
         (totalUSD / 100 * DISPLAY_USD_TO_PLN_RATE);
}
