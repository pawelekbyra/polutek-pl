import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/routing";

/**
 * Pure, edge-safe language detection from request headers (no cookies, no session, no database): used by the
 * server-language helpers and by the proxy, which names the language of the embeddable player page.
 */

/**
 * Countries whose language the site is detected by country (ISO 3166-1 alpha-2, as sent in
 * Cloudflare's `CF-IPCountry`). Only Poland is listed (owner decision): every other visitor is
 * served by the browser's `Accept-Language`, so a German browser set to English stays English
 * even in Germany. English-speaking countries are absent for the same reason.
 */
const COUNTRY_LANGUAGE: Readonly<Record<string, Locale>> = { PL: "pl" };

/** Language of the visitor's country, or null (unknown country, "XX", Tor "T1", no mapping). */
export function languageFromCountry(country: string | null | undefined): Locale | null {
  if (!country) return null;
  return COUNTRY_LANGUAGE[country.trim().toUpperCase()] ?? null;
}

/**
 * The first supported language in an `Accept-Language` header, in the browser's order of
 * preference (q-values, RFC 9110 section 12.5.4); any of the eight site languages counts, by primary
 * subtag ("zh-TW" and "pt-PT" too): "en-US,en;q=0.9,pl;q=0.8" is English, "pl-PL,pl" is
 * Polish, "de-DE" is German, "ja" is null. Entries with q=0 mean "not acceptable" and are skipped.
 */
export function languageFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranges = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...attributes] = part.trim().split(";");
      const qAttribute = attributes.map((a) => a.trim()).find((a) => /^q=/i.test(a));
      const q = qAttribute ? Number(qAttribute.slice(2)) : 1;
      return { primary: tag.trim().split("-")[0]?.toLowerCase() ?? "", q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((range) => range.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const range of ranges) {
    if ((SUPPORTED_LOCALES as readonly string[]).includes(range.primary)) return range.primary as Locale;
  }
  return null;
}

/**
 * Language of the embeddable player page: an explicit `?lang=` wins, then the visitor's country and
 * `Accept-Language`, then English. Reads only the URL and two request headers (never a cookie or a session).
 */
export function resolveEmbedLanguage(input: { langParam?: string | null; country?: string | null; acceptLanguage?: string | null }): Locale {
  const explicit = input.langParam?.toLowerCase();
  if (explicit && (SUPPORTED_LOCALES as readonly string[]).includes(explicit)) return explicit as Locale;
  return languageFromCountry(input.country) ?? languageFromAcceptLanguage(input.acceptLanguage) ?? "en";
}
