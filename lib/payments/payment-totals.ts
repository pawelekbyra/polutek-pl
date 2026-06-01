import { DISPLAY_EUR_TO_PLN_RATE } from "../constants";

export type PaymentTotalInput = {
  currency: string;
  amountMinor: number;
};

/**
 * Normalizes payment totals to PLN for display and diagnostics.
 * Logic:
 * - PLN is 1:1
 * - EUR is converted using DISPLAY_EUR_TO_PLN_RATE
 * - Other currencies (e.g. USD) are treated as EUR for now as a fallback or ignored
 */
export function normalizePaymentTotalsToPln(paymentTotals: PaymentTotalInput[]): number {
  const totalPLN = paymentTotals.find((t) => t.currency === 'PLN')?.amountMinor || 0;
  const totalEUR = paymentTotals.find((t) => t.currency === 'EUR')?.amountMinor || 0;
  const totalUSD = paymentTotals.find((t) => t.currency === 'USD')?.amountMinor || 0;

  return (totalPLN / 100) + ((totalEUR + totalUSD) / 100 * DISPLAY_EUR_TO_PLN_RATE);
}
