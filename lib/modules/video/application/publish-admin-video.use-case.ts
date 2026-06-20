import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { VideoRepository } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { VideoStatus } from "@prisma/client";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";
import { recordAuditEvent } from "@/lib/modules/audit";
import { toAdminVideoDto } from "../domain/video.dto";
import { VideoNotFoundError, VideoNotReadyForPublicationError } from "../domain/video.errors";

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

  // Publication requirements
  if (!video.title || video.title.trim() === '') {
      return fail(new VideoNotReadyForPublicationError('Podaj tytuł przed publikacją filmu.'));
  }
  if (!video.slug || video.slug.trim() === '') {
      return fail(new VideoNotReadyForPublicationError('Podaj slug przed publikacją filmu.'));
  }
  if (!video.tier) {
      return fail(new VideoNotReadyForPublicationError('Wybierz tier dostępu przed publikacją filmu.'));
  }

  // Asset requirements
  if (!video.asset || !video.asset.isPrimary) {
      return fail(new VideoNotReadyForPublicationError('Publikacja wymaga primary assetu Cloudflare Stream w stanie READY.'));
  }
  if (video.asset.provider !== VIDEO_PROVIDER.CLOUDFLARE_STREAM) {
      return fail(new VideoNotReadyForPublicationError('Primary asset musi pochodzić z Cloudflare Stream.'));
  }
  if (video.asset.processingState !== VIDEO_ASSET_PROCESSING_STATE.READY) {
      return fail(new VideoNotReadyForPublicationError('Asset Cloudflare Stream nie jest jeszcze READY.'));
  }
  if (!video.asset.providerAssetId) {
      return fail(new VideoNotReadyForPublicationError('Brakuje identyfikatora assetu Cloudflare Stream.'));
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
            publishedAt: now,
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
