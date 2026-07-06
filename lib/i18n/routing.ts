export const SUPPORTED_LOCALES = ["pl", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pl";

export const ROUTES = {
  home: { pl: "", en: "/en" },
  search: { pl: "/search", en: "/en/search" },
  watch: { pl: "/watch/:slug", en: "/en/watch/:slug" },
  channel: { pl: "/channel/:slug", en: "/en/channel/:slug" },
  terms: { pl: "/regulamin", en: "/en/terms" },
  privacy: { pl: "/polityka-prywatnosci", en: "/en/privacy-policy" },
  shop: { pl: "/sklep", en: "/en/shop" },
} as const;

export type RouteKey = keyof typeof ROUTES;

type RouteParams = { slug?: string };

export function isLocale(value: unknown): value is Locale {
  return value === "pl" || value === "en";
}

export function normalizeLocale(value: unknown): Locale | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  return isLocale(normalized) ? normalized : null;
}

export function getLocalizedHref(locale: Locale, routeKey: RouteKey, params: RouteParams = {}) {
  let href = ROUTES[routeKey][locale] as string;
  if (href.includes(":slug")) {
    if (!params.slug) throw new Error(`Missing slug for localized route ${routeKey}`);
    href = href.replace(":slug", encodeURIComponent(params.slug));
  }
  return href || "/";
}

export function appendQueryString(path: string, queryString?: string | URLSearchParams | null) {
  const query = typeof queryString === "string" ? queryString.replace(/^\?/, "") : queryString?.toString() ?? "";
  return query ? `${path}?${query}` : path;
}

export function localizedPathFromLegacyPath(pathname: string, locale: Locale): string | null {
  if (pathname === "/") return getLocalizedHref(locale, "home");
  if (pathname === "/search") return getLocalizedHref(locale, "search");
  const watch = pathname.match(/^\/watch\/([^/]+)\/?$/);
  if (watch) return getLocalizedHref(locale, "watch", { slug: decodeURIComponent(watch[1] ?? "") });
  const channel = pathname.match(/^\/channel\/([^/]+)\/?$/);
  if (channel) return getLocalizedHref(locale, "channel", { slug: decodeURIComponent(channel[1] ?? "") });
  if (pathname === "/regulamin") return getLocalizedHref(locale, "terms");
  if (pathname === "/polityka-prywatnosci") return getLocalizedHref(locale, "privacy");
  if (pathname === "/sklep" || pathname === "/shop") return getLocalizedHref(locale, "shop");
  return null;
}

export function switchLocalePath(pathname: string, targetLocale: Locale): string {
  const parts = pathname.split("/").filter(Boolean);
  const currentLocale = normalizeLocale(parts[0]);
  if (!currentLocale) return localizedPathFromLegacyPath(pathname, targetLocale) ?? getLocalizedHref(targetLocale, "home");
  const rest = parts.slice(1);
  if (rest.length === 0) return getLocalizedHref(targetLocale, "home");
  const [segment, slug] = rest;
  if (segment === "watch" && slug) return getLocalizedHref(targetLocale, "watch", { slug: decodeURIComponent(slug) });
  if (segment === "channel" && slug) return getLocalizedHref(targetLocale, "channel", { slug: decodeURIComponent(slug) });
  if (segment === "search") return getLocalizedHref(targetLocale, "search");
  if (segment === "regulamin" || segment === "terms") return getLocalizedHref(targetLocale, "terms");
  if (segment === "polityka-prywatnosci" || segment === "privacy-policy") return getLocalizedHref(targetLocale, "privacy");
  if (segment === "sklep" || segment === "shop") return getLocalizedHref(targetLocale, "shop");
  return getLocalizedHref(targetLocale, "home");
}

export function getRouteLocaleFromPathname(pathname: string): Locale | null {
  return normalizeLocale(pathname.split("/").filter(Boolean)[0]);
}
