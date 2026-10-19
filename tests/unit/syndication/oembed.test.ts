import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  findVideoForEmbed: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: h.rateLimit }));
vi.mock("@/lib/modules/syndication/infrastructure/syndication.repository", () => ({
  findVideoForEmbed: h.findVideoForEmbed,
  loadChannelFeedSource: vi.fn(),
}));

import { GET } from "@/app/api/oembed/route";
import { buildOembedResponse, isSupportedOembedFormat, parseVideoSlugFromUrl } from "@/lib/modules/syndication/domain/oembed";

const BASE = "https://www.pawelperfect.com";

function videoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "vid-1",
    slug: "moj-film",
    title: 'Mój "film"',
    tier: "PUBLIC",
    status: "PUBLISHED",
    moderationStatus: "VISIBLE",
    isAdult: false,
    publishedAt: new Date("2026-10-01T00:00:00Z"),
    premiereAt: null,
    thumbnailUrl: "private-key",
    thumbnailPublicUrl: null,
    creator: { name: "Paweł", slug: "pawel", status: "ACTIVE", deletedAt: null },
    ...overrides,
  };
}

function call(query: string, ip = "1.2.3.4") {
  return GET(new NextRequest(`${BASE}/api/oembed${query}`, { headers: { "x-forwarded-for": ip } }));
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", BASE);
  h.findVideoForEmbed.mockReset().mockResolvedValue(videoRow());
  h.rateLimit.mockReset().mockResolvedValue({ success: true, remaining: 10 });
});

describe("parseVideoSlugFromUrl", () => {
  it.each([
    [`${BASE}/?v=moj-film`, "moj-film"],
    [`${BASE}/pl?v=moj-film`, "moj-film"],
    [`${BASE}/en?v=moj-film&t=30`, "moj-film"],
    [`${BASE}/de/?v=moj-film`, "moj-film"],
    [`${BASE}/watch/moj-film`, "moj-film"],
    [`${BASE}/en/watch/moj-film`, "moj-film"],
    [`${BASE}/embed/moj-film`, "moj-film"],
    ["https://pawelperfect.com/?v=moj-film", "moj-film"],
    [`${BASE}/watch/film%20z%20spacja`, "film z spacja"],
  ])("reads the slug from %s", (url, slug) => {
    expect(parseVideoSlugFromUrl(url, BASE)).toBe(slug);
  });

  it.each([
    ["another host", "https://evil.example/?v=moj-film"],
    ["a look-alike host", "https://www.pawelperfect.com.evil.example/?v=moj-film"],
    ["a non-http scheme", "javascript:alert(1)"],
    ["a page that is not a video", `${BASE}/regulamin`],
    ["a channel page", `${BASE}/channel/pawel`],
    ["the home page without a video", `${BASE}/pl`],
    ["an empty slug", `${BASE}/?v=`],
    ["garbage", "not a url"],
    ["a bad escape", `${BASE}/watch/%E0%A4%A`],
  ])("returns null for %s", (_label, url) => {
    expect(parseVideoSlugFromUrl(url, BASE)).toBeNull();
  });

  it("rejects missing and oversized input", () => {
    expect(parseVideoSlugFromUrl(null, BASE)).toBeNull();
    expect(parseVideoSlugFromUrl(`${BASE}/?v=${"x".repeat(300)}`, BASE)).toBeNull();
  });
});

describe("isSupportedOembedFormat", () => {
  it("serves JSON (explicit or default) only", () => {
    expect(isSupportedOembedFormat(null)).toBe(true);
    expect(isSupportedOembedFormat("json")).toBe(true);
    expect(isSupportedOembedFormat("JSON")).toBe(true);
    expect(isSupportedOembedFormat("xml")).toBe(false);
    expect(isSupportedOembedFormat("yaml")).toBe(false);
  });
});

describe("buildOembedResponse", () => {
  const video = { slug: "moj-film", title: 'Mój "film"', thumbnailUrl: `${BASE}/t.jpg`, channelName: "Paweł", channelSlug: "pawel" };

  it("is a oEmbed 1.0 video with provider, author, thumbnail and an iframe to the embed page", () => {
    const body = buildOembedResponse({ baseUrl: BASE, providerName: "pawelperfect.com", video });
    expect(body).toMatchObject({
      type: "video",
      version: "1.0",
      title: 'Mój "film"',
      author_name: "Paweł",
      author_url: `${BASE}/pl/channel/pawel`,
      provider_name: "pawelperfect.com",
      provider_url: BASE,
      thumbnail_url: `${BASE}/t.jpg`,
      width: 640,
      height: 360,
    });
    expect(body.html).toContain(`src="${BASE}/embed/moj-film"`);
    expect(body.html).toContain('width="640" height="360"');
    expect(body.html).toContain("title=\"Mój &quot;film&quot;\"");
  });

  it("honours maxwidth and maxheight in both the numbers and the iframe", () => {
    const body = buildOembedResponse({ baseUrl: BASE, providerName: "p", video, maxWidth: 400, maxHeight: 150 });
    expect(body.height).toBeLessThanOrEqual(150);
    expect(body.width).toBeLessThanOrEqual(400);
    expect(body.html).toContain(`width="${body.width}" height="${body.height}"`);
  });

  it("omits the thumbnail fields when there is no thumbnail", () => {
    const body = buildOembedResponse({ baseUrl: BASE, providerName: "p", video: { ...video, thumbnailUrl: null } });
    expect(body).not.toHaveProperty("thumbnail_url");
    expect(body).not.toHaveProperty("thumbnail_width");
  });
});

describe("GET /api/oembed", () => {
  const url = encodeURIComponent(`${BASE}/pl?v=moj-film`);

  it("answers 200 JSON for a PUBLIC published video, cacheable and readable cross-origin", async () => {
    const res = await call(`?url=${url}&format=json`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("video");
    expect(body.html).toContain("/embed/moj-film");
    expect(body.thumbnail_url).toMatch(/^https:\/\//);
    expect(res.headers.get("cache-control")).toContain("s-maxage");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(h.findVideoForEmbed).toHaveBeenCalledWith("moj-film");
  });

  it("defaults the format to JSON", async () => {
    expect((await call(`?url=${url}`)).status).toBe(200);
  });

  it("honours maxwidth and maxheight, ignoring invalid values", async () => {
    const small = await (await call(`?url=${url}&maxwidth=320&maxheight=100`)).json();
    expect(small.width).toBeLessThanOrEqual(320);
    expect(small.height).toBeLessThanOrEqual(100);
    expect(small.html).toContain(`height="${small.height}"`);
    const invalid = await (await call(`?url=${url}&maxwidth=abc&maxheight=-1`)).json();
    expect(invalid.width).toBe(640);
  });

  it("answers 501 for a format it does not serve, without touching the database", async () => {
    const res = await call(`?url=${url}&format=xml`);
    expect(res.status).toBe(501);
    expect(h.findVideoForEmbed).not.toHaveBeenCalled();
  });

  it("answers 400 without url and 404 for a url that is not a video of this site", async () => {
    expect((await call("")).status).toBe(400);
    expect((await call(`?url=${encodeURIComponent("https://evil.example/?v=moj-film")}`)).status).toBe(404);
    expect((await call(`?url=${encodeURIComponent(`${BASE}/regulamin`)}`)).status).toBe(404);
    expect(h.findVideoForEmbed).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    ["signed-in tier", videoRow({ tier: "LOGGED_IN" })],
    ["paid tier", videoRow({ tier: "PAID" })],
    ["UNLISTED", videoRow({ status: "UNLISTED" })],
    ["DRAFT", videoRow({ status: "DRAFT" })],
    ["removed", videoRow({ moderationStatus: "REMOVED" })],
    ["18+", videoRow({ isAdult: true })],
    ["a premiere to come", videoRow({ premiereAt: new Date(Date.now() + 86_400_000) })],
    ["on a suspended channel", videoRow({ creator: { name: "x", slug: "x", status: "SUSPENDED", deletedAt: null } })],
  ])("answers the same 404 for a video that is %s (nothing about it leaks)", async (_label, row) => {
    h.findVideoForEmbed.mockResolvedValue(row);
    const res = await call(`?url=${url}`);
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toBe('{"error":"Not found"}');
    expect(text).not.toContain("film");
  });

  it("is rate-limited per IP", async () => {
    h.rateLimit.mockResolvedValue({ success: false, remaining: 0 });
    const res = await call(`?url=${url}`, "9.9.9.9");
    expect(res.status).toBe(429);
    expect(h.rateLimit).toHaveBeenCalledWith(expect.objectContaining({ key: "oembed:9.9.9.9" }));
    expect(h.findVideoForEmbed).not.toHaveBeenCalled();
  });
});
