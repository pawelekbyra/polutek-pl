/**
 * Languages with their own interface translation and their own URL prefix (/pl, /en, /de, ...).
 * Only `CONTENT_LOCALES` also have real page content (film titles, legal documents, e-mails); the
 * rest translate the interface only and show English content (docs/operations/I18N.md).
 */
export const CONTENT_LOCALES = ["pl", "en"] as const;
export const UI_ONLY_LOCALES = ["de", "es", "fr", "it", "pt", "zh"] as const;
export const SUPPORTED_LOCALES = [...CONTENT_LOCALES, ...UI_ONLY_LOCALES] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type ContentLocale = (typeof CONTENT_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pl";

/** Language whose page content (film texts, legal documents, e-mails) a viewer gets: Polish or English. */
export function toContentLocale(locale: Locale): ContentLocale {
  return locale === "pl" ? "pl" : "en";
}

export const ROUTES = {
  home: { pl: "", en: "/en" },
  search: { pl: "/search", en: "/en/search" },
  watch: { pl: "/watch/:slug", en: "/en/watch/:slug" },
  channel: { pl: "/channel/:slug", en: "/en/channel/:slug" },
  // A creator's playlist: /playlista/<channel slug>/<playlist slug> (pl), /en/playlist/<channel slug>/<playlist slug> (en).
  playlist: { pl: "/playlista/:channel/:slug", en: "/en/playlist/:channel/:slug" },
  terms: { pl: "/regulamin", en: "/en/terms" },
  privacy: { pl: "/polityka-prywatnosci", en: "/en/privacy-policy" },
  studio: { pl: "/studio", en: "/en/studio" },
  // The viewer's own subscriptions: signed-in only (middleware gate), never indexed, so not in the public mirrors.
  subscriptions: { pl: "/subskrypcje", en: "/en/subscriptions" },
  // Prototype sections (flag SHOW_SECTION_NAV): demo photo feed and demo shop.
  photos: { pl: "/zdjecia", en: "/en/photos" },
  shop: { pl: "/sklep", en: "/en/shop" },
} as const;

export type RouteKey = keyof typeof ROUTES;

type RouteParams = { slug?: string; /** Channel slug of the `playlist` route. */ channel?: string };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: unknown): Locale | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  return isLocale(normalized) ? normalized : null;
}

export function getLocalizedHref(locale: Locale, routeKey: RouteKey, params: RouteParams = {}) {
  // UI-only languages mirror the English routes under their own prefix: /en/search -> /de/search.
  const href0 = ROUTES[routeKey][toContentLocale(locale)] as string;
  let href = locale === "pl" || locale === "en" ? href0 : href0.replace(/^\/en(?=\/|$)/, `/${locale}`);
  if (href.includes(":channel")) {
    if (!params.channel) throw new Error(`Missing channel for localized route ${routeKey}`);
    href = href.replace(":channel", encodeURIComponent(params.channel));
  }
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
  const playlist = pathname.match(/^\/playlista?\/([^/]+)\/([^/]+)\/?$/);
  if (playlist) return getLocalizedHref(locale, "playlist", { channel: decodeURIComponent(playlist[1] ?? ""), slug: decodeURIComponent(playlist[2] ?? "") });
  if (pathname === "/regulamin") return getLocalizedHref(locale, "terms");
  if (pathname === "/polityka-prywatnosci") return getLocalizedHref(locale, "privacy");
  if (pathname === "/subskrypcje") return getLocalizedHref(locale, "subscriptions");
  if (pathname === "/zdjecia") return getLocalizedHref(locale, "photos");
  if (pathname === "/sklep") return getLocalizedHref(locale, "shop");
  return null;
}

export function switchLocalePath(pathname: string, targetLocale: Locale): string {
  const parts = pathname.split("/").filter(Boolean);
  const currentLocale = normalizeLocale(parts[0]);
  if (!currentLocale) return localizedPathFromLegacyPath(pathname, targetLocale) ?? getLocalizedHref(targetLocale, "home");
  const rest = parts.slice(1);
  if (rest.length === 0) return getLocalizedHref(targetLocale, "home");
  const [segment, slug, third] = rest;
  if ((segment === "playlist" || segment === "playlista") && slug && third) {
    return getLocalizedHref(targetLocale, "playlist", { channel: decodeURIComponent(slug), slug: decodeURIComponent(third) });
  }
  if (segment === "watch" && slug) return getLocalizedHref(targetLocale, "watch", { slug: decodeURIComponent(slug) });
  if (segment === "channel" && slug) return getLocalizedHref(targetLocale, "channel", { slug: decodeURIComponent(slug) });
  if (segment === "search") return getLocalizedHref(targetLocale, "search");
  if (segment === "regulamin" || segment === "terms") return getLocalizedHref(targetLocale, "terms");
  if (segment === "polityka-prywatnosci" || segment === "privacy-policy") return getLocalizedHref(targetLocale, "privacy");
  if (segment === "subskrypcje" || segment === "subscriptions") return getLocalizedHref(targetLocale, "subscriptions");
  if (segment === "zdjecia" || segment === "photos") return getLocalizedHref(targetLocale, "photos");
  if (segment === "sklep" || segment === "shop") return getLocalizedHref(targetLocale, "shop");
  if (segment === "studio") return getLocalizedHref(targetLocale, "studio");
  return getLocalizedHref(targetLocale, "home");
}

export function getRouteLocaleFromPathname(pathname: string): Locale | null {
  return normalizeLocale(pathname.split("/").filter(Boolean)[0]);
}

/**
 * Request header the proxy (middleware.ts) sets to the locale written in the URL ("/pl/...",
 * "/en/..."), and strips otherwise, so the root layout knows which version the page renders.
 * Bare paths ("/", "/regulamin", ...) carry no header: their language is negotiated.
 */
export const ROUTE_LOCALE_HEADER = "x-pp-route-locale";

/**
 * Path that names its language explicitly: "/pl/..." for Polish, "/en/..." for English. The bare
 * Polish paths of `getLocalizedHref` are served in the viewer's negotiated language, so search
 * engines (canonical, hreflang, sitemap) and server redirects that must never land on the bare
 * path again use this form.
 */
export function getExplicitLocaleHref(locale: Locale, routeKey: RouteKey, params: RouteParams = {}): string {
  const href = getLocalizedHref(locale, routeKey, params);
  if (getRouteLocaleFromPathname(href) === locale) return href;
  return href === "/" ? `/${locale}` : `/${locale}${href}`;
}

/**
 * Canonical URL and hreflang map of one page (absolute when `baseUrl` is given): each language at
 * its explicit URL, and `x-default` (any other language) on English, the language such visitors
 * get anyway (lib/i18n/server-language.ts).
 */
export function getLocaleAlternates(
  locale: Locale,
  routeKey: RouteKey,
  { params = {}, query = "", baseUrl = "" }: { params?: RouteParams; query?: string | URLSearchParams; baseUrl?: string } = {},
) {
  const url = (target: Locale) => `${baseUrl}${appendQueryString(getExplicitLocaleHref(target, routeKey, params), query)}`;
  // A UI-only language shows English content, so its pages point search engines at the English URL.
  return { canonical: url(toContentLocale(locale)), languages: { pl: url("pl"), en: url("en"), "x-default": url("en") } };
}
