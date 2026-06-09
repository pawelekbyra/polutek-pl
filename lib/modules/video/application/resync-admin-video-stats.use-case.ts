import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { MainChannelService } from "@/lib/modules/channel";
import { VideoNotOnMainChannelError, VideoNotFoundError } from "../domain/video.errors";
import { recordAuditEvent } from "@/lib/modules/audit";

export type ResyncAdminVideoStatsInput = {
  videoId: string;
};

export type ResyncAdminVideoStatsOutput = {
  videoId: string;
  likesCount: number;
  dislikesCount: number;
  views: number;
};

export async function resyncAdminVideoStats(
  input: ResyncAdminVideoStatsInput,
  ctx: AppContext
): Promise<UseCaseResult<ResyncAdminVideoStatsOutput, VideoNotFoundError | VideoNotOnMainChannelError>> {
  const { videoId } = input;
  const mainChannel = await MainChannelService.getRequired(ctx);

  const video = await ctx.prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, creatorId: true }
  });

  if (!video) return fail(new VideoNotFoundError(videoId));
  if (video.creatorId !== mainChannel.id) return fail(new VideoNotOnMainChannelError(videoId));

  const [likes, dislikes, views] = await Promise.all([
    ctx.prisma.videoLike.count({ where: { videoId } }),
    ctx.prisma.videoDislike.count({ where: { videoId } }),
    ctx.prisma.videoView.count({ where: { videoId } })
  ]);

  const resultDto = {
    videoId,
    likesCount: likes,
    dislikesCount: dislikes,
    views: views
  };

  const { prisma } = ctx;

  if ('$transaction' in prisma) {
    return await prisma.$transaction(async (tx) => {
      const result = await tx.video.updateMany({
        where: { id: videoId, creatorId: mainChannel.id },
        data: {
          likesCount: likes,
          dislikesCount: dislikes,
          views: views
        }
      });

      if (result.count !== 1) {
        throw new VideoNotOnMainChannelError(videoId);
      }

      await recordAuditEvent(ctx, {
        action: 'VIDEO_STATS_RESYNCED',
        targetType: 'Video',
        targetId: videoId,
        metadata: { likes, dislikes, views }
      }, tx);

      return ok(resultDto);
    });
  } else {
    // If we're already in a transaction (though resync probably shouldn't be)
    const result = await prisma.video.updateMany({
        where: { id: videoId, creatorId: mainChannel.id },
        data: {
          likesCount: likes,
          dislikesCount: dislikes,
          views: views
        }
      });

      if (result.count !== 1) {
        throw new VideoNotOnMainChannelError(videoId);
      }

      await recordAuditEvent(ctx, {
        action: 'VIDEO_STATS_RESYNCED',
        targetType: 'Video',
        targetId: videoId,
        metadata: { likes, dislikes, views }
      });

      return ok(resultDto);
  }
}
