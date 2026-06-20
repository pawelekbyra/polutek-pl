import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { VideoRepository } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { VideoStatus } from "@prisma/client";
import { recordAuditEvent } from "@/lib/modules/audit";
import { toAdminVideoDto } from "../domain/video.dto";
import { VideoNotFoundError, VideoNotReadyForPublicationError } from "../domain/video.errors";
import { VideoPolicy } from "../domain/video.policy";

export async function publishAdminVideo(
  videoId: string,
  ctx: AppContext
): Promise<UseCaseResult<any, any>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);

  const video = await repository.findByIdForMainChannel(videoId, mainChannel.id);
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

  const updated = await (ctx.prisma as any).$transaction(async (tx: any) => {
    const now = new Date();
    const result = await tx.video.update({
        where: { id: videoId },
        data: {
            status: VideoStatus.PUBLISHED,
            publishedAt: video.publishedAt || now,
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

    return result;
  });

  return ok(toAdminVideoDto(updated));
}
