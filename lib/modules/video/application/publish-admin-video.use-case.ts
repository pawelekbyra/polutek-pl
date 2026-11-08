import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { VideoRepository } from "../infrastructure/video.repository";
import { ChannelNotFoundError, MainChannelNotApprovedError } from "@/lib/modules/channel/domain/channel.errors";
import { MainChannelPolicy } from "@/lib/modules/channel/domain/channel.policy";
import { MainChannelService } from "@/lib/modules/channel/application/main-channel.service";
import { authorize } from "@/lib/modules/authz";
import { VideoStatus } from "@prisma/client";
import { recordAuditEvent } from "@/lib/modules/audit";
import { toAdminVideoDto } from "../domain/video.dto";
import { VideoNotFoundError, VideoNotReadyForPublicationError } from "../domain/video.errors";
import { VideoPolicy } from "../domain/video.policy";
import { syncPublicThumbnail } from "./sync-public-thumbnail.service";
import { announcePublishedVideo, enqueuePublishedVideoAnnouncement } from "./announce-published-video";
import { clearReadyVisibility } from "./ready-visibility";

export async function publishAdminVideo(
  videoId: string,
  ctx: AppContext
): Promise<UseCaseResult<any, any>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const denied = await authorize(ctx, "video.publish", { channel: { id: mainChannel.id, ownerUserId: mainChannel.userId, status: mainChannel.status } });
  if (denied) return fail(denied);
  const repository = new VideoRepository(ctx.prisma);

  const video = await repository.findByIdForChannel(videoId, mainChannel.id);
  if (!video) {
      return fail(new VideoNotFoundError(videoId));
  }

  const blockers = VideoPolicy.getPublicationBlockers(video);
  if (blockers.length > 0) {
      return fail(new VideoNotReadyForPublicationError(blockers[0].message, blockers[0].code));
  }

  if (video.status === VideoStatus.PUBLISHED) {
    return ok(toAdminVideoDto(video));
  }

  let updated;
  try {
    updated = await (ctx.prisma as any).$transaction(async (tx: any) => {
      // Serialize publication with channel moderation. Recheck visibility after acquiring the
      // row lock so a suspension committed while the request was preparing cannot leak a video.
      const lockedChannel = await tx.$queryRaw`SELECT "id" FROM "Creator" WHERE "id" = ${mainChannel.id} FOR UPDATE`;
      if (!Array.isArray(lockedChannel) || lockedChannel.length === 0) throw new ChannelNotFoundError(mainChannel.id);
      const currentChannel = await tx.creator.findUnique({
        where: { id: mainChannel.id },
        select: { id: true, slug: true, status: true, deletedAt: true },
      });
      if (!currentChannel) throw new ChannelNotFoundError(mainChannel.id);
      if (!MainChannelPolicy.isPubliclyVisible(currentChannel)) throw new MainChannelNotApprovedError(currentChannel.slug);

      const now = new Date();
      const result = await tx.video.update({
        where: { id: videoId },
        data: {
            status: VideoStatus.PUBLISHED,
            // A video made public from "unlisted" is dated from now: it was not public before.
            publishedAt: video.status === VideoStatus.UNLISTED ? now : (video.publishedAt || now),
            publishAfterAssetReady: false,
            publishAfterAssetReadyCompletedAt: now,
            publishAfterAssetReadyError: null,
        }
    });

      await recordAuditEvent(ctx, {
          action: 'VIDEO_PUBLISHED',
          targetType: 'Video',
          targetId: videoId,
          metadata: { title: result.title }
      }, tx);

      await enqueuePublishedVideoAnnouncement(result.id, tx, now);

      return result;
    });
  } catch (error) {
    if (error instanceof ChannelNotFoundError || error instanceof MainChannelNotApprovedError) return fail(error);
    throw error;
  }

  await clearReadyVisibility(videoId, ctx);
  await syncPublicThumbnail(updated, ctx);

  // After the commit, best effort (never fails or undoes the publication; an upcoming premiere is skipped).
  await announcePublishedVideo(updated.id);

  return ok(toAdminVideoDto(updated));
}
