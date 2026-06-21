export const DEFAULT_AVATAR_URL = 'https://www.dicebear.com/api/avataaars/anonymous.svg';

export const MIN_PATRON_AMOUNT = 10; // EUR/USD/CHF
export const MIN_PATRON_AMOUNT_PLN = 10; // PLN

export const SUPPORTED_CURRENCIES = ["PLN", "EUR", "USD", "CHF", "GBP"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const MIN_PAYMENT_BY_CURRENCY: Record<SupportedCurrency, number> = {
  PLN: 10,
  EUR: 10,
  USD: 10,
  CHF: 10,
  GBP: 10, // Updated to 10 as per X1-FIX-003 owner decision
};

export const MAX_PAYMENT_BY_CURRENCY: Record<SupportedCurrency, number> = {
  PLN: 5000,
  EUR: 1000,
  USD: 1000,
  CHF: 1000,
  GBP: 1000,
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
// Polutek.pl is a strict single-channel app. Keep the env override, but use the
// seeded canonical slug as a safe production fallback so missing Vercel env does
// not break the public home page or admin video list at runtime.
export const MAIN_CREATOR_SLUG = process.env.MAIN_CREATOR_SLUG || 'polutek';
const configuredAppName = process.env.NEXT_PUBLIC_APP_NAME?.trim();
export const APP_NAME = !configuredAppName || configuredAppName.toLowerCase() === 'polutek.pl'
  ? 'Polutek.pl'
  : configuredAppName;
export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_URL
  ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname.toUpperCase().replace(/^(WWW\.)+/, '')
  : 'POLUTEK.PL';