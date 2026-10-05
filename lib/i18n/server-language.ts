import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isLocale, ROUTE_LOCALE_HEADER, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/routing";

export type AppLanguage = Locale;

export const LANGUAGE_COOKIE = "app-language";

/**
 * Countries whose language the site is detected by country (ISO 3166-1 alpha-2, as sent in
 * Cloudflare's `CF-IPCountry`). Only Poland is listed (owner decision): every other visitor is
 * served by the browser's `Accept-Language`, so a German browser set to English stays English
 * even in Germany. English-speaking countries are absent for the same reason.
 */
const COUNTRY_LANGUAGE: Readonly<Record<string, AppLanguage>> = { PL: "pl" };

/** Language of the visitor's country, or null (unknown country, "XX", Tor "T1", no mapping). */
export function languageFromCountry(country: string | null | undefined): AppLanguage | null {
  if (!country) return null;
  return COUNTRY_LANGUAGE[country.trim().toUpperCase()] ?? null;
}

/**
 * The first supported language in an `Accept-Language` header, in the browser's order of
 * preference (q-values, RFC 9110 §12.5.4); any of the eight site languages counts, by primary
 * subtag ("zh-TW" and "pt-PT" too): "en-US,en;q=0.9,pl;q=0.8" is English, "pl-PL,pl" is
 * Polish, "de-DE" is German, "ja" is null. Entries with q=0 mean "not acceptable" and are skipped.
 */
export function languageFromAcceptLanguage(header: string | null | undefined): AppLanguage | null {
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
    if ((SUPPORTED_LOCALES as readonly string[]).includes(range.primary)) return range.primary as AppLanguage;
  }
  return null;
}

/**
 * The viewer's language when nothing in the URL names one. Priority, highest first:
 *
 *   1. Signed-in user's saved language (`User.language`), changed with every switch in the UI.
 *   2. The `app-language` cookie (one year, SameSite=Lax), written by the client on every change.
 *   3. The visitor's country (Cloudflare `CF-IPCountry`, see COUNTRY_LANGUAGE).
 *   4. The browser's `Accept-Language`.
 *   5. English.
 *
 * Used for the bare-path redirects and as the provider's starting language, so the first paint
 * already matches (no flash, no hydration mismatch).
 */
export async function resolveInitialLanguage(): Promise<AppLanguage> {
  try {
    const { userId } = await auth();
    if (userId) {
      const saved = (await prisma.user.findUnique({ where: { id: userId }, select: { language: true } }))?.language;
      if (isLocale(saved)) return saved;
    }
  } catch (error) {
    logger.warn("[resolveInitialLanguage] auth/db lookup failed, falling back", error);
  }

  const cookieLanguage = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  if (isLocale(cookieLanguage)) return cookieLanguage;

  const headerList = await headers();
  return (
    languageFromCountry(headerList.get("cf-ipcountry")) ??
    languageFromAcceptLanguage(headerList.get("accept-language")) ??
    "en"
  );
}

/**
 * Language of the page being rendered, for `<html lang>`: the locale written in the URL
 * ("/pl/...", "/en/...", passed on by the proxy), otherwise the viewer's language from
 * resolveInitialLanguage(). Matches what LanguageProvider renders first.
 */
export async function resolveDocumentLanguage(): Promise<AppLanguage> {
  const routeLocale = (await headers()).get(ROUTE_LOCALE_HEADER);
  return isLocale(routeLocale) ? routeLocale : resolveInitialLanguage();
}
