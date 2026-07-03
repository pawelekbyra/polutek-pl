import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";

// Regions whose local currency we support directly.
const REGION_CURRENCY: Record<string, SupportedCurrency> = {
  PL: "PLN",
  GB: "GBP",
  UK: "GBP",
  US: "USD",
  CH: "CHF",
  LI: "CHF",
};

// Eurozone members → EUR. Not exhaustive of the EU, only currency-union members.
const EUROZONE = new Set([
  "AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV",
  "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
]);

function currencyForRegion(region: string | undefined): SupportedCurrency | null {
  if (!region) return null;
  const upper = region.toUpperCase();
  if (REGION_CURRENCY[upper]) return REGION_CURRENCY[upper];
  if (EUROZONE.has(upper)) return "EUR";
  return null;
}

/**
 * Best-effort default currency for the support box, used only to pre-select the switcher.
 * Polish UI always defaults to PLN. For the English UI we infer from the browser locale's
 * region (and, failing that, the timezone), falling back to USD. The user can always override
 * via the currency switcher.
 */
export function detectDefaultCurrency(language: "pl" | "en"): SupportedCurrency {
  if (language === "pl") return "PLN";
  if (typeof navigator === "undefined") return "USD";

  const locales = [navigator.language, ...(navigator.languages ?? [])].filter(Boolean);
  for (const locale of locales) {
    // e.g. "en-GB" → region "GB"; also handle "en" with no region.
    const region = locale.includes("-") ? locale.split("-").pop() : undefined;
    const byRegion = currencyForRegion(region);
    if (byRegion) return byRegion;
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (tz.startsWith("Europe/London")) return "GBP";
    if (tz.startsWith("Europe/Zurich")) return "CHF";
    if (tz.startsWith("Europe/")) return "EUR";
  } catch {
    // ignore — fall through to USD
  }

  return "USD";
}

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}
