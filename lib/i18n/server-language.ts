import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isLocale, ROUTE_LOCALE_HEADER, type Locale } from "@/lib/i18n/routing";
import { languageFromAcceptLanguage, languageFromCountry } from "@/lib/i18n/accept-language";

export type AppLanguage = Locale;

export const LANGUAGE_COOKIE = "app-language";

// Pure header-based detection lives in accept-language.ts (edge-safe, shared with the proxy).
export { languageFromCountry, languageFromAcceptLanguage };

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
