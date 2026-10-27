import { Prisma } from "@prisma/client";
import type { PublicVideoDTO } from "@/app/types/video";
import { prisma } from "@/lib/prisma";
import { VIDEO_CATEGORIES, VIDEO_CATEGORY_LABELS, isVideoCategory, type VideoCategory } from "@/lib/video-metadata";
import { toVideoAccessTier } from "@/lib/access-tier";
import { VideoContentService } from "@/lib/modules/video/infrastructure/video-content.service";
import {
  SEARCH_DURATION_BOUNDS,
  categoriesMatchingToken,
  decodeSearchCursor,
  encodeSearchCursor,
  toLikePattern,
  toPrefixTsQuery,
  uploadedCutoff,
  type PublicSearchParams,
  type SearchCursor,
  type SearchMode,
  type SearchSort,
} from "@/lib/modules/video/domain/search-query";

/**
 * Cross-channel public search (all publicly visible channels), plain Postgres with the 'simple' text configuration.
 *
 * No extension is needed (no pg_trgm, no unaccent): `Video.searchText` is a normalized copy kept by a database trigger
 * (migration 20261019170000_video_search), so diacritics and case are already folded and both techniques read one column:
 *  1. "fts": every query word is a prefix term `to_tsvector('simple', searchText) @@ to_tsquery('simple', 'word:*')`,
 *     served by the partial GIN index; words are ANDed and each may instead match the channel name or a category.
 *  2. "like": only when "fts" finds nothing on the first page, the same words as substrings (`searchText LIKE '%word%'`, backslash escapes),
 *     which finds the middle of a word ("kot" in "pieskot"). It cannot use the GIN index, so it runs over the published
 *     rows only (partial predicate + the other filters first) and only as a fallback.
 * Ordering is a keyset over (relevance, popularity bucket, publish time, id), so pages are stable and cheap.
 */

export interface SearchViewer {
  /** Signed-in viewers may see 18+ videos (same rule as the rest of the site, CLAUDE.md 4.4). */
  signedIn: boolean;
}

export interface PublicSearchItem extends PublicVideoDTO {
  tags: string[];
  category: VideoCategory | null;
  /** Short plain-text excerpt; null for videos behind sign-in (title and thumbnail only). */
  snippet: string | null;
}

export interface PublicSearchPage {
  items: PublicSearchItem[];
  nextCursor: string | null;
  mode: SearchMode;
}

interface Candidate {
  id: string;
  rel: number;
  pop: number;
  views: number;
  pub: Date;
}

const SORT_KEYS: Record<SearchSort, readonly ("rel" | "pop" | "views" | "pub" | "id")[]> = {
  relevance: ["rel", "pop", "pub", "id"],
  newest: ["pub", "id"],
  views: ["views", "pub", "id"],
};

/** Visibility shared by the results and the facets: the one place that decides what search may ever show. */
export function visibilitySql(viewer: SearchViewer, now: Date): Prisma.Sql {
  const nowIso = now.toISOString();
  return Prisma.sql`
    v."status" = 'PUBLISHED'::"VideoStatus"
    AND v."moderationStatus" <> 'REMOVED'::"VideoModerationStatus"
    ${viewer.signedIn ? Prisma.empty : Prisma.sql`AND v."moderationStatus" <> 'AGE_RESTRICTED'::"VideoModerationStatus" AND v."isAdult" = false`}
    AND (v."publishedAt" IS NULL OR v."publishedAt" <= ${nowIso}::timestamp)
    AND (v."premiereAt" IS NULL OR v."premiereAt" <= ${nowIso}::timestamp)
    AND c."status" IN ('ACTIVE'::"ChannelStatus", 'LIMITED'::"ChannelStatus")
    AND c."deletedAt" IS NULL`;
}

function filtersSql(params: PublicSearchParams, now: Date): Prisma.Sql[] {
  const parts: Prisma.Sql[] = [];
  if (params.category) parts.push(Prisma.sql`v."category" = ${params.category}`);
  if (params.tag) parts.push(Prisma.sql`EXISTS (SELECT 1 FROM unnest(v."tags") AS tg(t) WHERE video_search_normalize(tg.t) = ${params.tag})`);
  if (params.channel) parts.push(Prisma.sql`(c."slug" = ${params.channel} OR lower(c."handle") = ${params.channel})`);
  if (params.duration) {
    const [min, max] = SEARCH_DURATION_BOUNDS[params.duration];
    if (min !== null) parts.push(Prisma.sql`v."durationSeconds" >= ${min}`);
    if (max !== null) parts.push(Prisma.sql`v."durationSeconds" < ${max}`);
  }
  if (params.uploaded) parts.push(Prisma.sql`coalesce(v."publishedAt", v."createdAt") >= ${uploadedCutoff(params.uploaded, now).toISOString()}::timestamp`);
  return parts;
}

/** Channels (public ones) whose name or handle contains a query word: word -> channel ids. */
async function channelsMatchingTokens(db: SearchDb, tokens: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (tokens.length === 0) return result;
  const patterns = tokens.map(toLikePattern);
  const rows = await db.$queryRaw<{ id: string; n: string }[]>(Prisma.sql`
    SELECT c."id", video_search_normalize(concat_ws(' ', c."name", c."handle")) AS n
    FROM "Creator" c
    WHERE c."status" IN ('ACTIVE'::"ChannelStatus", 'LIMITED'::"ChannelStatus") AND c."deletedAt" IS NULL
      AND video_search_normalize(concat_ws(' ', c."name", c."handle")) LIKE ANY (${patterns}::text[])
    LIMIT 200`);
  for (const token of tokens) {
    result.set(token, rows.filter((row) => row.n.includes(token)).map((row) => row.id));
  }
  return result;
}

/**
 * The statement for one page of ids and sort keys. Exported for tests: the structure (what is filtered, in which order)
 * is the contract; the database only executes it.
 */
export function buildSearchSql(args: {
  params: PublicSearchParams;
  viewer: SearchViewer;
  mode: SearchMode;
  cursor: SearchCursor | null;
  channelIds: Map<string, string[]>;
  now: Date;
}): Prisma.Sql {
  const { params, viewer, mode, cursor, channelIds, now } = args;
  const tokens = params.tokens;

  const matchParts: Prisma.Sql[] = tokens.map((token) => {
    const ids = channelIds.get(token) ?? [];
    const cats = categoriesMatchingToken(token);
    const term =
      mode === "fts"
        ? Prisma.sql`to_tsvector('simple', v."searchText") @@ to_tsquery('simple', ${toPrefixTsQuery(token) ?? token})`
        : Prisma.sql`v."searchText" LIKE ${toLikePattern(token)}`;
    return Prisma.sql`(${term} OR v."creatorId" = ANY (${ids}::text[]) OR v."category" = ANY (${cats}::text[]))`;
  });

  // Relevance: a word in the title weighs most, then tags, category, channel; the whole phrase in the title is a bonus.
  const relParts: Prisma.Sql[] = tokens.map((token) => {
    const ids = channelIds.get(token) ?? [];
    const cats = categoriesMatchingToken(token);
    return Prisma.sql`(CASE WHEN position(${token} in n."nt") > 0 THEN 10 ELSE 0 END
      + CASE WHEN position(${token} in n."ng") > 0 THEN 6 ELSE 0 END
      + CASE WHEN v."category" = ANY (${cats}::text[]) THEN 5 ELSE 0 END
      + CASE WHEN v."creatorId" = ANY (${ids}::text[]) THEN 4 ELSE 0 END)`;
  });
  if (tokens.length > 1) relParts.push(Prisma.sql`(CASE WHEN position(${tokens.join(" ")} in n."nt") > 0 THEN 8 ELSE 0 END)`);
  const rel = relParts.length > 0 ? Prisma.join(relParts, " + ") : Prisma.sql`0`;

  const where = [visibilitySql(viewer, now), ...filtersSql(params, now), ...matchParts];

  const keyOf = (key: "rel" | "pop" | "views" | "pub" | "id"): Prisma.Sql => {
    if (!cursor) return Prisma.empty;
    if (key === "pub") return Prisma.sql`${new Date(cursor.pub).toISOString()}::timestamp`;
    if (key === "id") return Prisma.sql`${cursor.id}`;
    return Prisma.sql`${cursor[key]}::int`;
  };
  const keys = SORT_KEYS[params.sort];
  const cursorWhere = cursor
    ? Prisma.sql`WHERE (${Prisma.join(keys.map((key) => Prisma.raw(`s."${key}"`)), ", ")}) < (${Prisma.join(keys.map(keyOf), ", ")})`
    : Prisma.empty;
  const orderBy = Prisma.raw(keys.map((key) => `s."${key}" DESC`).join(", "));

  return Prisma.sql`
    SELECT s."id", s."rel", s."pop", s."views", s."pub" FROM (
      SELECT v."id", v."views"::int AS "views", coalesce(v."publishedAt", v."createdAt") AS "pub",
        floor(ln(v."views" + 1))::int AS "pop", (${rel})::int AS "rel"
      FROM "Video" v
      JOIN "Creator" c ON c."id" = v."creatorId"
      CROSS JOIN LATERAL (SELECT
        video_search_normalize(concat_ws(' ', v."title", v."titleEn")) AS "nt",
        video_search_normalize(array_to_string(v."tags", ' ')) AS "ng") n
      WHERE ${Prisma.join(where, " AND ")}
    ) s
    ${cursorWhere}
    ORDER BY ${orderBy}
    LIMIT ${params.limit + 1}`;
}

function snippetOf(text: string | null | undefined, max = 160): string | null {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Hydrates ids through the shared public DTO mapper, so thumbnails and creator avatars follow the site-wide rules. */
async function hydrate(ids: string[]): Promise<PublicSearchItem[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.video.findMany({
    where: { id: { in: ids }, status: "PUBLISHED" },
    include: { creator: { include: { user: { select: { imageUrl: true, email: true } } } } },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const items: PublicSearchItem[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) continue;
    const dto = VideoContentService.mapToPublicVideoDTO(row);
    // Behind sign-in: title and thumbnail only, like everywhere else (no description, not even an excerpt).
    const gated = toVideoAccessTier(row.tier) !== "PUBLIC";
    const tags = Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string") : [];
    items.push({
      ...dto,
      description: gated ? null : dto.description,
      descriptionEn: gated ? null : dto.descriptionEn,
      tags,
      category: isVideoCategory(row.category) ? row.category : null,
      snippet: gated ? null : snippetOf(dto.description),
    });
  }
  return items;
}

/** Upper bound for the two ranking statements of one search page (the LIKE fallback scans the catalogue). */
export const SEARCH_STATEMENT_TIMEOUT_MS = 4000;

type SearchDb = Pick<Prisma.TransactionClient, "$queryRaw">;

/** Runs the search statements in a short transaction whose statements are cancelled by PostgreSQL after the timeout. */
async function withSearchTimeout<T>(fn: (db: SearchDb) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('statement_timeout', ${String(SEARCH_STATEMENT_TIMEOUT_MS)}, true)`;
      return fn(tx);
    },
    { timeout: SEARCH_STATEMENT_TIMEOUT_MS * 2 + 2000 },
  );
}

async function runPage(params: PublicSearchParams, viewer: SearchViewer, mode: SearchMode, cursor: SearchCursor | null, now: Date): Promise<PublicSearchPage> {
  const rows = await withSearchTimeout(async (db) => {
    const channelIds = await channelsMatchingTokens(db, params.tokens);
    return db.$queryRaw<Candidate[]>(buildSearchSql({ params, viewer, mode, cursor, channelIds, now }));
  });
  const hasMore = rows.length > params.limit;
  const page = rows.slice(0, params.limit);
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeSearchCursor({ sort: params.sort, mode, rel: last.rel, pop: last.pop, views: last.views, pub: new Date(last.pub).getTime(), id: last.id })
      : null;
  return { items: await hydrate(page.map((row) => row.id)), nextCursor, mode };
}

export async function searchPublicVideos(params: PublicSearchParams, viewer: SearchViewer, now: Date = new Date()): Promise<PublicSearchPage> {
  const cursor = decodeSearchCursor(params.cursor, params.sort);
  if (cursor) return runPage(params, viewer, cursor.mode, cursor, now);

  const first = await runPage(params, viewer, "fts", null, now);
  // Partial words from the middle ("kot" in "pieskot") only exist as substrings: try again, only when there are words.
  if (first.items.length === 0 && params.tokens.length > 0) {
    const fallback = await runPage(params, viewer, "like", null, now);
    if (fallback.items.length > 0) return fallback;
  }
  return first;
}

// ---------------------------------------------------------------------------------------------------------------
// Facets: categories with counts and popular tags (the browse start of the search page and the categories endpoint).

export interface SearchFacets {
  categories: { key: VideoCategory; labelPl: string; labelEn: string; count: number }[];
  tags: { tag: string; count: number }[];
}

const FACET_TTL_MS = 60_000;
const facetCache = new Map<string, { at: number; value: SearchFacets }>();

export function clearSearchFacetCache(): void {
  facetCache.clear();
}

export async function getSearchFacets(viewer: SearchViewer, now: Date = new Date()): Promise<SearchFacets> {
  const cacheKey = viewer.signedIn ? "in" : "out";
  const cached = facetCache.get(cacheKey);
  if (cached && now.getTime() - cached.at < FACET_TTL_MS) return cached.value;

  const visibility = visibilitySql(viewer, now);
  const [categoryRows, tagRows] = await Promise.all([
    prisma.$queryRaw<{ category: string; count: number }[]>(Prisma.sql`
      SELECT v."category", count(*)::int AS "count"
      FROM "Video" v JOIN "Creator" c ON c."id" = v."creatorId"
      WHERE v."category" IS NOT NULL AND ${visibility}
      GROUP BY v."category"`),
    prisma.$queryRaw<{ tag: string; count: number }[]>(Prisma.sql`
      SELECT min(tg.t) AS "tag", count(*)::int AS "count"
      FROM "Video" v JOIN "Creator" c ON c."id" = v."creatorId", unnest(v."tags") AS tg(t)
      WHERE ${visibility}
      GROUP BY video_search_normalize(tg.t)
      HAVING video_search_normalize(tg.t) <> ''
      ORDER BY count(*) DESC, video_search_normalize(tg.t)
      LIMIT 24`),
  ]);

  const counts = new Map(categoryRows.map((row) => [row.category, row.count]));
  const value: SearchFacets = {
    categories: VIDEO_CATEGORIES.map((key) => ({ key, labelPl: VIDEO_CATEGORY_LABELS[key].pl, labelEn: VIDEO_CATEGORY_LABELS[key].en, count: counts.get(key) ?? 0 }))
      .filter((category) => category.count > 0)
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
    tags: tagRows.map((row) => ({ tag: row.tag, count: row.count })),
  };
  facetCache.set(cacheKey, { at: now.getTime(), value });
  return value;
}
