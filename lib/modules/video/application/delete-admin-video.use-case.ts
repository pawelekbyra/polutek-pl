import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { authorize } from "@/lib/modules/authz";
import { AppError } from "@/lib/modules/shared/app-error";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoNotFoundError, VideoNotOnMainChannelError } from "../domain/video.errors";
import { VideoPolicy } from "../domain/video.policy";
import { removePublicThumbnailCopy } from "./sync-public-thumbnail.service";
import { clearReadyVisibility } from "./ready-visibility";
import type { WriteTx } from "@/lib/modules/shared/db";

export type DeleteAdminVideoError = VideoNotFoundError | VideoNotOnMainChannelError;

export type DeleteAdminVideoOptions = {
  /**
   * Runs INSIDE the delete transaction, right before the row is deleted (so the cascade has not removed the
   * video's assets and originals yet). Used to record what the video owns in R2 as a durable clean-up job in the
   * same commit (DB-24): if it throws, the video is not deleted.
   */
  beforeDelete?: (tx: WriteTx) => Promise<void>;
};

export async function deleteAdminVideo(
  videoId: string,
  ctx: AppContext,
  options: DeleteAdminVideoOptions = {}
): Promise<UseCaseResult<AdminVideoDto, DeleteAdminVideoError | AppError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const denied = await authorize(ctx, "video.delete", { channel: { id: mainChannel.id, ownerUserId: mainChannel.userId, status: mainChannel.status } });
  if (denied) return fail(denied);
  const repository = new VideoRepository(ctx.prisma);

  const existing = await repository.findByIdWithAsset(videoId);
  if (!existing) return fail(new VideoNotFoundError(videoId));

  if (!VideoPolicy.isOnMainChannel(existing, mainChannel.id)) {
    return fail(new VideoNotOnMainChannelError(videoId));
  }

  const asset = existing.asset;

  const deleted = await ctx.db.writeTransaction(async (tx) => {
    if (options.beforeDelete) await options.beforeDelete(tx);
    const video = await tx.video.delete({
      where: { id: videoId },
      include: {
        _count: { select: { comments: true } },
        assets: true,
      },
    });

    await recordAuditEvent(ctx, {
      action: "VIDEO_DELETED",
      targetType: "Video",
      targetId: video.id,
      metadata: {
        title: existing.title,
        slug: existing.slug,
        provider: asset?.provider ?? null,
      },
    }, tx);

    return video;
  });

  await removePublicThumbnailCopy(deleted.thumbnailPublicUrl, ctx);
  await clearReadyVisibility(videoId, ctx);

  return ok(toAdminVideoDto(deleted));
}
