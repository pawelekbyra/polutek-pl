import { describe, expect, it } from "vitest";
import {
  buildChannelFeedXml,
  escapeXml,
  FEED_ITEM_LIMIT,
  selectFeedVideos,
  shortPublicDescription,
  toFeedItem,
  feedLastModified,
  type FeedVideoRow,
} from "@/lib/modules/syndication/domain/rss";
import { isNotModified } from "@/lib/modules/syndication/domain/conditional";

const BASE = "https://www.pawelperfect.com";
const NOW = new Date("2026-10-15T12:00:00Z");

function row(overrides: Partial<FeedVideoRow> = {}): FeedVideoRow {
  return {
    id: "vid-1",
    slug: "pierwszy-film",
    title: "Pierwszy film",
    description: "Opis",
    tier: "PUBLIC",
    status: "PUBLISHED",
    moderationStatus: "VISIBLE",
    isAdult: false,
    publishedAt: new Date("2026-10-10T10:00:00Z"),
    premiereAt: null,
    createdAt: new Date("2026-10-09T10:00:00Z"),
    thumbnailUrl: `${BASE}/api/videos/vid-1/thumbnail`,
    ...overrides,
  };
}

describe("escapeXml", () => {
  it("escapes the five XML specials", () => {
    expect(escapeXml(`<a href="x">Tom & 'Jerry'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;");
  });

  it("drops characters XML 1.0 cannot carry but keeps tabs, newlines, emoji and Polish letters", () => {
    expect(escapeXml("a\u0000b\u0008c\u001Fd￾e")).toBe("abcde");
    expect(escapeXml("zażółć\tgęślą\n😀")).toBe("zażółć\tgęślą\n😀");
    // a lone surrogate would make the document ill-formed
    expect(escapeXml("x\uD800y")).toBe("xy");
  });
});

describe("shortPublicDescription", () => {
  it("collapses whitespace and keeps short text as is", () => {
    expect(shortPublicDescription("  linia 1\n\n  linia 2 ")).toBe("linia 1 linia 2");
    expect(shortPublicDescription(null)).toBe("");
  });

  it("cuts long text at a word boundary with an ellipsis, within the limit", () => {
    const text = "słowo ".repeat(200);
    const short = shortPublicDescription(text, 50);
    expect(short.length).toBeLessThanOrEqual(50);
    expect(short.endsWith("…")).toBe(true);
    expect(short).not.toMatch(/\s…$/);
  });
});

describe("selectFeedVideos: which videos a public feed lists", () => {
  it("lists published, due videos newest first", () => {
    const rows = [
      row({ id: "old", publishedAt: new Date("2026-10-01T00:00:00Z") }),
      row({ id: "new", publishedAt: new Date("2026-10-14T00:00:00Z") }),
    ];
    expect(selectFeedVideos(rows, NOW).map((r) => r.id)).toEqual(["new", "old"]);
  });

  it.each([
    ["UNLISTED", { status: "UNLISTED" }],
    ["DRAFT", { status: "DRAFT" }],
    ["ARCHIVED", { status: "ARCHIVED" }],
    ["removed by moderation", { moderationStatus: "REMOVED" }],
    ["age restricted by moderation", { moderationStatus: "AGE_RESTRICTED" }],
    ["declared 18+", { isAdult: true }],
    ["future publication date", { publishedAt: new Date("2026-10-20T00:00:00Z") }],
    ["premiere still to come", { premiereAt: new Date("2026-10-16T00:00:00Z") }],
  ])("leaves out a video that is %s", (_label, overrides) => {
    expect(selectFeedVideos([row(overrides as Partial<FeedVideoRow>)], NOW)).toEqual([]);
  });

  it("lists a premiere that has already aired, dated from the premiere", () => {
    const aired = row({ premiereAt: new Date("2026-10-14T20:00:00Z"), publishedAt: new Date("2026-10-01T00:00:00Z") });
    const [item] = selectFeedVideos([aired], NOW).map((r) => toFeedItem(r, BASE));
    expect(item?.pubDate.toISOString()).toBe("2026-10-14T20:00:00.000Z");
  });

  it("limits the feed to 50 items by default and honours a smaller limit", () => {
    const many = Array.from({ length: 80 }, (_, i) => row({ id: `v${i}`, slug: `s${i}`, publishedAt: new Date(Date.UTC(2026, 8, 1, 0, i)) }));
    expect(selectFeedVideos(many, NOW)).toHaveLength(FEED_ITEM_LIMIT);
    expect(FEED_ITEM_LIMIT).toBe(50);
    expect(selectFeedVideos(many, NOW, 5)).toHaveLength(5);
    // the newest are kept
    expect(selectFeedVideos(many, NOW)[0]?.id).toBe("v79");
  });
});

describe("toFeedItem: what an item may carry", () => {
  it("links to the canonical video page on the site origin, with the slug URL-encoded", () => {
    const item = toFeedItem(row({ slug: "film z ukosnikiem/x" }), `${BASE}/`);
    expect(item.link).toBe(`${BASE}/pl?v=film%20z%20ukosnikiem%2Fx`);
  });

  it("gives a PUBLIC video its thumbnail, but a signed-in or paid video only title, link, date and a short text", () => {
    expect(toFeedItem(row({ tier: "PUBLIC" }), BASE).thumbnailUrl).toBe(`${BASE}/api/videos/vid-1/thumbnail`);
    for (const tier of ["LOGGED_IN", "PAID", "PATRON"]) {
      expect(toFeedItem(row({ tier }), BASE).thumbnailUrl).toBeNull();
    }
  });

  it("shortens the description", () => {
    const item = toFeedItem(row({ description: "x ".repeat(500) }), BASE);
    expect(item.description.length).toBeLessThanOrEqual(280);
  });
});

describe("buildChannelFeedXml", () => {
  const channel = { name: 'Kanał "Perfect" & <spółka>', slug: "perfect", bio: "Opis <b>kanału</b> & więcej" };

  function feed(rows: FeedVideoRow[]) {
    const items = selectFeedVideos(rows, NOW).map((r) => toFeedItem(r, BASE));
    return { xml: buildChannelFeedXml({ baseUrl: BASE, channel, items }), items };
  }

  it("is RSS 2.0 with absolute URLs on the canonical origin and an atom self link", () => {
    const { xml } = feed([row()]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain(`<link>${BASE}/pl/channel/perfect</link>`);
    expect(xml).toContain(`<atom:link href="${BASE}/channel/perfect/feed.xml" rel="self" type="application/rss+xml"/>`);
    expect(xml).toContain(`<link>${BASE}/pl?v=pierwszy-film</link>`);
    expect(xml).toContain('<guid isPermaLink="false">vid-1</guid>');
    expect(xml).toContain("<pubDate>Sat, 10 Oct 2026 10:00:00 GMT</pubDate>");
    expect(xml).toContain("<lastBuildDate>Sat, 10 Oct 2026 10:00:00 GMT</lastBuildDate>");
    // every href/url in the document is absolute
    for (const match of xml.matchAll(/(?:href|url)="([^"]+)"/g)) expect(match[1]).toMatch(/^https:\/\//);
  });

  it("escapes channel and video texts everywhere", () => {
    const { xml } = feed([row({ title: 'Wideo <script>alert("x")</script> & "cudzysłów"', description: "a < b && c > d" })]);
    expect(xml).toContain("<title>Kanał &quot;Perfect&quot; &amp; &lt;spółka&gt;</title>");
    expect(xml).toContain("<title>Wideo &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &quot;cudzysłów&quot;</title>");
    expect(xml).toContain("<description>a &lt; b &amp;&amp; c &gt; d</description>");
    expect(xml).not.toContain("<script>");
  });

  it("never carries an enclosure or any media URL (the media is protected)", () => {
    const { xml } = feed([row(), row({ id: "v2", slug: "s2", tier: "LOGGED_IN" })]);
    expect(xml).not.toContain("<enclosure");
    expect(xml).not.toMatch(/\.m3u8|hls|video\.pawelperfect\.com|<media:content/i);
  });

  it("describes a signed-in item without a thumbnail", () => {
    const { xml } = feed([row({ tier: "LOGGED_IN" })]);
    expect(xml).toContain("<item>");
    expect(xml).not.toContain("<media:thumbnail");
    const { xml: publicXml } = feed([row({ tier: "PUBLIC" })]);
    expect(publicXml).toContain(`<media:thumbnail url="${BASE}/api/videos/vid-1/thumbnail"/>`);
  });

  it("is a valid empty feed for a channel without videos, and never lists an ineligible video", () => {
    const { xml } = feed([row({ status: "UNLISTED" }), row({ id: "d", status: "DRAFT" })]);
    expect(xml).not.toContain("<item>");
    expect(xml).not.toContain("<lastBuildDate>");
    expect(xml).toContain("</channel>");
  });

  it("is byte-identical for the same content (stable ETag input)", () => {
    expect(feed([row()]).xml).toBe(feed([row()]).xml);
  });
});

describe("feedLastModified and conditional requests", () => {
  const lastModified = new Date("2026-10-10T10:00:00Z");
  const etag = 'W/"abc"';

  it("is the newest item date, or the epoch for an empty feed", () => {
    expect(feedLastModified([])).toEqual(new Date(0));
    expect(feedLastModified([toFeedItem(row(), BASE)])).toEqual(lastModified);
  });

  it("answers 304 for a matching ETag (weak or strong, in a list or *), prefering it over the date", () => {
    expect(isNotModified({ ifNoneMatch: 'W/"abc"' }, { etag, lastModified })).toBe(true);
    expect(isNotModified({ ifNoneMatch: '"abc"' }, { etag, lastModified })).toBe(true);
    expect(isNotModified({ ifNoneMatch: '"zzz", W/"abc"' }, { etag, lastModified })).toBe(true);
    expect(isNotModified({ ifNoneMatch: "*" }, { etag, lastModified })).toBe(true);
    expect(isNotModified({ ifNoneMatch: '"other"', ifModifiedSince: lastModified.toUTCString() }, { etag, lastModified })).toBe(false);
  });

  it("answers 304 when the feed is not newer than If-Modified-Since", () => {
    expect(isNotModified({ ifModifiedSince: lastModified.toUTCString() }, { etag, lastModified })).toBe(true);
    expect(isNotModified({ ifModifiedSince: "Fri, 09 Oct 2026 10:00:00 GMT" }, { etag, lastModified })).toBe(false);
    expect(isNotModified({ ifModifiedSince: "garbage" }, { etag, lastModified })).toBe(false);
    expect(isNotModified({}, { etag, lastModified })).toBe(false);
  });
});
