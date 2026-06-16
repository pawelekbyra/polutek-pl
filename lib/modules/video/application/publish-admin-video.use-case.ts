import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { VideoRepository } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { VideoStatus } from "@prisma/client";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";
import { recordAuditEvent } from "@/lib/modules/audit";
import { toAdminVideoDto } from "../domain/video.dto";

export async function publishAdminVideo(
  videoId: string,
  ctx: AppContext
): Promise<UseCaseResult<any, any>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);

  const video = await repository.findByIdForMainChannel(videoId, mainChannel.id);
  if (!video) {
      return fail({ code: 'VIDEO_NOT_FOUND', message: 'Video not found', statusCode: 404 });
  }

  // Publication requirements
  if (!video.title || video.title.trim() === '') {
      return fail({ code: 'VIDEO_NOT_READY_FOR_PUBLICATION', message: 'Missing title', statusCode: 400 });
  }
  if (!video.slug || video.slug.trim() === '') {
      return fail({ code: 'VIDEO_NOT_READY_FOR_PUBLICATION', message: 'Missing slug', statusCode: 400 });
  }
  if (!video.tier) {
      return fail({ code: 'VIDEO_NOT_READY_FOR_PUBLICATION', message: 'Missing tier', statusCode: 400 });
  }

  // Asset requirements
  if (!video.asset || !video.asset.isPrimary) {
      return fail({ code: 'VIDEO_NOT_READY_FOR_PUBLICATION', message: 'No primary asset found', statusCode: 400 });
  }
  if (video.asset.provider !== VIDEO_PROVIDER.CLOUDFLARE_STREAM) {
      return fail({ code: 'VIDEO_NOT_READY_FOR_PUBLICATION', message: 'Primary asset must be Cloudflare Stream', statusCode: 400 });
  }
  if (video.asset.processingState !== VIDEO_ASSET_PROCESSING_STATE.READY) {
      return fail({ code: 'VIDEO_NOT_READY_FOR_PUBLICATION', message: 'Primary asset is not READY', statusCode: 400 });
  }
  if (!video.asset.providerAssetId) {
      return fail({ code: 'VIDEO_NOT_READY_FOR_PUBLICATION', message: 'Missing provider UID', statusCode: 400 });
  }

  const updated = await (ctx.prisma as any).$transaction(async (tx: any) => {
    const result = await tx.video.update({
        where: { id: videoId },
        data: {
            status: VideoStatus.PUBLISHED,
            publishedAt: new Date()
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
