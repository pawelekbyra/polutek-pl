/** Zod schemas of the Studio playlist API (`/api/studio/playlists*`). Unknown fields are stripped: each schema is the whitelist. */
import { z } from "zod";
import { PLAYLIST_DESCRIPTION_MAX, PLAYLIST_ITEMS_MAX, PLAYLIST_TITLE_MAX, PLAYLIST_VISIBILITIES } from "@/lib/modules/playlists/domain/playlist-rules";

const id = z.string().trim().min(1).max(64);

export const playlistVisibilitySchema = z.enum(PLAYLIST_VISIBILITIES);

export const createPlaylistSchema = z.object({
  title: z.string().trim().min(1).max(PLAYLIST_TITLE_MAX),
  description: z.string().max(PLAYLIST_DESCRIPTION_MAX).nullable().optional(),
  visibility: playlistVisibilitySchema.optional(),
});

export const updatePlaylistSchema = z
  .object({
    title: z.string().trim().min(1).max(PLAYLIST_TITLE_MAX).optional(),
    description: z.string().max(PLAYLIST_DESCRIPTION_MAX).nullable().optional(),
    visibility: playlistVisibilitySchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty" });

export const playlistVideoSchema = z.object({ videoId: id });

export const playlistOrderSchema = z.object({ videoIds: z.array(id).max(PLAYLIST_ITEMS_MAX) });
