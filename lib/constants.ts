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

function getConfiguredAdminEmail() {
  return process.env.ADMIN_EMAIL?.trim() || null;
}

export const ADMIN_EMAIL = getConfiguredAdminEmail() || "admin@example.local";

export const DISPLAY_EUR_TO_PLN_RATE = Number(process.env.DISPLAY_EUR_TO_PLN_RATE) || 4.3;

export const DISPLAY_USD_TO_PLN_RATE = (() => {
  const raw = process.env.DISPLAY_USD_TO_PLN_RATE;
  const parsed = Number(raw ?? 4.0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4.0;
})();

export const MAIN_CREATOR_NAME = process.env.MAIN_CREATOR_NAME || 'Configured Creator';
// PAWELPERFECT.PL is a strict single-channel app. Keep the env override, but use the
// seeded canonical slug as a safe production fallback so missing Vercel env does
// not break the public home page or admin video list at runtime.
export const MAIN_CREATOR_SLUG = process.env.MAIN_CREATOR_SLUG || 'polutek';
const configuredAppName = process.env.NEXT_PUBLIC_APP_NAME?.trim();
// Display brand string is "www.pawelperfect.com" (2026-09-30: new primary domain; was .pl; owner decision, 2026-08-01: lowercased from
// the earlier all-caps "WWW.PAWELPERFECT.PL") — matches the Stripe statement descriptor and is
// used site-wide (page titles, legal docs, email subjects). Normalize a bare
// "pawelperfect.pl"/"www.pawelperfect.pl" env override to the canonical form too, same as
// before; a genuinely different configured name still passes through untouched.
export const APP_NAME = !configuredAppName || /^(www\.)?pawelperfect\.(pl|com)$/i.test(configuredAppName)
  ? 'www.pawelperfect.com'
  : configuredAppName;
