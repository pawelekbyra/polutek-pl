import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  loadChannelFeedSource: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: h.rateLimit }));
vi.mock("@/lib/modules/syndication/infrastructure/syndication.repository", () => ({
  loadChannelFeedSource: h.loadChannelFeedSource,
  findVideoForEmbed: vi.fn(),
}));

import { GET } from "@/app/channel/[slug]/feed.xml/route";

const BASE = "https://www.pawelperfect.com";

function row(i: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `vid-${i}`,
    slug: `film-${i}`,
    title: `Film ${i}`,
    description: `Opis ${i}`,
    tier: "PUBLIC",
    status: "PUBLISHED",
    moderationStatus: "VISIBLE",
    isAdult: false,
    publishedAt: new Date(Date.UTC(2026, 8, 1, 0, i)),
    premiereAt: null,
    createdAt: new Date(Date.UTC(2026, 8, 1, 0, i)),
    thumbnailUrl: `${BASE}/api/videos/vid-${i}/thumbnail`,
    ...overrides,
  };
}

function call(slug: string, headers: Record<string, string> = {}) {
  const req = new NextRequest(`${BASE}/channel/${slug}/feed.xml`, { headers: { "x-forwarded-for": "1.2.3.4", ...headers } });
  return GET(req, { params: Promise.resolve({ slug }) });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", BASE);
  h.rateLimit.mockReset().mockResolvedValue({ success: true, remaining: 10 });
  h.loadChannelFeedSource.mockReset().mockResolvedValue({
    channel: { name: "Kanał Pawła", slug: "pawel", bio: "Bio" },
    rows: [row(1), row(2, { tier: "LOGGED_IN" }), row(3, { status: "UNLISTED" }), row(4, { isAdult: true }), row(5, { premiereAt: new Date(Date.now() + 86_400_000) })],
  });
});

describe("GET /channel/<slug>/feed.xml", () => {
  it("serves RSS with the right type, a short shared cache, ETag and Last-Modified", async () => {
    const res = await call("pawel");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/rss+xml; charset=utf-8");
    expect(res.headers.get("cache-control")).toMatch(/s-maxage=\d{1,3}\b/);
    expect(res.headers.get("cache-control")).not.toContain("private");
    expect(res.headers.get("etag")).toMatch(/^W\/"[0-9a-f]{40}"$/);
    expect(res.headers.get("last-modified")).toBe(new Date(Date.UTC(2026, 8, 1, 0, 2)).toUTCString());
    const xml = await res.text();
    expect(xml).toContain("<item>");
    // the listed videos: public and signed-in (title/link only); never the unlisted, 18+ or upcoming ones
    expect(xml).toContain("Film 1");
    expect(xml).toContain("Film 2");
    for (const hidden of ["Film 3", "Film 4", "Film 5"]) expect(xml).not.toContain(hidden);
    expect(xml).not.toContain("<enclosure");
  });

  it("passes the slug it was asked for to the query and the canonical origin to the builder", async () => {
    await call("pawel");
    expect(h.loadChannelFeedSource).toHaveBeenCalledWith("pawel", BASE, expect.any(Date));
  });

  it("answers 304 to a matching If-None-Match, with the validators and no body", async () => {
    const first = await call("pawel");
    const etag = first.headers.get("etag") as string;
    const res = await call("pawel", { "if-none-match": etag });
    expect(res.status).toBe(304);
    expect(res.headers.get("etag")).toBe(etag);
    expect(await res.text()).toBe("");
  });

  it("answers 404 for an unknown or hidden channel", async () => {
    h.loadChannelFeedSource.mockResolvedValue(null);
    const res = await call("nie-ma");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/plain");
  });

  it("is rate-limited per IP", async () => {
    h.rateLimit.mockResolvedValue({ success: false, remaining: 0 });
    const res = await call("pawel");
    expect(res.status).toBe(429);
    expect(h.rateLimit).toHaveBeenCalledWith(expect.objectContaining({ key: "channel-feed:1.2.3.4" }));
    expect(h.loadChannelFeedSource).not.toHaveBeenCalled();
  });

  it("lists at most 50 items", async () => {
    h.loadChannelFeedSource.mockResolvedValue({
      channel: { name: "K", slug: "k", bio: null },
      rows: Array.from({ length: 120 }, (_, i) => row(i)),
    });
    const xml = await (await call("k")).text();
    expect(xml.match(/<item>/g)).toHaveLength(50);
  });
});
