import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { resolvePublicThumbnailSrc } from "@/lib/modules/media";
import type { FavoriteVideoItem } from "../domain/favorite-rules";
import { FavoriteRepository } from "../infrastructure/favorite.repository";

function viewerId(ctx: Pick<AppContext, "actor">): string | null {
  const { actor } = ctx;
  return actor.type === "user" || actor.type === "admin" ? actor.userId : null;
}

/**
 * Sets whether the signed-in viewer has a video in their favorites. Idempotent target state (like the like
 * reaction): the client sends what it wants, so a repeated or retried request changes nothing. Saving needs a
 * video that is on the public lists; removing never checks it, so a favorite whose video was later hidden can
 * still be cleaned up. A missing, hidden or non-listed video is 404 (it never confirms that a hidden video exists).
 */
export async function setVideoFavorite(
  input: { videoId: string; favorite: boolean },
  ctx: AppContext,
): Promise<UseCaseResult<{ favorited: boolean }, AppError>> {
  const userId = viewerId(ctx);
  if (!userId) return fail(new AppError("Unauthorized", 401, "UNAUTHORIZED"));

  const repo = new FavoriteRepository(ctx.prisma);
  if (!input.favorite) {
    await repo.remove(userId, input.videoId);
    return ok({ favorited: false });
  }
  if (!(await repo.isFavoritable(input.videoId))) return fail(new AppError("Video not found", 404, "NOT_FOUND"));
  await repo.add(userId, input.videoId);
  return ok({ favorited: true });
}

/** Whether the viewer has the video saved. A read of the viewer's own row: it reveals nothing about the video. */
export async function isVideoFavorited(userId: string, videoId: string, ctx: Pick<AppContext, "prisma">): Promise<boolean> {
  return new FavoriteRepository(ctx.prisma).has(userId, videoId);
}

/** The viewer's favorites list: still-listed videos only, newest saved first. */
export async function listFavoriteVideos(userId: string, ctx: Pick<AppContext, "prisma">): Promise<FavoriteVideoItem[]> {
  const rows = await new FavoriteRepository(ctx.prisma).listVideos(userId);
  return rows.map(({ video }) => ({
    videoId: video.id,
    slug: video.slug,
    title: video.title,
    titleEn: video.titleEn,
    thumbnailUrl: resolvePublicThumbnailSrc(
      { id: video.id, status: video.status, thumbnailUrl: video.thumbnailUrl, thumbnailPublicUrl: video.thumbnailPublicUrl },
      process.env,
    ),
    channelName: video.creator?.name ?? null,
  }));
}
