/**
 * The page the viewer is really on, independent of the address bar.
 *
 * UrlMask collapses the visible address to "/" (the owner's decision), and Next's `usePathname()` /
 * `useSearchParams()` follow that masked address. Anything that needs the real page (the language
 * switcher: channel, search, playlist, `?v=` video, filters) therefore cannot read them. UrlMask
 * writes the real "path?query" into the history entry's state before masking; this module reads it
 * back. Entries are per history entry, so Back/Forward keep working.
 */
export const REAL_URL_STATE_KEY = "__ppRealUrl";

export interface RealLocation {
  pathname: string;
  search: string;
}

/** "/path?query" that is safe to keep: same-origin absolute path, never "//host" or "/\host". */
function parseRealUrl(value: unknown): RealLocation | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  const hashAt = value.indexOf("#");
  const clean = hashAt === -1 ? value : value.slice(0, hashAt);
  const queryAt = clean.indexOf("?");
  return queryAt === -1 ? { pathname: clean, search: "" } : { pathname: clean.slice(0, queryAt), search: clean.slice(queryAt) };
}

/** History state that remembers `real` (the page behind a masked address); other keys are kept. */
export function withRealUrl(state: unknown, real: RealLocation): Record<string, unknown> {
  const base = state && typeof state === "object" ? (state as Record<string, unknown>) : {};
  return { ...base, [REAL_URL_STATE_KEY]: `${real.pathname}${real.search}` };
}

/**
 * The real page: the address bar when it names something (a path other than "/" or a query); when it
 * is the bare masked "/", the page UrlMask remembered in the history state; otherwise the home page.
 */
export function resolveRealLocation(visible: RealLocation, state: unknown): RealLocation {
  const masked = visible.pathname === "/" && visible.search === "";
  if (!masked) return visible;
  const remembered = state && typeof state === "object" ? parseRealUrl((state as Record<string, unknown>)[REAL_URL_STATE_KEY]) : null;
  return remembered ?? visible;
}

/** Browser-only: `resolveRealLocation` for the current window. */
export function readRealLocation(): RealLocation {
  if (typeof window === "undefined") return { pathname: "/", search: "" };
  return resolveRealLocation({ pathname: window.location.pathname, search: window.location.search }, window.history.state);
}
