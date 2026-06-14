import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { VideoRepository } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoNotFoundError, VideoNotOnMainChannelError } from "../domain/video.errors";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import type { VideoAssetProcessingState } from "@prisma/client";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";

export interface AttachCloudflareAssetInput {
  videoId: string;
  providerAssetId: string;
  providerPlaybackId?: string;
  processingState?: VideoAssetProcessingState;
}

export async function attachCloudflareAsset(
  input: AttachCloudflareAssetInput,
  ctx: AppContext
): Promise<UseCaseResult<AdminVideoDto, VideoNotFoundError | VideoNotOnMainChannelError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);

  const video = await repository.findByIdForMainChannel(input.videoId, mainChannel.id);
  if (!video) return fail(new VideoNotFoundError(input.videoId));

  const updatedVideo = await (ctx.prisma as
any).$transaction(async (tx:
any) => {
    await repository.upsertAsset(video.id, {
      provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
      providerAssetId: input.providerAssetId,
      providerPlaybackId: input.providerPlaybackId || input.providerAssetId, // For Cloudflare, assetId is often the playbackId
      processingState: input.processingState || VIDEO_ASSET_PROCESSING_STATE.READY,
      isPrimary: true,
      providerSyncedAt: new Date()
    }, tx);

    await recordAuditEvent(ctx, {
      action: 'VIDEO_ASSET_ATTACHED',
      targetType: 'Video',
      targetId: video.id,
      metadata: {
          provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
          providerAssetId: input.providerAssetId
      }
    }, tx);

    const reloaded = await repository.findByIdForMainChannel(video.id, mainChannel.id);
    return reloaded;
  });

  if (!updatedVideo) return fail(new VideoNotFoundError(input.videoId));

  return ok(toAdminVideoDto(updatedVideo));
}
