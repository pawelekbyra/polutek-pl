import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  auth: vi.fn(),
  searchPublicVideos: vi.fn(),
  getSearchFacets: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));
vi.mock("@/lib/auth/server", () => ({ auth: m.auth }));
vi.mock("@/lib/media/rate-limit", () => ({ getMediaClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/modules/video", async () => ({
  ...(await vi.importActual<typeof import("@/lib/modules/video/domain/search-query")>("@/lib/modules/video/domain/search-query")),
  searchPublicVideos: m.searchPublicVideos,
  getSearchFacets: m.getSearchFacets,
}));

import { GET as searchGet } from "@/app/api/search/route";
import { GET as facetsGet } from "@/app/api/search/categories/route";

const req = (path: string) => new NextRequest(`http://localhost${path}`);

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.rateLimit.mockResolvedValue({ success: true, remaining: 10 });
  m.auth.mockResolvedValue({ user: null });
});

describe("GET /api/search", () => {
  it("is rate limited per client address", async () => {
    m.rateLimit.mockResolvedValue({ success: false, remaining: 0 });
    const res = await searchGet(req("/api/search?q=kot"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(m.rateLimit.mock.calls[0]![0]).toMatchObject({ key: "search:1.2.3.4" });
    expect(m.searchPublicVideos).not.toHaveBeenCalled();
  });

  it("parses the query, passes the viewer and answers with a whitelist, never cached", async () => {
    m.auth.mockResolvedValue({ user: { id: "u1" } });
    m.searchPublicVideos.mockResolvedValue({
      items: [
        {
          id: "v1", slug: "film", title: "Film", titleEn: null, snippet: "x", thumbnailUrl: "/t.jpg", duration: "1:00", tier: "PUBLIC", views: 3,
          publishedAt: "2026-10-01T00:00:00.000Z", isAdult: false, tags: ["a"], category: "music",
          creator: { id: "c1", name: "K", slug: "k", subscribersCount: 99, imageUrl: null },
          creatorId: "c1", status: "PUBLISHED", description: "secret", likesCount: 1, dislikesCount: 0,
        },
      ],
      nextCursor: "abc",
      mode: "fts",
    });
    const res = await searchGet(req("/api/search?q=kot&category=music&sort=views&limit=5"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const [params, viewer] = m.searchPublicVideos.mock.calls[0]!;
    expect(params).toMatchObject({ q: "kot", category: "music", sort: "views", limit: 5 });
    expect(viewer).toEqual({ signedIn: true });
    const body = await res.json();
    expect(body.nextCursor).toBe("abc");
    expect(Object.keys(body.items[0]).sort()).toEqual(
      ["category", "channel", "duration", "id", "isAdult", "publishedAt", "slug", "snippet", "tags", "thumbnailUrl", "tier", "title", "titleEn", "views"].sort(),
    );
    expect(body.items[0].channel).toEqual({ id: "c1", name: "K", slug: "k" });
  });

  it("treats a failed session lookup as a guest", async () => {
    m.auth.mockRejectedValue(new Error("down"));
    m.searchPublicVideos.mockResolvedValue({ items: [], nextCursor: null, mode: "fts" });
    await searchGet(req("/api/search?q=kot"));
    expect(m.searchPublicVideos.mock.calls[0]![1]).toEqual({ signedIn: false });
  });
});

describe("GET /api/search/categories", () => {
  it("is rate limited and returns the facets uncached", async () => {
    m.getSearchFacets.mockResolvedValue({ categories: [{ key: "music", labelPl: "Muzyka", labelEn: "Music", count: 2 }], tags: [] });
    const ok = await facetsGet(req("/api/search/categories"));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await ok.json()).categories[0]).toMatchObject({ key: "music", count: 2 });

    m.rateLimit.mockResolvedValue({ success: false, remaining: 0 });
    expect((await facetsGet(req("/api/search/categories"))).status).toBe(429);
  });
});
