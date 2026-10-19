import { SEARCH_DURATIONS, SEARCH_SORTS, SEARCH_UPLOADED, type SearchDuration, type SearchSort, type SearchUploaded } from "@/lib/search-options";
import { VIDEO_CATEGORIES, VIDEO_CATEGORY_LABELS, VIDEO_TAG_MAX_LENGTH, isVideoCategory, normalizeTag, type VideoCategory } from "@/lib/video-metadata";

/**
 * Public search: input parsing, text normalization and the cursor. Pure (no I/O), so it is unit tested without a database.
 * The SQL lives in `application/public-search.service.ts`; the normalization here is mirrored by the Postgres function
 * `video_search_normalize()` of migration 20261019170000_video_search (a test compares the two character tables).
 */

// Latin letters with diacritics folded to ASCII, by target letter. Lower and upper case both map to the lower case letter.
const FOLD_GROUPS: Readonly<Record<string, string>> = {
  a: "ąáàâäãåāă",
  c: "ćçč",
  d: "ď",
  e: "ęéèêëēě",
  i: "íìîïī",
  l: "ł",
  n: "ńñň",
  o: "óòôöõøōő",
  r: "ř",
  s: "śšß",
  t: "ť",
  u: "úùûüūůű",
  y: "ýÿ",
  z: "żźž",
};

function buildFoldTables(): { from: string; to: string } {
  let from = "";
  let to = "";
  for (const [target, chars] of Object.entries(FOLD_GROUPS)) {
    for (const ch of chars) {
      from += ch;
      to += target;
    }
    for (const ch of chars) {
      const upper = ch.toUpperCase();
      if (upper.length === 1 && upper !== ch) {
        from += upper;
        to += target;
      }
    }
  }
  return { from, to };
}

/** The two strings passed to `translate(text, from, to)` in `video_search_normalize()`. */
export const SEARCH_FOLD_FROM = buildFoldTables().from;
export const SEARCH_FOLD_TO = buildFoldTables().to;

const FOLD_MAP = new Map<string, string>(Array.from(SEARCH_FOLD_FROM).map((ch, i) => [ch, Array.from(SEARCH_FOLD_TO)[i] as string]));

/** Whitespace, ASCII punctuation and common typographic marks: all become one space (same class as in the SQL function). */
export const SEARCH_SEPARATORS_REGEX_SOURCE = "[\\s!-/:-@\\[-`{-~„”“‚‘’«»–—…]+";

/** Lower case, diacritics folded, separators collapsed to single spaces. Never null. */
export function normalizeSearchText(input: string | null | undefined): string {
  const folded = Array.from(input ?? "")
    .map((ch) => FOLD_MAP.get(ch) ?? ch)
    .join("");
  return folded
    .toLowerCase()
    .replace(/[̀-ͯ]/g, "")
    .replace(new RegExp(SEARCH_SEPARATORS_REGEX_SOURCE, "g"), " ")
    .trim();
}

export const SEARCH_MAX_QUERY_LENGTH = 100;
export const SEARCH_MAX_TOKENS = 6;
export const SEARCH_MAX_TOKEN_LENGTH = 40;
export const SEARCH_DEFAULT_LIMIT = 20;
export const SEARCH_MAX_LIMIT = 30;

/** Words of a query after normalization; capped so a hostile query cannot build a huge statement. */
export function tokenizeSearchQuery(query: string | null | undefined): string[] {
  const normalized = normalizeSearchText((query ?? "").slice(0, SEARCH_MAX_QUERY_LENGTH));
  if (!normalized) return [];
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const word of normalized.split(" ")) {
    const token = Array.from(word).slice(0, SEARCH_MAX_TOKEN_LENGTH).join("");
    if (!token || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
    if (tokens.length >= SEARCH_MAX_TOKENS) break;
  }
  return tokens;
}

/** `to_tsquery('simple', ...)` text for one token: prefix match. Letters and digits only, so it cannot carry tsquery syntax. */
export function toPrefixTsQuery(token: string): string | null {
  const clean = token.replace(/[^\p{L}\p{N}]/gu, "");
  return clean ? `${clean}:*` : null;
}

/** `LIKE` pattern for substring matching; `%`, `_` and `\` are escaped (backslash is LIKE's default escape character). */
export function toLikePattern(token: string): string {
  return `%${token.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

/** Categories whose key or PL/EN label starts with the token ("muz" finds music): a query word can match the category too. */
export function categoriesMatchingToken(token: string): VideoCategory[] {
  if (token.length < 3) return [];
  return VIDEO_CATEGORIES.filter((key) => {
    const names = [key, VIDEO_CATEGORY_LABELS[key].pl, VIDEO_CATEGORY_LABELS[key].en];
    return names.some((name) => normalizeSearchText(name).split(" ").some((word) => word.startsWith(token)));
  });
}

export { SEARCH_SORTS, SEARCH_DURATIONS, SEARCH_UPLOADED, type SearchSort, type SearchDuration, type SearchUploaded };

/** Duration buckets in seconds: short under 4 minutes, medium 4 to 20 minutes, long over 20 minutes. [min, max) */
export const SEARCH_DURATION_BOUNDS: Readonly<Record<SearchDuration, readonly [number | null, number | null]>> = {
  short: [null, 240],
  medium: [240, 1200],
  long: [1200, null],
};

const UPLOADED_DAYS: Readonly<Record<SearchUploaded, number>> = { day: 1, week: 7, month: 30, year: 365 };

export function uploadedCutoff(uploaded: SearchUploaded, now: Date): Date {
  return new Date(now.getTime() - UPLOADED_DAYS[uploaded] * 24 * 60 * 60 * 1000);
}

export interface PublicSearchParams {
  /** Raw query as typed (trimmed, length capped). */
  q: string;
  tokens: string[];
  category: VideoCategory | null;
  /** Normalized tag as typed in the filter (compared with `video_search_normalize(tag)`). */
  tag: string | null;
  /** Channel slug or @handle, lower case. */
  channel: string | null;
  duration: SearchDuration | null;
  uploaded: SearchUploaded | null;
  sort: SearchSort;
  limit: number;
  cursor: string | null;
}

type RawValue = string | string[] | undefined | null;

function first(value: RawValue): string {
  return (Array.isArray(value) ? value[0] : value)?.toString() ?? "";
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * Validates query parameters (page URL or API). Unknown or malformed values are dropped, never an error: a stale link still
 * shows results. Without any words, "relevance" falls back to "newest" (nothing to rank by).
 */
export function parsePublicSearchParams(raw: Record<string, RawValue>): PublicSearchParams {
  const q = first(raw.q).replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_QUERY_LENGTH);
  const tokens = tokenizeSearchQuery(q);
  const categoryRaw = first(raw.category).trim().toLowerCase();
  const tagRaw = normalizeSearchText(normalizeTag(first(raw.tag)).slice(0, VIDEO_TAG_MAX_LENGTH));
  const channelRaw = first(raw.channel).trim().replace(/^@/, "").toLowerCase().slice(0, 64);
  const requestedSort = oneOf(first(raw.sort), SEARCH_SORTS) ?? "relevance";
  const sort: SearchSort = requestedSort === "relevance" && tokens.length === 0 ? "newest" : requestedSort;
  const limitRaw = Number.parseInt(first(raw.limit), 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), SEARCH_MAX_LIMIT) : SEARCH_DEFAULT_LIMIT;
  const cursor = first(raw.cursor).slice(0, 400);
  return {
    q,
    tokens,
    category: isVideoCategory(categoryRaw) ? categoryRaw : null,
    tag: tagRaw || null,
    channel: /^[a-z0-9._-]+$/.test(channelRaw) ? channelRaw : null,
    duration: oneOf(first(raw.duration), SEARCH_DURATIONS),
    uploaded: oneOf(first(raw.uploaded), SEARCH_UPLOADED),
    sort,
    limit,
    cursor: cursor || null,
  };
}

/** True when the request has anything to search by (a word or any filter); otherwise the page shows the browse start. */
export function hasSearchCriteria(params: PublicSearchParams): boolean {
  return params.tokens.length > 0 || Boolean(params.category || params.tag || params.channel || params.duration || params.uploaded);
}

// ---------------------------------------------------------------------------------------------------------------
// Cursor: keyset position of the last row of a page. Opaque to clients (base64url JSON), validated on the way back.

export type SearchMode = "fts" | "like";

export interface SearchCursor {
  /** Which sort produced it; a cursor from another sort or matching mode is ignored. */
  sort: SearchSort;
  mode: SearchMode;
  /** Relevance, popularity bucket, view count (only the ones the sort uses), then the publish time in ms and the id. */
  rel: number;
  pop: number;
  views: number;
  pub: number;
  id: string;
}

export function encodeSearchCursor(cursor: SearchCursor): string {
  return Buffer.from(JSON.stringify([cursor.sort, cursor.mode, cursor.rel, cursor.pop, cursor.views, cursor.pub, cursor.id]), "utf8").toString("base64url");
}

export function decodeSearchCursor(raw: string | null | undefined, expectedSort: SearchSort): SearchCursor | null {
  if (!raw || raw.length > 400) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== 7) return null;
    const [sort, mode, rel, pop, views, pub, id] = parsed as unknown[];
    if (sort !== expectedSort || (mode !== "fts" && mode !== "like")) return null;
    const ints = [rel, pop, views, pub];
    if (!ints.every((n) => typeof n === "number" && Number.isSafeInteger(n))) return null;
    if (typeof id !== "string" || id.length === 0 || id.length > 64) return null;
    return { sort: expectedSort, mode, rel: rel as number, pop: pop as number, views: views as number, pub: pub as number, id };
  } catch {
    return null;
  }
}
