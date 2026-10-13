/**
 * Zod schemas for the JSON bodies of the Studio API (`/api/studio/*`). Unknown fields are stripped (zod default),
 * so each schema is also the whitelist of what a creator may set.
 */
import { z } from "zod";

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

export const createVideoSchema = z.object({
  title: trimmed(100, 1),
  titleEn: z.string().trim().max(100).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  descriptionEn: z.string().max(5000).nullable().optional(),
  tier: studioTierSchema.optional(),
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
});

export const publishVideoSchema = z.object({ action: z.enum(["publish", "archive"]) });

export const commentActionSchema = z.object({
  action: z.enum(["hide", "approve", "restore", "hold", "delete", "heart", "unheart", "reply"]),
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
