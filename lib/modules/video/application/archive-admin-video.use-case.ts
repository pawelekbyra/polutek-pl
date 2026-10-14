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
import { syncPublicThumbnail } from "./sync-public-thumbnail.service";

export async function archiveAdminVideo(
  videoId: string,
  ctx: AppContext
): Promise<UseCaseResult<AdminVideoDto, VideoNotFoundError | VideoNotOnMainChannelError | AppError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const denied = await authorize(ctx, "video.update", { channel: { id: mainChannel.id, ownerUserId: mainChannel.userId, status: mainChannel.status } });
  if (denied) return fail(denied);
  const repository = new VideoRepository(ctx.prisma);

  const existing = await repository.findById(videoId);
  if (!existing) return fail(new VideoNotFoundError(videoId));

  if (!VideoPolicy.isOnMainChannel(existing, mainChannel.id)) {
    return fail(new VideoNotOnMainChannelError(videoId));
  }

  const archived = await (ctx.prisma as any).$transaction(async (tx: any) => {
    const video = await repository.archiveVideo(videoId, mainChannel.id, tx);

    await recordAuditEvent(ctx, {
      action: 'VIDEO_ARCHIVED',
      targetType: 'Video',
      targetId: video.id
    }, tx);

    return video;
  });

  await syncPublicThumbnail(archived, ctx);

  return ok(toAdminVideoDto(archived));
}
