import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AppError } from "@/lib/modules/shared/app-error";
import { MainChannelService } from "@/lib/modules/channel";
import { authorize } from "@/lib/modules/authz";
import { recordAuditEvent } from "@/lib/modules/audit";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository } from "../infrastructure/video.repository";
import { VideoNotFoundError } from "../domain/video.errors";
import { VideoPolicy } from "../domain/video.policy";

/**
 * "Anuluj automatyczną publikację": clears the publish-when-processing-finishes flag of a video that has not been
 * published yet, so it stays a draft until the creator publishes it by hand. The video, its upload and any premiere
 * date are untouched. Idempotent: a video without the flag (or already published) is returned as it is, no audit row.
 * Same permission as publishing (`video.publish`): cancelling a publication is part of deciding about it.
 */
export async function cancelAutoPublish(
  videoId: string,
  ctx: AppContext,
): Promise<UseCaseResult<AdminVideoDto, VideoNotFoundError | AppError>> {
  const channel = await MainChannelService.getRequired(ctx);
  const denied = await authorize(ctx, "video.publish", { channel: { id: channel.id, ownerUserId: channel.userId, status: channel.status } });
  if (denied) return fail(denied);

  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdForMainChannel(videoId, channel.id);
  if (!video || !VideoPolicy.isOnMainChannel(video, channel.id)) return fail(new VideoNotFoundError(videoId));

  if (!video.publishAfterAssetReady || video.status === "PUBLISHED") return ok(toAdminVideoDto(video));

  await ctx.db.writeTransaction(async (tx) => {
    // Conditional on the flag still being set: a publication that won the race keeps its completed state.
    const { count } = await tx.video.updateMany({
      where: { id: videoId, creatorId: channel.id, publishAfterAssetReady: true, status: { not: "PUBLISHED" } },
      data: { publishAfterAssetReady: false, publishAfterAssetReadyRequestedAt: null, publishAfterAssetReadyError: null },
    });
    if (count === 1) {
      await recordAuditEvent(
        ctx,
        { action: "VIDEO_PUBLISH_AFTER_ASSET_READY_CANCELLED", targetType: "Video", targetId: videoId, channelId: channel.id },
        tx,
      );
    }
  });

  const fresh = await repository.findByIdForMainChannel(videoId, channel.id);
  if (!fresh) return fail(new VideoNotFoundError(videoId));
  return ok(toAdminVideoDto(fresh));
}
