import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { VideoRepository } from "../infrastructure/video.repository";
import { recordAuditEvent } from "@/lib/modules/audit";
import { StorageProvider, VideoAssetProcessingState } from "@prisma/client";
import { createScopedLogger } from "@/lib/logger";

export interface CloudflareStreamWebhookPayload {
  uid: string;
  status: {
    state: "pendingupload" | "downloading" | "queued" | "processing" | "ready" | "error";
    pctComplete?: string;
    errorReasonCode?: string;
    errorReasonText?: string;
  };
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

  const asset = await repository.findAssetByProviderId(StorageProvider.CLOUDFLARE_STREAM, payload.uid);

  if (!asset) {
    logger.warn("Received Cloudflare Stream webhook for unknown asset", { uid: payload.uid });
    return ok({ assetId: "unknown", status: "ignored" });
  }

  const newState = mapCloudflareStateToProcessingState(payload.status.state);

  // Idempotency and State Transition Rules
  if (isRedundantTransition(asset.processingState, newState)) {
    return ok({ assetId: asset.id, status: "no-change" });
  }

  const updatedAsset = await (ctx.prisma as any).$transaction(async (tx: any) => {
    const dataToUpdate: any = {
      processingState: newState,
      providerSyncedAt: new Date(),
    };

    if (newState === VideoAssetProcessingState.PROCESSING && !asset.processingStartedAt) {
      dataToUpdate.processingStartedAt = new Date();
    }

    if (newState === VideoAssetProcessingState.READY || newState === VideoAssetProcessingState.FAILED) {
      dataToUpdate.processingEndedAt = new Date();
    }

    if (newState === VideoAssetProcessingState.FAILED) {
      dataToUpdate.failureReason = payload.status.errorReasonText || payload.status.errorReasonCode || "Unknown Cloudflare error";
    }

    const updated = await repository.updateAsset(asset.id, dataToUpdate, tx);

    await recordAuditEvent(ctx, {
      action: 'VIDEO_ASSET_STATUS_UPDATED',
      targetType: 'Video',
      targetId: asset.videoId,
      metadata: {
        assetId: asset.id,
        provider: StorageProvider.CLOUDFLARE_STREAM,
        providerAssetId: payload.uid,
        oldState: asset.processingState,
        newState: newState,
        cloudflareState: payload.status.state
      }
    }, tx);

    return updated;
  });

  return ok({ assetId: updatedAsset.id, status: updatedAsset.processingState });
}

function mapCloudflareStateToProcessingState(cfState: string): VideoAssetProcessingState {
  switch (cfState) {
    case "pendingupload":
    case "downloading":
      return VideoAssetProcessingState.UPLOADING;
    case "queued":
    case "processing":
      return VideoAssetProcessingState.PROCESSING;
    case "ready":
      return VideoAssetProcessingState.READY;
    case "error":
      return VideoAssetProcessingState.FAILED;
    default:
      return VideoAssetProcessingState.PROCESSING;
  }
}

function isRedundantTransition(currentState: VideoAssetProcessingState, newState: VideoAssetProcessingState): boolean {
  // If already READY, don't move back to any other state
  if (currentState === VideoAssetProcessingState.READY) return true;

  // If already FAILED, don't move back to processing/uploading (but maybe READY if it was a transient error?
  // Usually provider webhooks are final for a state, but let's be strict: only READY can overwrite FAILED if we want,
  // but let's stick to: once it is READY, it stays READY.)
  if (currentState === newState) return true;

  return false;
}
