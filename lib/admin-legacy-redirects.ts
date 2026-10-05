/**
 * The old admin on www (`/admin*`, `/api/admin*`) is gone (phase 5 of the admin plan,
 * docs/architecture/admin-phase5.md). This module is the single map from an old page to the matching
 * screen of the panel (admin.pawelperfect.com). middleware.ts answers with a permanent 308 for pages
 * and a 404 for the old API. Edge-safe: no Node-only imports.
 *
 * Old video ids cannot be turned into panel slugs without a database read, so a film page goes to the
 * film list. An unknown /admin/... path goes to the panel root.
 */

export const ADMIN_PANEL_ORIGIN = "https://admin.pawelperfect.com";

type Rule = { pattern: RegExp; to: (match: RegExpMatchArray) => string };

// First match wins; patterns match the pathname without a trailing slash.
const RULES: Rule[] = [
  { pattern: /^\/admin$/, to: () => "/" },
  { pattern: /^\/admin\/videos\/layout$/, to: () => "/tresci/uklad" },
  { pattern: /^\/admin\/videos(?:\/.+)?$/, to: () => "/tresci" },
  { pattern: /^\/admin\/users\/dashboard$/, to: () => "/spolecznosc?tab=uzytkownicy" },
  { pattern: /^\/admin\/users\/payments$/, to: () => "/przychody?tab=wplaty" },
  { pattern: /^\/admin\/users$/, to: () => "/spolecznosc?tab=uzytkownicy" },
  { pattern: /^\/admin\/users\/([^/]+)$/, to: (m) => `/spolecznosc/u/${m[1]}` },
  { pattern: /^\/admin\/comments\/reports$/, to: () => "/spolecznosc" },
  { pattern: /^\/admin\/comments$/, to: () => "/spolecznosc?tab=komentarze" },
  { pattern: /^\/admin\/emails\/broadcast$/, to: () => "/komunikacja?tab=rozsylki" },
  { pattern: /^\/admin\/emails$/, to: () => "/komunikacja?tab=szablony" },
  { pattern: /^\/admin\/notifications$/, to: () => "/komunikacja?tab=powiadomienia" },
  { pattern: /^\/admin\/(?:channel|settings)$/, to: () => "/ustawienia?tab=kanal" },
  { pattern: /^\/admin\/payments$/, to: () => "/ustawienia?tab=platnosci" },
  { pattern: /^\/admin\/(?:diagnostics|system)$/, to: () => "/system" },
];

/** True for `/admin`, `/admin/...` (case-insensitive: the Next router is not, but a visitor may type it). */
export function isLegacyAdminPagePath(pathname: string): boolean {
  return /^\/admin(?:\/|$)/i.test(pathname);
}

/** True for the removed `/api/admin` API. */
export function isLegacyAdminApiPath(pathname: string): boolean {
  return /^\/api\/admin(?:\/|$)/i.test(pathname);
}

/** Absolute panel URL for an old admin page path, or null when the path is not an old admin page. */
export function resolveLegacyAdminRedirect(pathname: string): string | null {
  if (!isLegacyAdminPagePath(pathname)) return null;
  const clean = pathname.replace(/\/+$/, "") || "/";
  const lower = clean.replace(/^\/admin/i, "/admin");
  for (const rule of RULES) {
    const match = lower.match(rule.pattern);
    if (match) return `${ADMIN_PANEL_ORIGIN}${rule.to(match)}`;
  }
  return `${ADMIN_PANEL_ORIGIN}/`;
}
