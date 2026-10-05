import {
  DISPLAY_CHF_TO_PLN_RATE,
  DISPLAY_EUR_TO_PLN_RATE,
  DISPLAY_GBP_TO_PLN_RATE,
  DISPLAY_USD_TO_PLN_RATE,
} from "@/lib/constants";

export interface PaymentTotal {
  currency: string;
  amountMinor: number;
}

/** Approximate PLN per 1 unit of each currency the tip gate accepts (display only, never used for access). */
const PLN_RATES: Record<string, number> = {
  PLN: 1,
  EUR: DISPLAY_EUR_TO_PLN_RATE,
  USD: DISPLAY_USD_TO_PLN_RATE,
  CHF: DISPLAY_CHF_TO_PLN_RATE,
  GBP: DISPLAY_GBP_TO_PLN_RATE,
};

/** Sum of all totals in (approximate) PLN; a currency without a rate is skipped, never guessed. */
export function normalizePaymentTotals(paymentTotals: PaymentTotal[]): number {
  return paymentTotals.reduce((sum, total) => {
    const rate = PLN_RATES[total.currency.toUpperCase()];
    return rate === undefined ? sum : sum + (total.amountMinor / 100) * rate;
  }, 0);
}
