import { isAdultVideo } from "@/lib/modules/video/domain/video-visibility";
import { toPremiereDate } from "@/lib/premiere";

/** Newest videos a feed lists. */
export const FEED_ITEM_LIMIT = 50;
/** Longest public description of a feed item (characters). */
export const FEED_DESCRIPTION_MAX = 280;

export type FeedChannel = {
  name: string;
  slug: string;
  bio?: string | null;
};

export type FeedVideoRow = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  /** The RAW stored tier. */
  tier: string;
  status: string;
  moderationStatus?: string | null;
  isAdult?: boolean | null;
  publishedAt?: Date | string | null;
  premiereAt?: Date | string | null;
  createdAt: Date | string;
  /** Absolute public thumbnail URL; used for PUBLIC-tier items only. */
  thumbnailUrl?: string | null;
};

export type FeedItem = {
  id: string;
  title: string;
  link: string;
  description: string;
  pubDate: Date;
  /** Only PUBLIC-tier items carry a thumbnail; signed-in and paid items are title, link, date and a short text. */
  thumbnailUrl: string | null;
};

/** Removes what XML 1.0 cannot carry: control characters other than tab/newline/CR, lone surrogates, U+FFFE/U+FFFF. */
function stripInvalidXmlChars(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    const valid =
      code === 0x9 || code === 0xa || code === 0xd ||
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd) ||
      (code >= 0x10000 && code <= 0x10ffff);
    if (valid) out += ch;
  }
  return out;
}

export function escapeXml(value: string): string {
  return stripInvalidXmlChars(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** A short plain-text description: whitespace collapsed, cut at a word boundary with an ellipsis. */
export function shortPublicDescription(text: string | null | undefined, max: number = FEED_DESCRIPTION_MAX): string {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** The date a feed shows for a video: when it was published (a premiere that has aired counts from its premiere). */
function itemDate(row: FeedVideoRow): Date | null {
  const published = toPremiereDate(row.publishedAt);
  const premiere = toPremiereDate(row.premiereAt);
  const created = toPremiereDate(row.createdAt);
  const candidates = [published, premiere].filter((d): d is Date => d !== null);
  if (candidates.length === 0) return created;
  return candidates.reduce((latest, d) => (d.getTime() > latest.getTime() ? d : latest));
}

/**
 * Which videos a public feed may list, newest first, at most `limit`: PUBLISHED, not removed, not 18+, already due
 * (no future publication date and no premiere still to come). The channel's own visibility is decided by the
 * query (a feed of a hidden channel does not exist). The tier does NOT exclude an item (a signed-in video is
 * announced), it only limits what the item carries (see `toFeedItem`).
 */
export function selectFeedVideos(rows: FeedVideoRow[], now: Date, limit: number = FEED_ITEM_LIMIT): FeedVideoRow[] {
  return rows
    .filter((row) => {
      if (row.status !== "PUBLISHED") return false;
      if (row.moderationStatus === "REMOVED" || row.moderationStatus === "AGE_RESTRICTED") return false;
      if (isAdultVideo(row)) return false;
      const published = toPremiereDate(row.publishedAt);
      if (published && published.getTime() > now.getTime()) return false;
      const premiere = toPremiereDate(row.premiereAt);
      if (premiere && premiere.getTime() > now.getTime()) return false;
      return itemDate(row) !== null;
    })
    .sort((a, b) => (itemDate(b)?.getTime() ?? 0) - (itemDate(a)?.getTime() ?? 0))
    .slice(0, Math.max(0, limit));
}

export function toFeedItem(row: FeedVideoRow, baseUrl: string): FeedItem {
  const origin = baseUrl.replace(/\/+$/, "");
  return {
    id: row.id,
    title: row.title,
    // The canonical video URL: the Polish feed with ?v= (the same one the sitemap and the page declare).
    link: `${origin}/pl?v=${encodeURIComponent(row.slug)}`,
    description: shortPublicDescription(row.description),
    pubDate: itemDate(row) ?? new Date(0),
    thumbnailUrl: row.tier === "PUBLIC" && row.thumbnailUrl && /^https?:\/\//i.test(row.thumbnailUrl) ? row.thumbnailUrl : null,
  };
}

/** The feed's last-change time: the newest item date (stable between rebuilds, so ETag/Last-Modified work), or the epoch. */
export function feedLastModified(items: FeedItem[]): Date {
  return items.reduce((latest, item) => (item.pubDate.getTime() > latest.getTime() ? item.pubDate : latest), new Date(0));
}

export type BuildFeedInput = {
  baseUrl: string;
  channel: FeedChannel;
  items: FeedItem[];
};

/**
 * RSS 2.0 for one channel. Absolute URLs on `baseUrl`, everything escaped, and NO `<enclosure>`: the media is
 * protected (a signed HLS plan per viewer), so a feed reader gets the title, link, date and a short text and
 * opens the video on the site.
 */
export function buildChannelFeedXml({ baseUrl, channel, items }: BuildFeedInput): string {
  const origin = baseUrl.replace(/\/+$/, "");
  const channelLink = `${origin}/pl/channel/${encodeURIComponent(channel.slug)}`;
  const selfLink = `${origin}/channel/${encodeURIComponent(channel.slug)}/feed.xml`;
  const description = shortPublicDescription(channel.bio) || channel.name;
  const lastBuild = feedLastModified(items);

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">',
    "<channel>",
    `<title>${escapeXml(channel.name)}</title>`,
    `<link>${escapeXml(channelLink)}</link>`,
    `<description>${escapeXml(description)}</description>`,
    "<language>pl</language>",
    ...(items.length > 0 ? [`<lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>`] : []),
    `<atom:link href="${escapeXml(selfLink)}" rel="self" type="application/rss+xml"/>`,
  ];
  for (const item of items) {
    lines.push(
      "<item>",
      `<title>${escapeXml(item.title)}</title>`,
      `<link>${escapeXml(item.link)}</link>`,
      `<guid isPermaLink="false">${escapeXml(item.id)}</guid>`,
      `<pubDate>${item.pubDate.toUTCString()}</pubDate>`,
      ...(item.description ? [`<description>${escapeXml(item.description)}</description>`] : []),
      ...(item.thumbnailUrl ? [`<media:thumbnail url="${escapeXml(item.thumbnailUrl)}"/>`] : []),
      "</item>",
    );
  }
  lines.push("</channel>", "</rss>", "");
  return lines.join("\n");
}
