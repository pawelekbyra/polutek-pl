import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { VideoRepository } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { authorize } from "@/lib/modules/authz";
import { VideoStatus } from "@prisma/client";
import { recordAuditEvent } from "@/lib/modules/audit";
import { toAdminVideoDto } from "../domain/video.dto";
import { VideoNotFoundError } from "../domain/video.errors";
import { syncPublicThumbnail } from "./sync-public-thumbnail.service";

/**
 * Returns a video to a private draft. For PUBLISHED this is "unpublish", for ARCHIVED "restore as draft".
 * Clears `isMainFeatured` / `showInSidebar` (a draft must not hold a public slot) and any pending auto-publish,
 * and removes the public thumbnail copy. Idempotent: a video that already is a draft is returned unchanged.
 */
export async function unpublishAdminVideo(
  videoId: string,
  ctx: AppContext
): Promise<UseCaseResult<any, any>> {
  const channel = await MainChannelService.getRequired(ctx);
  const denied = await authorize(ctx, "video.publish", { channel: { id: channel.id, ownerUserId: channel.userId, status: channel.status } });
  if (denied) return fail(denied);
  const repository = new VideoRepository(ctx.prisma);

  const video = await repository.findByIdForMainChannel(videoId, channel.id);
  if (!video) return fail(new VideoNotFoundError(videoId));

  if (video.status === VideoStatus.DRAFT) {
    return ok(toAdminVideoDto(video));
  }

  const updated = await (ctx.prisma as any).$transaction(async (tx: any) => {
    const result = await tx.video.update({
      where: { id: videoId },
      data: {
        status: VideoStatus.DRAFT,
        isMainFeatured: false,
        showInSidebar: false,
        publishAfterAssetReady: false,
      },
    });

    await recordAuditEvent(ctx, {
      action: 'VIDEO_UNPUBLISHED',
      targetType: 'Video',
      targetId: videoId,
      metadata: {
        title: result.title,
        before: { status: video.status, isMainFeatured: video.isMainFeatured, showInSidebar: video.showInSidebar },
        after: { status: VideoStatus.DRAFT, isMainFeatured: false, showInSidebar: false },
      },
    }, tx);

    return result;
  });

  await syncPublicThumbnail(updated, ctx);

  return ok(toAdminVideoDto(updated));
}
