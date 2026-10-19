import { buildEmbedSnippet, computeEmbedSize } from "@/lib/embed/embed-snippet";
import { SUPPORTED_LOCALES } from "@/lib/i18n/routing";

/** Thumbnails are 16:9 cards (the player's own aspect ratio). */
const THUMBNAIL_WIDTH = 1280;
const THUMBNAIL_HEIGHT = 720;

const LOCALE_PREFIX = `(?:/(?:${SUPPORTED_LOCALES.join("|")}))?`;
const HOME_PATH = new RegExp(`^${LOCALE_PREFIX}/?$`);
const WATCH_PATH = new RegExp(`^${LOCALE_PREFIX}/(?:watch|embed)/([^/]+)/?$`);

function hostsOf(baseUrl: string): Set<string> {
  const hosts = new Set<string>();
  try {
    const host = new URL(baseUrl).host.toLowerCase();
    hosts.add(host);
    // The site answers on both spellings (www and the bare domain).
    hosts.add(host.startsWith("www.") ? host.slice(4) : `www.${host}`);
  } catch {
    // no valid base: nothing matches
  }
  return hosts;
}

/**
 * The video slug named by a page address of THIS site (`url=` of an oEmbed request), or null for everything else:
 * another host, another scheme, a path that is not a video page. Accepted shapes: `/?v=<slug>`, `/<lang>?v=<slug>`,
 * `/watch/<slug>`, `/<lang>/watch/<slug>` and the embed address `/embed/<slug>`.
 */
export function parseVideoSlugFromUrl(rawUrl: string | null | undefined, baseUrl: string): string | null {
  if (!rawUrl || rawUrl.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!hostsOf(baseUrl).has(url.host.toLowerCase())) return null;

  let slug: string | null = null;
  if (HOME_PATH.test(url.pathname)) {
    slug = url.searchParams.get("v");
  } else {
    const match = WATCH_PATH.exec(url.pathname);
    if (match?.[1]) {
      try {
        slug = decodeURIComponent(match[1]);
      } catch {
        slug = null;
      }
    }
  }
  slug = slug?.trim() ?? null;
  return slug && slug.length <= 200 ? slug : null;
}

/** `format` of an oEmbed request: absent or `json` is served, anything else is answered 501 (oEmbed 1.0). */
export function isSupportedOembedFormat(format: string | null | undefined): boolean {
  return format === null || format === undefined || format === "" || format.toLowerCase() === "json";
}

export type OembedVideo = {
  slug: string;
  title: string;
  /** Absolute public thumbnail URL, or null. */
  thumbnailUrl: string | null;
  channelName: string;
  channelSlug: string;
};

export type OembedResponse = {
  type: "video";
  version: "1.0";
  title: string;
  author_name: string;
  author_url: string;
  provider_name: string;
  provider_url: string;
  cache_age: number;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  html: string;
  width: number;
  height: number;
};

export const OEMBED_CACHE_AGE_SECONDS = 300;

/** The oEmbed 1.0 "video" answer for one embeddable video (call only after `decideEmbed` said "embeddable"). */
export function buildOembedResponse(input: {
  baseUrl: string;
  providerName: string;
  video: OembedVideo;
  maxWidth?: number | null;
  maxHeight?: number | null;
}): OembedResponse {
  const origin = input.baseUrl.replace(/\/+$/, "");
  const { width, height } = computeEmbedSize({ maxWidth: input.maxWidth, maxHeight: input.maxHeight });
  const { video } = input;
  return {
    type: "video",
    version: "1.0",
    title: video.title,
    author_name: video.channelName,
    author_url: `${origin}/pl/channel/${encodeURIComponent(video.channelSlug)}`,
    provider_name: input.providerName,
    provider_url: origin,
    cache_age: OEMBED_CACHE_AGE_SECONDS,
    ...(video.thumbnailUrl
      ? { thumbnail_url: video.thumbnailUrl, thumbnail_width: THUMBNAIL_WIDTH, thumbnail_height: THUMBNAIL_HEIGHT }
      : {}),
    html: buildEmbedSnippet({ baseUrl: origin, slug: video.slug, title: video.title, width, height }),
    width,
    height,
  };
}
