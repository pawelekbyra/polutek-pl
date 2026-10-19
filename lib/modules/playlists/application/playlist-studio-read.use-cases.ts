import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { authorize } from "@/lib/modules/authz";
import { resolvePublicThumbnailSrc } from "@/lib/modules/media";
import type { StudioPlaylistDto, StudioPlaylistSummaryDto } from "../domain/playlist.dto";
import type { PlaylistVisibilityValue } from "../domain/playlist-rules";
import { isPlaylistItemVisible } from "../domain/playlist-visibility";
import { PlaylistRepository } from "../infrastructure/playlist.repository";
import { toSummary } from "./playlist-manage.use-cases";

/** Creator-side reads: the same authorization as editing (a member who may not edit playlists does not see them). */

export async function listStudioPlaylists(ctx: AppContext, input: { channelId: string }): Promise<UseCaseResult<{ items: StudioPlaylistSummaryDto[] }>> {
  const denied = await authorize(ctx, "playlist.update", { channelId: input.channelId });
  if (denied) return fail(denied);
  const rows = await new PlaylistRepository(ctx.prisma).listForChannel(input.channelId);
  return ok({ items: rows.map((row) => toSummary(row, row._count.items)) });
}

/** One playlist with ALL its items, each flagged when a viewer would not see it today (draft, premiere, 18+...). */
export async function getStudioPlaylist(
  ctx: AppContext,
  input: { channelId: string; playlistId: string; channelSlug: string },
): Promise<UseCaseResult<StudioPlaylistDto>> {
  const denied = await authorize(ctx, "playlist.update", { channelId: input.channelId });
  if (denied) return fail(denied);

  const repo = new PlaylistRepository(ctx.prisma);
  const row = await repo.findInChannel(input.playlistId, input.channelId);
  if (!row) return fail(new AppError("Nie znaleziono playlisty.", 404, "NOT_FOUND"));
  const items = await repo.itemsWithVideos(row.id);
  const now = ctx.now();
  return ok({
    ...toSummary(row, items.length),
    visibility: row.visibility as PlaylistVisibilityValue,
    channelSlug: input.channelSlug,
    items: items.map((item) => ({
      videoId: item.videoId,
      slug: item.video.slug,
      title: item.video.title,
      status: item.video.status,
      thumbnailUrl: resolvePublicThumbnailSrc(item.video, process.env),
      position: item.position,
      visibleToPublic: isPlaylistItemVisible(item.video, { channelId: input.channelId, signedIn: false, now }),
    })),
  });
}
