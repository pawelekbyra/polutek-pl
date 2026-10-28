import { headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, ROUTE_LOCALE_HEADER, type Locale } from "@/lib/i18n/routing";
import { resolveDocumentLanguage } from "@/lib/i18n/server-language";

/**
 * The language a `[locale]` page renders in: the same one the root layout, `<html lang>` and the
 * client provider use for this request (one answer per response, CLAUDE.md §4.11).
 *
 * - An address that names its language ("/de/search", "/pl/channel/x") reaches the page with the
 *   proxy's `x-pp-route-locale` header: the segment is the language.
 * - A bare address ("/search", "/channel/x") is rewritten by the proxy to the `/pl/...` page without
 *   that header, so the `pl` segment is only a placeholder and the viewer's negotiated language
 *   (account, cookie, country, Accept-Language, English) decides, exactly as for the layout.
 *
 * Returns null for a segment that is not a language (the page answers 404). Outside a request
 * (a unit test rendering the page directly) the segment itself is returned.
 */
export async function resolvePageLocale(rawLocale: string): Promise<Locale | null> {
  if (!isLocale(rawLocale)) return null;
  try {
    const named = (await headers()).get(ROUTE_LOCALE_HEADER);
    if (isLocale(named)) return rawLocale;
    // No language in the address: only the proxy's /pl placeholder gets here.
    if (rawLocale !== DEFAULT_LOCALE) return rawLocale;
    return await resolveDocumentLanguage();
  } catch {
    return rawLocale;
  }
}
