/**
 * Public address shapes of the syndication surface (RSS feed, embeddable player). Pure and edge-safe:
 * the proxy (middleware.ts) uses them to decide the framing rule, the locale rewrite and the robots header.
 */

const EMBED_PATH = /^\/embed\/[^/]+\/?$/;
const CHANNEL_FEED_PATH = /^\/channel\/[^/]+\/feed\.xml$/;

/**
 * The embeddable player page: `/embed/<slug>`. This is the ONLY path that may be framed by other sites
 * (CSP `frame-ancestors *` and no `X-Frame-Options`); every other response keeps `frame-ancestors 'none'`.
 */
export function isEmbedPath(pathname: string): boolean {
  return EMBED_PATH.test(pathname);
}

/** A channel's RSS feed: `/channel/<slug>/feed.xml` (bare path only; the feed has no language prefix). */
export function isChannelFeedPath(pathname: string): boolean {
  return CHANNEL_FEED_PATH.test(pathname);
}

export function buildEmbedPath(slug: string, lang?: string | null): string {
  const base = `/embed/${encodeURIComponent(slug)}`;
  return lang ? `${base}?lang=${encodeURIComponent(lang)}` : base;
}

export function buildChannelFeedPath(channelSlug: string): string {
  return `/channel/${encodeURIComponent(channelSlug)}/feed.xml`;
}
