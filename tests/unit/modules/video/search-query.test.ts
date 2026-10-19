import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SEARCH_FOLD_FROM,
  SEARCH_FOLD_TO,
  SEARCH_SEPARATORS_REGEX_SOURCE,
  SEARCH_MAX_TOKENS,
  categoriesMatchingToken,
  decodeSearchCursor,
  encodeSearchCursor,
  hasSearchCriteria,
  normalizeSearchText,
  parsePublicSearchParams,
  toLikePattern,
  toPrefixTsQuery,
  tokenizeSearchQuery,
} from "@/lib/modules/video/domain/search-query";
import { buildSearchQuery } from "@/lib/search-href";
import { VIDEO_CATEGORIES, VIDEO_CATEGORY_LABELS } from "@/lib/video-metadata";
import { videoCategoryLabel } from "@/lib/video-category-label";
import { createTx } from "@/lib/i18n/ui";

describe("normalizeSearchText", () => {
  it("folds Polish and other Latin diacritics, case and separators", () => {
    expect(normalizeSearchText("  Żółć, GĘŚLĄ jaźń!  ")).toBe("zolc gesla jazn");
    expect(normalizeSearchText("Crème-brûlée / Süß_Ärger")).toBe("creme brulee sus arger");
    expect(normalizeSearchText("„Cytat” – test…")).toBe("cytat test");
  });
  it("keeps non-Latin scripts and digits", () => {
    expect(normalizeSearchText("视频 2026")).toBe("视频 2026");
  });
  it("is empty for nothing", () => {
    expect(normalizeSearchText(null)).toBe("");
    expect(normalizeSearchText(" ... ")).toBe("");
  });
});

describe("the SQL function video_search_normalize mirrors the TypeScript tables", () => {
  const sql = readFileSync("prisma/migrations/20261019170000_video_search/migration.sql", "utf8");
  it("uses the same translate() character tables", () => {
    expect(sql).toContain(`'${SEARCH_FOLD_FROM}', '${SEARCH_FOLD_TO}'`);
    expect(Array.from(SEARCH_FOLD_FROM)).toHaveLength(Array.from(SEARCH_FOLD_TO).length);
  });
  it("uses the same separator class", () => {
    expect(sql).toContain(`'${SEARCH_SEPARATORS_REGEX_SOURCE.replace(/\\\\/g, "\\")}'`);
  });
  it("is additive: no DROP, no extension", () => {
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/CREATE\s+EXTENSION/i);
  });
  it("indexes only published videos", () => {
    expect(sql).toMatch(/USING GIN \(to_tsvector\('simple', "searchText"\)\) WHERE "status" = 'PUBLISHED'/);
  });
  it("leaves the description of gated videos out of the search text", () => {
    expect(sql).toContain(`CASE WHEN NEW."tier" = 'PUBLIC' THEN`);
  });
});

describe("tokenizeSearchQuery", () => {
  it("splits, folds and dedupes words", () => {
    expect(tokenizeSearchQuery("Kot  kot ŻÓŁW")).toEqual(["kot", "zolw"]);
  });
  it("caps the number and the length of words", () => {
    expect(tokenizeSearchQuery("a b c d e f g h i")).toHaveLength(SEARCH_MAX_TOKENS);
    expect(tokenizeSearchQuery("x".repeat(90))[0]).toHaveLength(40);
  });
});

describe("tsquery and LIKE helpers cannot carry syntax", () => {
  it("builds a prefix term from letters and digits only", () => {
    expect(toPrefixTsQuery("kot")).toBe("kot:*");
    expect(toPrefixTsQuery("a'|&!:*b")).toBe("ab:*");
    expect(toPrefixTsQuery("''")).toBeNull();
  });
  it("escapes LIKE wildcards", () => {
    expect(toLikePattern("50%_a\\b")).toBe("%50\\%\\_a\\\\b%");
  });
});

describe("categoriesMatchingToken", () => {
  it("matches key and PL/EN labels by word prefix", () => {
    expect(categoriesMatchingToken("muz")).toEqual(["music"]);
    expect(categoriesMatchingToken("music")).toEqual(["music"]);
    expect(categoriesMatchingToken("technika")).toEqual(["science"]);
    expect(categoriesMatchingToken("po")).toEqual([]);
  });
});

describe("parsePublicSearchParams", () => {
  it("accepts valid filters", () => {
    const p = parsePublicSearchParams({ q: " Kot  w butach ", category: "music", tag: "#Zażółć", channel: "@Moj-Kanal", duration: "long", uploaded: "week", sort: "views", limit: "5" });
    expect(p).toMatchObject({ q: "Kot w butach", tokens: ["kot", "w", "butach"], category: "music", tag: "zazolc", channel: "moj-kanal", duration: "long", uploaded: "week", sort: "views", limit: 5 });
  });
  it("drops unknown values instead of failing", () => {
    const p = parsePublicSearchParams({ category: "cats", duration: "forever", uploaded: "never", sort: "random", channel: "bad slug!", limit: "9999" });
    expect(p).toMatchObject({ category: null, duration: null, uploaded: null, channel: null, sort: "newest", limit: 30 });
  });
  it("falls back from relevance to newest without words, keeps it with words", () => {
    expect(parsePublicSearchParams({}).sort).toBe("newest");
    expect(parsePublicSearchParams({ q: "kot" }).sort).toBe("relevance");
  });
  it("takes the first of repeated parameters and caps the query", () => {
    expect(parsePublicSearchParams({ q: ["a", "b"] }).q).toBe("a");
    expect(parsePublicSearchParams({ q: "x".repeat(500) }).q).toHaveLength(100);
  });
  it("knows when there is nothing to search by", () => {
    expect(hasSearchCriteria(parsePublicSearchParams({}))).toBe(false);
    expect(hasSearchCriteria(parsePublicSearchParams({ category: "music" }))).toBe(true);
    expect(hasSearchCriteria(parsePublicSearchParams({ q: "..." }))).toBe(false);
  });
});

describe("search cursor", () => {
  const cursor = { sort: "relevance", mode: "fts", rel: 26, pop: 3, views: 41, pub: 1_760_000_000_123, id: "abc-1" } as const;
  it("round-trips", () => {
    expect(decodeSearchCursor(encodeSearchCursor(cursor), "relevance")).toEqual(cursor);
  });
  it("is ignored for another sort, garbage or tampered shapes", () => {
    const raw = encodeSearchCursor(cursor);
    expect(decodeSearchCursor(raw, "newest")).toBeNull();
    expect(decodeSearchCursor("not-base64-json", "relevance")).toBeNull();
    expect(decodeSearchCursor(null, "relevance")).toBeNull();
    const tampered = Buffer.from(JSON.stringify(["relevance", "sql", 1, 1, 1, 1, "x"])).toString("base64url");
    expect(decodeSearchCursor(tampered, "relevance")).toBeNull();
    const floats = Buffer.from(JSON.stringify(["relevance", "fts", 1.5, 1, 1, 1, "x"])).toString("base64url");
    expect(decodeSearchCursor(floats, "relevance")).toBeNull();
    const long = Buffer.from(JSON.stringify(["relevance", "fts", 1, 1, 1, 1, "x".repeat(200)])).toString("base64url");
    expect(decodeSearchCursor(long, "relevance")).toBeNull();
  });
});

describe("buildSearchQuery", () => {
  it("writes only set values in a stable order", () => {
    expect(buildSearchQuery({ q: "kot", category: "music", sort: "relevance", cursor: null })).toBe("q=kot&category=music");
    expect(buildSearchQuery({ tag: "a b", sort: "views" })).toBe("tag=a+b&sort=views");
    expect(buildSearchQuery({})).toBe("");
  });
});

describe("category labels are written once", () => {
  it("videoCategoryLabel gives exactly the PL and EN names of VIDEO_CATEGORY_LABELS", () => {
    for (const key of VIDEO_CATEGORIES) {
      expect(videoCategoryLabel(createTx("pl"), key)).toBe(VIDEO_CATEGORY_LABELS[key].pl);
      expect(videoCategoryLabel(createTx("en"), key)).toBe(VIDEO_CATEGORY_LABELS[key].en);
    }
    expect(videoCategoryLabel(createTx("pl"), "nope")).toBe("");
    expect(videoCategoryLabel(createTx("pl"), null)).toBe("");
  });
});
