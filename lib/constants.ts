export const DEFAULT_AVATAR_URL = 'https://www.dicebear.com/api/avataaars/anonymous.svg';

export const MIN_PATRON_AMOUNT = 5; // EUR/USD
export const MIN_PATRON_AMOUNT_PLN = 20; // PLN

export const SUPPORTED_CURRENCIES = ["PLN", "EUR", "USD"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const MIN_PAYMENT_BY_CURRENCY: Record<SupportedCurrency, number> = {
  PLN: 20,
  EUR: 5,
  USD: 5,
};

export const MAX_PAYMENT_BY_CURRENCY: Record<SupportedCurrency, number> = {
  PLN: 5000,
  EUR: 1000,
  USD: 1000,
};

export function getConfiguredAdminEmail() {
  return process.env.ADMIN_EMAIL?.trim() || null;
}

export function requireConfiguredAdminEmail() {
  const value = getConfiguredAdminEmail();

  if (!value) {
    throw new Error("CRITICAL: ADMIN_EMAIL environment variable is not set.");
  }

  return value;
}

export const ADMIN_EMAIL = getConfiguredAdminEmail() || "admin@example.local";

export const DISPLAY_EUR_TO_PLN_RATE = Number(process.env.DISPLAY_EUR_TO_PLN_RATE) || 4.3;

export const DISPLAY_USD_TO_PLN_RATE = (() => {
  const raw = process.env.DISPLAY_USD_TO_PLN_RATE;
  const parsed = Number(raw ?? 4.0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4.0;
})();

export const MAIN_CREATOR_NAME = process.env.MAIN_CREATOR_NAME || 'Configured Creator';
export const MAIN_CREATOR_SLUG = process.env.MAIN_CREATOR_SLUG || 'main-creator';
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Polutek.pl';
export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname.toUpperCase() : 'POLUTEK.PL';
