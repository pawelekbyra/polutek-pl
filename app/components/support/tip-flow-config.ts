import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";
import { isPaymentMethodAvailableForCurrency, type TipPaymentMethod } from "@/lib/payments/checkout.schema";

/**
 * What the viewer picks on the "how" step. `wallet` is Apple Pay / Google Pay — Stripe charges it
 * as a card payment, so it maps to the `card` payment method on the server.
 */
export type TipMethodChoice = "blik" | "p24" | "card" | "wallet";

export type TipStep = "amount" | "method" | "pay";

export const TIP_CURRENCY_FLAGS: Record<SupportedCurrency, string> = {
  PLN: "🇵🇱",
  EUR: "🇪🇺",
  USD: "🇺🇸",
  GBP: "🇬🇧",
  CHF: "🇨🇭",
};

export const TIP_CURRENCIES = SUPPORTED_CURRENCIES;

// "Nice" local numbers per currency. Low → high: donors build up to a gift rather than feeling
// pushed to start high. The emoji are playful labels only — a tip never buys anything.
const BASE_PRESETS: Record<SupportedCurrency, number[]> = {
  PLN: [10, 20, 50, 100],
  EUR: [3, 5, 10, 25],
  USD: [3, 5, 10, 25],
  GBP: [3, 5, 10, 25],
  CHF: [3, 5, 10, 25],
};

export const TIP_PRESET_EMOJI = ["☕", "🍕", "🎬", "🚀"];

/** Presets at or above the currency's minimum; falls back to multiples of the minimum. */
export function getTipPresets(currency: SupportedCurrency, minAmount: number): number[] {
  const presets = BASE_PRESETS[currency].filter((value) => value >= minAmount);
  if (presets.length >= 3) return presets;
  return [1, 2, 5, 10].map((factor) => Math.ceil(minAmount * factor));
}

/** The preset highlighted when the step opens (the second one). */
export function getDefaultTipAmount(currency: SupportedCurrency, minAmount: number): number {
  const presets = getTipPresets(currency, minAmount);
  return presets[Math.min(1, presets.length - 1)];
}

export function toServerPaymentMethod(choice: TipMethodChoice): TipPaymentMethod {
  return choice === "wallet" ? "card" : choice;
}

/** Tiles for a currency, most local first. `wallet` only when the device supports one. */
export function getTipMethodChoices(currency: SupportedCurrency, walletAvailable: boolean): TipMethodChoice[] {
  const order: TipMethodChoice[] = currency === "PLN" ? ["blik", "p24", "card", "wallet"] : ["card", "wallet", "p24"];
  return order.filter((choice) => {
    if (choice === "wallet") return walletAvailable;
    return isPaymentMethodAvailableForCurrency(toServerPaymentMethod(choice), currency);
  });
}

export function formatTipAmount(amount: number, currency: SupportedCurrency, language: string): string {
  try {
    return new Intl.NumberFormat(language === "pl" ? "pl-PL" : "en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

const LAST_METHOD_KEY = "tip-last-method";

export function readLastTipMethod(): TipMethodChoice | null {
  try {
    const value = window.localStorage.getItem(LAST_METHOD_KEY);
    return value === "blik" || value === "p24" || value === "card" || value === "wallet" ? value : null;
  } catch {
    return null;
  }
}

export function rememberTipMethod(choice: TipMethodChoice) {
  try {
    window.localStorage.setItem(LAST_METHOD_KEY, choice);
  } catch {
    // A per-viewer convenience only.
  }
}
