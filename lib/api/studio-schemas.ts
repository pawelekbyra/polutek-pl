/**
 * Zod schemas for the JSON bodies of the Studio API (`/api/studio/*`). Unknown fields are stripped (zod default),
 * so each schema is also the whitelist of what a creator may set.
 */
import { z } from "zod";
import { VIDEO_CATEGORIES, VIDEO_COMMENTS_MODES, VIDEO_TAG_MAX_LENGTH, VIDEO_TAGS_MAX, normalizeTags } from "@/lib/video-metadata";

const trimmed = (max: number, min = 0) => z.string().trim().min(min).max(max);

export const createChannelSchema = z.object({
  name: trimmed(100, 1),
  handle: trimmed(60, 1),
  language: z.string().trim().min(2).max(8).nullable().optional(),
  country: z.string().trim().length(2).nullable().optional(),
});

export const updateChannelProfileSchema = z.object({
  name: trimmed(100, 1).optional(),
  bio: z.string().max(1500).nullable().optional(),
  language: z.string().trim().min(2).max(8).nullable().optional(),
  country: z.string().trim().length(2).nullable().optional(),
});

export const changeHandleSchema = z.object({ handle: trimmed(60, 1) });

export const restoreChannelSchema = z.object({ channelId: z.string().min(1).max(64) });

/** What a creator may choose today: free for everyone or for signed-in viewers. Paid access arrives with sales. */
export const studioTierSchema = z.enum(["PUBLIC", "LOGGED_IN"]);

/** Free-form tags: at most 15 of 30 characters each; normalized (trimmed, no `#`, no duplicates) before they reach a use case. */
export const studioTagsSchema = z
  .array(z.string().max(200))
  .max(VIDEO_TAGS_MAX * 2)
  .transform(normalizeTags)
  .pipe(z.array(z.string().min(1).max(VIDEO_TAG_MAX_LENGTH)).max(VIDEO_TAGS_MAX));

/** Whitelists of the "Więcej opcji" section; `category: null` clears the category. */
const videoMetadataFields = {
  tags: studioTagsSchema.optional(),
  category: z.enum(VIDEO_CATEGORIES).nullable().optional(),
  commentsMode: z.enum(VIDEO_COMMENTS_MODES).optional(),
  /** Creator's 18+ declaration: signed-in viewers only (same effect as the AGE_RESTRICTED moderation state). */
  isAdult: z.boolean().optional(),
};

export const createVideoSchema = z.object({
  title: trimmed(100, 1),
  titleEn: z.string().trim().max(100).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  descriptionEn: z.string().max(5000).nullable().optional(),
  tier: studioTierSchema.optional(),
  /**
   * "Publish on its own once processing finishes": the same flag the panel sets at creation. The use case that
   * stores it authorizes `video.create`, and the worker later publishes through `publishAdminVideo`, which
   * authorizes `video.publish` and re-checks every publication blocker; both actions sit in the same role sets.
   */
  publishAfterAssetReady: z.boolean().optional(),
  /** ISO instant of a scheduled premiere (must be in the future; the use case validates it). */
  premiereAt: z.string().datetime({ offset: true }).nullable().optional(),
  /**
   * What the video becomes when processing finishes (only with `publishAfterAssetReady`): `PUBLISHED` (default) or
   * `UNLISTED` ("Niepubliczny": reachable by link, never listed). An unlisted video cannot have a premiere.
   */
  publishAs: z.enum(["PUBLISHED", "UNLISTED"]).optional(),
  ...videoMetadataFields,
}).refine((value) => !(value.publishAs === "UNLISTED" && value.premiereAt), {
  message: "Film niepubliczny nie może mieć premiery.",
  path: ["premiereAt"],
});

export const updateVideoSchema = z.object({
  title: trimmed(100, 1).optional(),
  titleEn: z.string().trim().max(100).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  descriptionEn: z.string().max(5000).nullable().optional(),
  tier: studioTierSchema.optional(),
  /** ISO instant or null ("publish immediately"). */
  premiereAt: z.string().datetime({ offset: true }).nullable().optional(),
  showInSidebar: z.boolean().optional(),
  ...videoMetadataFields,
});

/** Filters of the Studio video list. Whitelists: nothing else reaches the repository's `where` or `orderBy`. */
export const STUDIO_VIDEO_STATUS_FILTERS = ["DRAFT", "PUBLISHED", "UNLISTED", "ARCHIVED"] as const;
export const STUDIO_VIDEO_SORTS = ["newest", "views"] as const;

export const studioVideosQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(STUDIO_VIDEO_STATUS_FILTERS).optional(),
  sort: z.enum(STUDIO_VIDEO_SORTS).optional(),
});

/** Sort key to the repository's `orderBy` column (descending). */
export const STUDIO_VIDEO_ORDER_BY: Record<(typeof STUDIO_VIDEO_SORTS)[number], string> = {
  newest: "createdAt",
  views: "views",
};

/**
 * `publish` = Publiczny, `unlist` = Niepubliczny (link only), `unpublish` = back to a private draft (Prywatny),
 * `archive`, `cancel_auto_publish`. PUBLISHED <-> UNLISTED <-> DRAFT are all allowed; each entry into PUBLISHED or
 * UNLISTED goes through the publication blockers.
 */
export const publishVideoSchema = z.object({ action: z.enum(["publish", "unlist", "unpublish", "archive", "cancel_auto_publish"]) });

export const commentActionSchema = z.object({
  action: z.enum(["hide", "approve", "restore", "hold", "delete", "heart", "unheart", "pin", "unpin", "reply"]),
  text: z.string().max(2000).optional(),
  heart: z.boolean().optional(),
});

export const studioCommentsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["VISIBLE", "HELD_FOR_REVIEW", "HIDDEN", "DELETED"]).optional(),
  videoId: z.string().max(64).optional(),
  reported: z.enum(["1", "true"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
});

/** An appeal against a moderation decision (DSA art. 20): 20-2000 characters. */
export const moderationAppealSchema = z.object({ text: z.string().trim().min(20).max(2000) }).strict();

/** Blocking a viewer from commenting on the channel; `until` empty = until further notice. */
export const channelBanSchema = z
  .object({
    userId: z.string().trim().min(1).max(64),
    until: z.string().trim().datetime({ offset: true }).nullable().optional(),
    reason: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const channelUnbanSchema = z.object({ userId: z.string().trim().min(1).max(64) }).strict();
