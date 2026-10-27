import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({ queryRaw: vi.fn(), findMany: vi.fn() }));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    $queryRaw: hoisted.queryRaw,
    video: { findMany: hoisted.findMany },
    // The search statements run in a transaction that sets statement_timeout first (W01); that first call is a set_config.
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: (strings: TemplateStringsArray | { sql?: string }, ...rest: unknown[]) =>
          Array.isArray(strings) && String(strings[0]).includes("set_config") ? Promise.resolve([]) : (hoisted.queryRaw as (...a: unknown[]) => unknown)(strings, ...rest),
      }),
  };
  return { prisma };
});
vi.mock("@/lib/modules/channel", async () => ({
  MainChannelService: { getOptional: vi.fn() },
  publiclyVisibleChannelWhere: () => ({ status: { in: ["ACTIVE", "LIMITED"] }, deletedAt: null }),
  ...(await vi.importActual<typeof import("@/lib/modules/channel/domain/channel-avatar")>("@/lib/modules/channel/domain/channel-avatar")),
}));

import { SEARCH_STATEMENT_TIMEOUT_MS, buildSearchSql, clearSearchFacetCache, getSearchFacets, searchPublicVideos, visibilitySql } from "@/lib/modules/video/application/public-search.service";
import { decodeSearchCursor, encodeSearchCursor, parsePublicSearchParams } from "@/lib/modules/video/domain/search-query";

const NOW = new Date("2026-10-19T12:00:00.000Z");
const guest = { signedIn: false };
const member = { signedIn: true };
const parse = (raw: Record<string, string>) => parsePublicSearchParams(raw);
const sqlOf = (raw: Record<string, string>, viewer = guest, mode: "fts" | "like" = "fts", cursor = null as ReturnType<typeof decodeSearchCursor>) =>
  buildSearchSql({ params: parse(raw), viewer, mode, cursor, channelIds: new Map(), now: NOW });

beforeEach(() => {
  hoisted.queryRaw.mockReset();
  hoisted.findMany.mockReset();
  clearSearchFacetCache();
});

describe("visibility: what search may ever show", () => {
  it("only PUBLISHED, not removed, past publish and premiere time, visible channel", () => {
    const text = visibilitySql(guest, NOW).sql;
    expect(text).toContain(`v."status" = 'PUBLISHED'`);
    expect(text).toContain(`v."moderationStatus" <> 'REMOVED'`);
    expect(text).toContain(`v."publishedAt" IS NULL OR v."publishedAt" <=`);
    expect(text).toContain(`v."premiereAt" IS NULL OR v."premiereAt" <=`);
    expect(text).toContain(`c."status" IN ('ACTIVE'::"ChannelStatus", 'LIMITED'::"ChannelStatus")`);
    expect(text).toContain(`c."deletedAt" IS NULL`);
    for (const word of ["UNLISTED", "DRAFT", "ARCHIVED", "SUSPENDED"]) expect(text).not.toContain(word);
  });
  it("hides 18+ and age-restricted videos from guests, not from signed-in viewers", () => {
    expect(visibilitySql(guest, NOW).sql).toContain(`'AGE_RESTRICTED'`);
    expect(visibilitySql(guest, NOW).sql).toContain(`"isAdult" = false`);
    expect(visibilitySql(member, NOW).sql).not.toContain(`AGE_RESTRICTED`);
    expect(visibilitySql(member, NOW).sql).not.toContain(`isAdult`);
  });
  it("uses the same rules in every search statement", () => {
    for (const raw of [{ q: "kot" }, { category: "music" }, { tag: "a", sort: "views" }]) {
      expect(sqlOf(raw).sql).toContain(visibilitySql(guest, NOW).sql);
    }
  });
  it("does not scope to one channel unless asked (all channels)", () => {
    expect(sqlOf({ q: "kot" }).sql).not.toContain(`c."slug" =`);
    expect(sqlOf({ q: "kot", channel: "abc" }).sql).toContain(`c."slug" =`);
  });
});

describe("buildSearchSql", () => {
  it("ands the words; each word may match text, channel name or category", () => {
    const sql = sqlOf({ q: "kot muzyka" });
    expect(sql.sql.match(/to_tsvector\('simple', v\."searchText"\) @@ to_tsquery\('simple'/g)).toHaveLength(2);
    expect(sql.sql).toContain(`v."creatorId" = ANY`);
    expect(sql.sql).toContain(`v."category" = ANY`);
    expect(sql.values).toContain("kot:*");
    expect(sql.values).toContain("muzyka:*");
  });
  it("uses substring matching in the fallback mode only", () => {
    expect(sqlOf({ q: "kot" }, guest, "fts").sql).not.toContain("LIKE");
    const like = sqlOf({ q: "kot" }, guest, "like");
    expect(like.sql).toContain(`v."searchText" LIKE`);
    expect(like.sql).not.toContain("to_tsquery");
    expect(like.values).toContain("%kot%");
  });
  it("applies filters as parameters", () => {
    const sql = sqlOf({ category: "music", tag: "Żółć", channel: "@Moj-Kanal", duration: "medium", uploaded: "month" });
    expect(sql.values).toEqual(expect.arrayContaining(["music", "zolc", "moj-kanal", 240, 1200]));
    expect(sql.sql).toContain(`"durationSeconds" >=`);
    expect(sql.sql).toContain(`"durationSeconds" <`);
    expect(sql.sql).toContain(`video_search_normalize(tg.t) =`);
    expect(sql.values).toContain(new Date(NOW.getTime() - 30 * 86_400_000).toISOString());
  });
  it("never inlines user text into the statement", () => {
    const sql = sqlOf({ q: "kot'; DROP TABLE Video; --", tag: "x'--", channel: "abc" });
    expect(sql.sql).not.toMatch(/DROP|kot|x'--|abc/);
  });
  it("orders by the sort and asks one row more than the page size", () => {
    expect(sqlOf({ q: "kot" }).sql).toContain(`ORDER BY s."rel" DESC, s."pop" DESC, s."pub" DESC, s."id" DESC`);
    expect(sqlOf({ q: "kot", sort: "newest" }).sql).toContain(`ORDER BY s."pub" DESC, s."id" DESC`);
    expect(sqlOf({ q: "kot", sort: "views" }).sql).toContain(`ORDER BY s."views" DESC, s."pub" DESC, s."id" DESC`);
    expect(sqlOf({ q: "kot", limit: "5" }).values.at(-1)).toBe(6);
  });
  it("continues after the cursor with a keyset comparison", () => {
    const cursor = decodeSearchCursor(encodeSearchCursor({ sort: "relevance", mode: "fts", rel: 20, pop: 2, views: 9, pub: NOW.getTime(), id: "v9" }), "relevance");
    const sql = sqlOf({ q: "kot" }, guest, "fts", cursor);
    expect(sql.sql).toContain(`WHERE (s."rel", s."pop", s."pub", s."id") < (`);
    expect(sql.values).toEqual(expect.arrayContaining([20, 2, "v9", NOW.toISOString()]));
    expect(sqlOf({ q: "kot" }).sql).not.toContain(`WHERE (s.`);
  });
});

const videoRow = (over: Record<string, unknown> = {}) => ({
  id: "v1",
  creatorId: "c1",
  slug: "film",
  title: "Film",
  titleEn: null,
  description: "Opis filmu",
  descriptionEn: null,
  thumbnailUrl: "/t.jpg",
  thumbnailPublicUrl: null,
  duration: "3:20",
  tier: "PUBLIC",
  status: "PUBLISHED",
  views: 5,
  likesCount: 0,
  dislikesCount: 0,
  tags: ["kot", "pies"],
  category: "music",
  premiereAt: null,
  publishedAt: new Date("2026-10-01T00:00:00Z"),
  creator: { id: "c1", name: "Kanal", slug: "kanal", subscribersCount: 1, user: { imageUrl: null } },
  ...over,
});

describe("searchPublicVideos", () => {
  it("returns hydrated items in query order with a cursor when there is another page", async () => {
    hoisted.queryRaw
      .mockResolvedValueOnce([]) // channels
      .mockResolvedValueOnce([
        { id: "v2", rel: 10, pop: 1, views: 3, pub: new Date("2026-10-02T00:00:00Z") },
        { id: "v1", rel: 10, pop: 1, views: 3, pub: new Date("2026-10-01T00:00:00Z") },
        { id: "v0", rel: 5, pop: 0, views: 0, pub: new Date("2026-09-01T00:00:00Z") },
      ]);
    hoisted.findMany.mockResolvedValue([videoRow({ id: "v1" }), videoRow({ id: "v2", slug: "drugi" })]);
    const page = await searchPublicVideos(parse({ q: "kot", limit: "2" }), guest, NOW);
    expect(page.items.map((i) => i.id)).toEqual(["v2", "v1"]);
    expect(page.items[0]).toMatchObject({ tags: ["kot", "pies"], category: "music", snippet: "Opis filmu" });
    const next = decodeSearchCursor(page.nextCursor, "relevance");
    expect(next).toMatchObject({ mode: "fts", rel: 10, id: "v1", pub: Date.parse("2026-10-01T00:00:00Z") });
    expect(hoisted.findMany.mock.calls[0]![0].where).toMatchObject({ status: "PUBLISHED" });
  });

  it("runs the ranking statements under a PostgreSQL statement_timeout (W01)", async () => {
    const { prisma } = await import("@/lib/prisma");
    const spy = vi.spyOn(prisma as unknown as { $transaction: (fn: (tx: unknown) => unknown) => unknown }, "$transaction");
    hoisted.queryRaw.mockResolvedValue([]);
    hoisted.findMany.mockResolvedValue([]);
    await searchPublicVideos(parse({ q: "kot" }), guest, NOW);
    expect(spy).toHaveBeenCalled();
    expect(SEARCH_STATEMENT_TIMEOUT_MS).toBe(4000);
    spy.mockRestore();
  });

  it("ends the list when the last page is short", async () => {
    hoisted.queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "v1", rel: 1, pop: 0, views: 0, pub: new Date() }]);
    hoisted.findMany.mockResolvedValue([videoRow()]);
    expect((await searchPublicVideos(parse({ q: "kot" }), guest, NOW)).nextCursor).toBeNull();
  });

  it("shows only title and thumbnail of a video behind sign-in", async () => {
    hoisted.queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "v1", rel: 1, pop: 0, views: 0, pub: new Date() }]);
    hoisted.findMany.mockResolvedValue([videoRow({ tier: "LOGGED_IN", description: "Tajny opis", descriptionEn: "Secret" })]);
    const [item] = (await searchPublicVideos(parse({ q: "kot" }), guest, NOW)).items;
    expect(item).toMatchObject({ title: "Film", description: null, descriptionEn: null, snippet: null, tier: "LOGGED_IN" });
    expect(item!.thumbnailUrl).toBeTruthy();
  });

  it("falls back to substring matching only when the word search finds nothing", async () => {
    hoisted.queryRaw
      .mockResolvedValueOnce([]) // channels (fts)
      .mockResolvedValueOnce([]) // fts: nothing
      .mockResolvedValueOnce([]) // channels (like)
      .mockResolvedValueOnce([{ id: "v1", rel: 10, pop: 0, views: 0, pub: new Date() }]);
    hoisted.findMany.mockResolvedValue([videoRow()]);
    const page = await searchPublicVideos(parse({ q: "ot" }), guest, NOW);
    expect(page.mode).toBe("like");
    expect(page.items).toHaveLength(1);
    expect(hoisted.queryRaw).toHaveBeenCalledTimes(4);
  });

  it("does not run the fallback for a filter-only browse", async () => {
    hoisted.queryRaw.mockResolvedValueOnce([]);
    const page = await searchPublicVideos(parse({ category: "music" }), guest, NOW);
    expect(page.items).toEqual([]);
    // One statement: no words means no channel lookup and no substring retry.
    expect(hoisted.queryRaw).toHaveBeenCalledTimes(1);
  });

  it("drops ids that are no longer PUBLISHED when hydrating (race with unpublish)", async () => {
    hoisted.queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "gone", rel: 1, pop: 0, views: 0, pub: new Date() }]).mockResolvedValue([]);
    hoisted.findMany.mockResolvedValue([]);
    expect((await searchPublicVideos(parse({ q: "kot" }), guest, NOW)).items).toEqual([]);
  });
});

describe("getSearchFacets", () => {
  it("lists categories with counts (biggest first, unknown ones left out) and caches briefly", async () => {
    hoisted.queryRaw
      .mockResolvedValueOnce([{ category: "music", count: 2 }, { category: "news", count: 5 }, { category: "bogus", count: 9 }])
      .mockResolvedValueOnce([{ tag: "kot", count: 3 }]);
    const facets = await getSearchFacets(guest, NOW);
    expect(facets.categories.map((c) => [c.key, c.count])).toEqual([["news", 5], ["music", 2]]);
    expect(facets.categories[0]).toMatchObject({ labelPl: "Wiadomości", labelEn: "News" });
    expect(facets.tags).toEqual([{ tag: "kot", count: 3 }]);
    await getSearchFacets(guest, new Date(NOW.getTime() + 1000));
    expect(hoisted.queryRaw).toHaveBeenCalledTimes(2);
    hoisted.queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await getSearchFacets(member, NOW);
    expect(hoisted.queryRaw).toHaveBeenCalledTimes(4);
  });
});
