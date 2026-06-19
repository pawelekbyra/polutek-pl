import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoNotFoundError, VideoNotOnMainChannelError } from "../domain/video.errors";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository } from "../infrastructure/video.repository";
import type { VideoAssetProcessingState } from "@prisma/client";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";

export interface AttachCloudflareAssetInput {
  videoId: string;
  providerAssetId: string;
  providerPlaybackId?: string;
  processingState?: VideoAssetProcessingState;
}

type AttachCloudflareAssetFailure = VideoNotFoundError | VideoNotOnMainChannelError | AppError;

export async function attachCloudflareAsset(input: AttachCloudflareAssetInput, ctx: AppContext): Promise<UseCaseResult<AdminVideoDto, AttachCloudflareAssetFailure>> {
  const providerAssetId = input.providerAssetId?.trim();
  if (!providerAssetId) return fail(new AppError("Cloudflare provider asset ID is required.", 400, "INVALID_PROVIDER_ASSET_ID"));
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdForMainChannel(input.videoId, mainChannel.id);
  if (!video) return fail(new VideoNotFoundError(input.videoId));
  const updatedVideo = await (ctx.prisma as any).$transaction(async (tx: any) => {
    if (video.asset?.provider === VIDEO_PROVIDER.CLOUDFLARE_STREAM && video.asset.isPrimary && video.asset.processingState === VIDEO_ASSET_PROCESSING_STATE.READY) {
      throw new AppError("Video already has a ready primary asset. Replacement is not allowed.", 400, "VIDEO_HAS_READY_ASSET");
    }
    await repository.upsertAsset(video.id, {
      provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
      providerAssetId,
      providerPlaybackId: input.providerPlaybackId?.trim() || providerAssetId,
      processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
      isPrimary: false,
      providerSyncedAt: new Date(),
      processingStartedAt: new Date(),
      processingEndedAt: null,
      failureReason: null,
    }, tx);
    await recordAuditEvent(ctx, {
      action: "VIDEO_ASSET_ATTACHED",
      targetType: "Video",
      targetId: video.id,
      metadata: {
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        providerAssetId,
        processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
        isPrimary: false,
      },
    }, tx);
    return repository.findByIdForMainChannel(video.id, mainChannel.id);
  }).catch((error: unknown) => {
    if (error instanceof AppError) return error;
    throw error;
  });
  if (updatedVideo instanceof AppError) return fail(updatedVideo);
  if (!updatedVideo) return fail(new VideoNotFoundError(input.videoId));
  return ok(toAdminVideoDto(updatedVideo));
}
