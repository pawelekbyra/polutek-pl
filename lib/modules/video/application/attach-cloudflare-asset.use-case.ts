import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { WriteTx } from "@/lib/modules/shared/db";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoNotFoundError, VideoNotOnMainChannelError } from "../domain/video.errors";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository } from "../infrastructure/video.repository";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";
import { buildCloudflareFirstFrameThumbnailUrl, normalizeThumbnailSourceMode } from "@/lib/media/cloudflare-thumbnail";

export interface AttachCloudflareAssetInput {
  videoId: string;
  providerAssetId: string;
  providerPlaybackId?: string;
  processingState?: unknown;
  publishAfterAssetReady?: boolean;
  thumbnailSource?: unknown;
}

type AttachCloudflareAssetFailure = VideoNotFoundError | VideoNotOnMainChannelError | AppError;

type VideoUpdatePatch = {
  publishAfterAssetReady?: boolean;
  publishAfterAssetReadyRequestedAt?: Date;
  thumbnailUrl?: string;
};

export async function attachCloudflareAsset(input: AttachCloudflareAssetInput, ctx: AppContext): Promise<UseCaseResult<AdminVideoDto, AttachCloudflareAssetFailure>> {
  const providerAssetId = input.providerAssetId?.trim();
  if (!providerAssetId) return fail(new AppError("Cloudflare provider asset ID is required.", 400, "INVALID_PROVIDER_ASSET_ID"));
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdForMainChannel(input.videoId, mainChannel.id);
  if (!video) return fail(new VideoNotFoundError(input.videoId));

  const thumbnailSource = normalizeThumbnailSourceMode(input.thumbnailSource);
  const firstFrameThumbnailUrl = thumbnailSource === "CLOUDFLARE_FIRST_FRAME"
    ? buildCloudflareFirstFrameThumbnailUrl(providerAssetId)
    : null;

  // Idempotency check: if already attached to this video, return success
  if (video.asset?.provider === VIDEO_PROVIDER.CLOUDFLARE_STREAM && video.asset.providerAssetId === providerAssetId) {
    const videoUpdate: VideoUpdatePatch = {};
    if (input.publishAfterAssetReady && !video.publishAfterAssetReady) {
      videoUpdate.publishAfterAssetReady = true;
      videoUpdate.publishAfterAssetReadyRequestedAt = new Date();
    }
    if (firstFrameThumbnailUrl && video.thumbnailUrl !== firstFrameThumbnailUrl) {
      videoUpdate.thumbnailUrl = firstFrameThumbnailUrl;
    }

    if (Object.keys(videoUpdate).length > 0) {
      await ctx.prisma.video.update({
        where: { id: video.id },
        data: videoUpdate,
      });
      if (input.publishAfterAssetReady && !video.publishAfterAssetReady) {
        await recordAuditEvent(ctx, {
          action: "VIDEO_PUBLISH_AFTER_ASSET_READY_REQUESTED",
          targetType: "Video",
          targetId: video.id,
          metadata: { source: "attach-cloudflare-asset-idempotent" },
        });
      }

      const reloaded = await repository.findByIdForMainChannel(video.id, mainChannel.id);
      return ok(toAdminVideoDto(reloaded!));
    }
    return ok(toAdminVideoDto(video));
  }

  const writeTransaction = ctx.db?.writeTransaction ?? (<T>(fn: (tx: WriteTx) => Promise<T>) => fn(ctx.prisma as WriteTx));
  const updatedVideo = await writeTransaction(async (tx: WriteTx) => {
    if (video.asset?.provider === VIDEO_PROVIDER.CLOUDFLARE_STREAM && video.asset.isPrimary && video.asset.processingState === VIDEO_ASSET_PROCESSING_STATE.READY) {
      throw new AppError("Video already has a ready primary asset. Replacement is not allowed.", 400, "VIDEO_HAS_READY_ASSET");
    }

    // Ensure UID is not already in use by another video
    const existingAssetWithUid = await repository.findAssetByProviderId(VIDEO_PROVIDER.CLOUDFLARE_STREAM, providerAssetId);
    if (existingAssetWithUid && existingAssetWithUid.videoId !== video.id) {
      throw new AppError(`Cloudflare Stream asset with UID ${providerAssetId} is already used by another video.`, 409, "CLOUDFLARE_ASSET_IN_USE");
    }

    const pendingPublishRequested = input.publishAfterAssetReady || video.publishAfterAssetReady;
    if (pendingPublishRequested || firstFrameThumbnailUrl) {
      await tx.video.update({
        where: { id: video.id },
        data: {
          ...(pendingPublishRequested ? {
            publishAfterAssetReady: true,
            publishAfterAssetReadyRequestedAt: video.publishAfterAssetReadyRequestedAt || new Date(),
            publishAfterAssetReadyCompletedAt: null,
            publishAfterAssetReadyError: null,
          } : {}),
          ...(firstFrameThumbnailUrl ? { thumbnailUrl: firstFrameThumbnailUrl } : {}),
        },
      });
      if (pendingPublishRequested && !video.publishAfterAssetReady) {
        await recordAuditEvent(ctx, {
          action: "VIDEO_PUBLISH_AFTER_ASSET_READY_REQUESTED",
          targetType: "Video",
          targetId: video.id,
          metadata: { source: "attach-cloudflare-asset" },
        }, tx);
      }
    }
    await repository.updateVideoAsset(video.id, {
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
        thumbnailSource,
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
