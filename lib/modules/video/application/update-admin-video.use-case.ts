import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository, UpdateVideoInput } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { MediaPolicy } from "@/lib/modules/media";
import { VideoPolicy } from "../domain/video.policy";
import {
    VideoNotFoundError,
    VideoNotOnMainChannelError,
    VideoUrlNotAllowedError,
    VideoInvalidHeroError
} from "../domain/video.errors";

export async function updateAdminVideo(
  input: UpdateVideoInput,
  ctx: AppContext
): Promise<UseCaseResult<AdminVideoDto, VideoNotFoundError | VideoNotOnMainChannelError | VideoUrlNotAllowedError | VideoInvalidHeroError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);

  const existing = await repository.findById(input.id);
  if (!existing) return fail(new VideoNotFoundError(input.id));

  if (!VideoPolicy.isOnMainChannel(existing, mainChannel.id)) {
    return fail(new VideoNotOnMainChannelError(input.id));
  }

  if (input.videoUrl && !MediaPolicy.isAllowedVideoSourceUrl(input.videoUrl, process.env as any)) {
    return fail(new VideoUrlNotAllowedError(input.videoUrl));
  }

  if (input.isMainFeatured) {
      if (!VideoPolicy.canBeHero({
          tier: input.tier || existing.tier,
          status: input.status || existing.status
      })) {
          return fail(new VideoInvalidHeroError());
      }
  }

  const updated = await (ctx.prisma as any).$transaction(async (tx: any) => {
    const video = await repository.updateForMainChannel(input, mainChannel.id, tx);

    if (input.isMainFeatured) {
        await repository.clearHero(mainChannel.id, video.id, tx);
    }

    await recordAuditEvent(ctx, {
      action: 'VIDEO_UPDATED',
      targetType: 'Video',
      targetId: video.id,
      metadata: { changed: Object.keys(input).filter(k => k !== 'id') }
    }, tx);

    return video;
  });

  return ok(toAdminVideoDto(updated));
}
