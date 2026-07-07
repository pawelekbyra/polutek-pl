import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { VideoRepository } from "../infrastructure/video.repository";
import { recordAuditEvent } from "@/lib/modules/audit";
import type { VideoAssetProcessingState } from "@prisma/client";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER, mapCloudflareStateToProcessingState } from "../domain/video-asset.constants";
import { createScopedLogger } from "@/lib/logger";
import { attemptPublishAfterAssetReady } from "./publish-after-asset-ready.use-case";
import { VideoPlaybackRouteService } from "./video-playback-route.service";

export interface CloudflareStreamWebhookPayload {
  uid: string;
  status: {
    state: "pendingupload" | "downloading" | "queued" | "processing" | "ready" | "error";
    pctComplete?: string;
    errorReasonCode?: string;
    errorReasonText?: string;
  };
  duration?: number;
  size?: number;
  // Other fields like playback, meta, etc. might be present but we focus on status
  playback?: {
    hls?: string;
    dash?: string;
  };
}

export async function handleCloudflareStreamWebhook(
  payload: CloudflareStreamWebhookPayload,
  ctx: AppContext
): Promise<UseCaseResult<{ assetId: string; status: string }, Error>> {
  const logger = createScopedLogger("handleCloudflareStreamWebhook");
  const repository = new VideoRepository(ctx.prisma);

  const asset = await repository.findAssetByProviderId(VIDEO_PROVIDER.CLOUDFLARE_STREAM, payload.uid);

  if (!asset) {
    logger.warn("Received Cloudflare Stream webhook for unknown asset", { uid: payload.uid });
    return ok({ assetId: "unknown", status: "ignored" });
  }

  const newState = mapCloudflareStateToProcessingState(payload.status.state);

  // Idempotency and State Transition Rules
  // Allow processing if the state is changing, or if the new state is READY (to allow refreshing metadata)
  // We only treat it as a metadata refresh if there's actual metadata to refresh (size or duration)
  const isMetadataRefresh = asset.processingState === VIDEO_ASSET_PROCESSING_STATE.READY &&
                            newState === VIDEO_ASSET_PROCESSING_STATE.READY &&
                            (payload.size != null || payload.duration != null);

  if (isRedundantTransition(asset.processingState, newState) && !isMetadataRefresh) {
    return ok({ assetId: asset.id, status: "no-change" });
  }

  const updatedAsset = await (ctx.prisma as any).$transaction(async (tx: any) => {
    const dataToUpdate: any = {
      processingState: newState,
      providerSyncedAt: new Date(),
    };

    if (newState === VIDEO_ASSET_PROCESSING_STATE.PROCESSING && !asset.processingStartedAt) {
      dataToUpdate.processingStartedAt = new Date();
    }

    if (newState === VIDEO_ASSET_PROCESSING_STATE.READY || newState === VIDEO_ASSET_PROCESSING_STATE.FAILED) {
      dataToUpdate.processingEndedAt = new Date();
    }

    if (newState === VIDEO_ASSET_PROCESSING_STATE.FAILED) {
      dataToUpdate.failureReason = payload.status.errorReasonText || payload.status.errorReasonCode || "Unknown Cloudflare error";
      dataToUpdate.isPrimary = false;
    }

    if (newState === VIDEO_ASSET_PROCESSING_STATE.READY) {
        dataToUpdate.failureReason = null;

        if (payload.size != null) {
          dataToUpdate.sizeBytes = Math.floor(payload.size);
        }
        // Only set providerPlaybackId if explicitly provided or if it's currently missing
        if (payload.playback?.hls || payload.playback?.dash) {
          if (!asset.providerPlaybackId) {
            dataToUpdate.providerPlaybackId = payload.uid;
          }
        }
    }

    // NOTE: isPrimary promotion is intentionally NOT written here. It happens after this
    // transaction commits, via VideoPlaybackRouteService.activateRoute() (see below) — the
    // single write path for isPrimary/activePlaybackRouteId. Publication remains
    // readiness-driven and provider-agnostic: the first provider to deliver a READY asset
    // serves playback, and a broken/lost webhook on a preferred provider must never block a
    // working asset from serving.
    const updated = await repository.updateAsset(asset.id, dataToUpdate, tx);

    await recordAuditEvent(ctx, {
      action: 'VIDEO_ASSET_STATUS_UPDATED',
      targetType: 'Video',
      targetId: asset.videoId,
      metadata: {
        assetId: asset.id,
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        providerAssetId: payload.uid,
        oldState: asset.processingState,
        newState: newState,
        cloudflareState: payload.status.state
      }
    }, tx);

    return updated;
  });

  if (updatedAsset.processingState === VIDEO_ASSET_PROCESSING_STATE.READY) {
    let becamePrimary = false;
    try {
      const route = await new VideoPlaybackRouteService().activateFirstReadyAssetIfNoneActive(
        { videoId: updatedAsset.videoId, assetId: updatedAsset.id, reason: "cloudflare-sync-ready" },
        ctx,
      );
      becamePrimary = Boolean(route);
    } catch (error) {
      logger.warn("Failed to activate playback route after Cloudflare asset became ready", {
        assetId: updatedAsset.id,
        videoId: updatedAsset.videoId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // updatedAsset.isPrimary reflects whatever was already true on the row before this call
    // (e.g. a metadata-only refresh on an asset that was already primary); becamePrimary
    // covers the case where this call just promoted it.
    const isPrimaryNow = becamePrimary || Boolean((updatedAsset as { isPrimary?: boolean }).isPrimary);

    if (payload.duration != null && isPrimaryNow) {
      const minutes = Math.floor(payload.duration / 60);
      const seconds = Math.floor(payload.duration % 60);
      await ctx.prisma.video.update({
        where: { id: updatedAsset.videoId },
        data: { duration: `${minutes}:${seconds.toString().padStart(2, '0')}` },
      });
    }

    await attemptPublishAfterAssetReady(updatedAsset.videoId, ctx, VIDEO_PROVIDER.CLOUDFLARE_STREAM);
  }

  return ok({ assetId: updatedAsset.id, status: updatedAsset.processingState });
}

function isRedundantTransition(currentState: VideoAssetProcessingState, newState: VideoAssetProcessingState): boolean {
  // If already READY, don't move back to any other state
  if (currentState === VIDEO_ASSET_PROCESSING_STATE.READY && newState !== VIDEO_ASSET_PROCESSING_STATE.READY) return true;

  // If the state is the same, it's generally redundant unless it's a READY state (which we handle above with isMetadataRefresh)
  if (currentState === newState) return true;

  return false;
}
