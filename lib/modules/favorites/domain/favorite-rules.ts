import type { Prisma } from "@prisma/client";
import { publiclyVisibleChannelWhere } from "@/lib/modules/channel";

/** Most videos the favorites list returns (a viewer's own list; newest saved first). */
export const FAVORITES_LIST_LIMIT = 60;

/**
 * A video the viewer may save: one that is on the public lists (PUBLISHED, not removed by moderation, on a
 * publicly visible channel). The viewer's tier and entitlements are deliberately not part of it: a locked
 * premium video is on the list too, so it can be saved (opening it still goes through `checkVideoAccess`).
 * UNLISTED, drafts and archived videos are not on any list and cannot be favorited.
 */
export function favoritableVideoWhere(): Prisma.VideoWhereInput {
  return {
    status: "PUBLISHED",
    moderationStatus: { not: "REMOVED" },
    creator: publiclyVisibleChannelWhere(),
  };
}

/** What the favorites list shows per video (plain values; the thumbnail `src` is resolved by the use case). */
export interface FavoriteVideoItem {
  videoId: string;
  slug: string;
  title: string;
  titleEn: string | null;
  /** Safe thumbnail `src` (public R2 copy or the thumbnail proxy), never the stored value. */
  thumbnailUrl: string;
  channelName: string | null;
}
