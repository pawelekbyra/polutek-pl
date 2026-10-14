/**
 * Creator-set video metadata: tags, category and comments mode (Studio "Więcej opcji"). Pure and client-safe
 * (like `lib/access-tier.ts`): the Studio form, the zod whitelists and the use cases share these limits.
 * The database only caps the number of tags (CHECK in migration 20261013160000); the rest is validated here.
 */
export const VIDEO_TAGS_MAX = 15;
export const VIDEO_TAG_MAX_LENGTH = 30;

/** Closed list of categories; stored as the key, labelled in the UI. */
export const VIDEO_CATEGORIES = ["education", "entertainment", "music", "gaming", "news", "science", "sports", "people", "howto", "other"] as const;
export type VideoCategory = (typeof VIDEO_CATEGORIES)[number];

/** Same values as the Prisma enum `VideoCommentsMode`: ON = published at once, HELD = review first, OFF = no new comments. */
export const VIDEO_COMMENTS_MODES = ["ON", "HELD", "OFF"] as const;
export type VideoCommentsModeValue = (typeof VIDEO_COMMENTS_MODES)[number];

export function isVideoCategory(value: unknown): value is VideoCategory {
  return typeof value === "string" && (VIDEO_CATEGORIES as readonly string[]).includes(value);
}

export function isVideoCommentsMode(value: unknown): value is VideoCommentsModeValue {
  return typeof value === "string" && (VIDEO_COMMENTS_MODES as readonly string[]).includes(value);
}

/** One tag as stored: single spaces, no leading `#`. Empty string when nothing is left. */
export function normalizeTag(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().replace(/^#+\s*/, "").trim();
}

/** Normalizes a list: trims, drops empties, removes case-insensitive duplicates (first wins), keeps order. Does not truncate. */
export function normalizeTags(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const tag = normalizeTag(item);
    if (!tag) continue;
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** `null` when the (already normalized) list is within limits; otherwise which limit is broken. */
export function validateTags(tags: readonly string[]): "TOO_MANY" | "TOO_LONG" | null {
  if (tags.length > VIDEO_TAGS_MAX) return "TOO_MANY";
  if (tags.some((tag) => [...tag].length > VIDEO_TAG_MAX_LENGTH)) return "TOO_LONG";
  return null;
}
