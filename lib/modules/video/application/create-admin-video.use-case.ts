import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository, CreateVideoInput } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { MediaPolicy } from "@/lib/modules/media";
import { VideoUrlNotAllowedError } from "../domain/video.errors";

export async function createAdminVideo(
  input: CreateVideoInput,
  ctx: AppContext
): Promise<UseCaseResult<AdminVideoDto, VideoUrlNotAllowedError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);

  if (!MediaPolicy.isAllowedVideoSourceUrl(input.videoUrl, process.env as any)) {
    return fail(new VideoUrlNotAllowedError(input.videoUrl));
  }

  const repository = new VideoRepository(ctx.prisma);

  const video = await (ctx.prisma as any).$transaction(async (tx: any) => {
    const created = await repository.createForMainChannel(input, mainChannel.id, tx);

    await recordAuditEvent(ctx, {
      action: 'VIDEO_CREATED',
      targetType: 'Video',
      targetId: created.id,
      metadata: { title: created.title }
    }, tx);

    return created;
  });

  return ok(toAdminVideoDto(video));
}
