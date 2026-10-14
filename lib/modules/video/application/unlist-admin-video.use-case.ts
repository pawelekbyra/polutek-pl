import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { VideoRepository } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { authorize } from "@/lib/modules/authz";
import { VideoStatus } from "@prisma/client";
import { recordAuditEvent } from "@/lib/modules/audit";
import { toAdminVideoDto } from "../domain/video.dto";
import { VideoNotFoundError, VideoNotReadyForPublicationError } from "../domain/video.errors";
import { VideoPolicy } from "../domain/video.policy";
import { isAllowedStatusTransition } from "../domain/video-visibility";
import { syncPublicThumbnail } from "./sync-public-thumbnail.service";
import { clearReadyVisibility } from "./ready-visibility";

/**
 * "Niepubliczny": the video becomes reachable by link (same tier rules as a published one) and disappears from
 * every list, search, sitemap and recommendation. Works from DRAFT (needs the publication blockers to be clear:
 * a READY own-HLS route, title, slug, tier) and from PUBLISHED (a downgrade of visibility, no blockers needed
 * beyond not being archived). Clears hero and sidebar slots (an unlisted video holds no public slot), drops a
 * scheduled premiere (premieres exist only for public videos), removes the public thumbnail copy, and completes
 * a pending "publish when ready". Idempotent. Same permission as publishing (`video.publish`).
 */
export async function unlistAdminVideo(
  videoId: string,
  ctx: AppContext
): Promise<UseCaseResult<any, any>> {
  const channel = await MainChannelService.getRequired(ctx);
  const denied = await authorize(ctx, "video.publish", { channel: { id: channel.id, ownerUserId: channel.userId, status: channel.status } });
  if (denied) return fail(denied);
  const repository = new VideoRepository(ctx.prisma);

  const video = await repository.findByIdForMainChannel(videoId, channel.id);
  if (!video) return fail(new VideoNotFoundError(videoId));

  if (video.status === VideoStatus.UNLISTED) return ok(toAdminVideoDto(video));

  if (!isAllowedStatusTransition(video.status, VideoStatus.UNLISTED)) {
    return fail(new VideoNotReadyForPublicationError("Zarchiwizowany film trzeba najpierw przywrócić do szkicu.", "VIDEO_PUBLICATION_ARCHIVED"));
  }
  // A published video already passed the blockers once; only a draft has to clear them now.
  if (video.status !== VideoStatus.PUBLISHED) {
    const blockers = VideoPolicy.getUnlistBlockers(video);
    if (blockers.length > 0) return fail(new VideoNotReadyForPublicationError(blockers[0].message, blockers[0].code));
  }

  const now = ctx.now();
  const updated = await (ctx.prisma as any).$transaction(async (tx: any) => {
    const result = await tx.video.update({
      where: { id: videoId },
      data: {
        status: VideoStatus.UNLISTED,
        publishedAt: video.publishedAt || now,
        premiereAt: null,
        isMainFeatured: false,
        showInSidebar: false,
        publishAfterAssetReady: false,
        publishAfterAssetReadyCompletedAt: video.publishAfterAssetReady ? now : video.publishAfterAssetReadyCompletedAt,
        publishAfterAssetReadyError: null,
      },
    });

    await recordAuditEvent(ctx, {
      action: "VIDEO_UNLISTED",
      targetType: "Video",
      targetId: videoId,
      metadata: {
        title: result.title,
        before: { status: video.status, isMainFeatured: video.isMainFeatured, showInSidebar: video.showInSidebar },
        after: { status: VideoStatus.UNLISTED, isMainFeatured: false, showInSidebar: false },
      },
    }, tx);

    return result;
  });

  await clearReadyVisibility(videoId, ctx);
  await syncPublicThumbnail(updated, ctx);

  return ok(toAdminVideoDto(updated));
}
