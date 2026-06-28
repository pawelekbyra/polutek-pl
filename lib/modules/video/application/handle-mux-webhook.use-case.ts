import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok } from "@/lib/modules/shared/result";
import { VideoRepository } from "../infrastructure/video.repository";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER, mapMuxStateToProcessingState } from "../domain/video-asset.constants";
import { createScopedLogger } from "@/lib/logger";
import { attemptPublishAfterAssetReady } from "./publish-after-asset-ready.use-case";

export interface MuxWebhookPayload {
  type: string;
  data: {
    id: string;
    status?: string;
    playback_ids?: Array<{ id: string; policy: string }>;
    duration?: number;
    errors?: { type: string; messages: string[] };
    upload_id?: string;
  };
}

export async function handleMuxWebhook(
  payload: MuxWebhookPayload,
  ctx: AppContext
): Promise<UseCaseResult<{ assetId: string; status: string }, Error>> {
  const logger = createScopedLogger("handleMuxWebhook");
  const repository = new VideoRepository(ctx.prisma);

  const assetId = payload.data.id;
  const eventType = payload.type;

  logger.info("Processing Mux webhook", { type: eventType, assetId });

  // Find asset by Mux asset ID (providerAssetId) or by muxUploadId if this is an upload event
  let asset = await repository.findAssetByProviderId(VIDEO_PROVIDER.MUX, assetId);

  // For upload.asset_created events, the data.id is the asset ID from Mux
  // but we stored the upload ID in muxUploadId. Find by upload ID if direct lookup fails.
  if (!asset && payload.data.upload_id) {
    asset = await ctx.prisma.videoAsset.findFirst({
      where: { provider: "MUX", muxUploadId: payload.data.upload_id },
    }) ?? undefined;
  }

  if (!asset) {
    logger.warn("Received Mux webhook for unknown asset", { assetId, eventType });
    return ok({ assetId: "unknown", status: "ignored" });
  }

  if (eventType === "video.upload.asset_created") {
    // Mux created the asset from the upload — store the real asset ID
    await ctx.prisma.videoAsset.update({
      where: { id: asset.id },
      data: {
        providerAssetId: assetId,
        processingState: VIDEO_ASSET_PROCESSING_STATE.PROCESSING,
        providerSyncedAt: new Date(),
      },
    });
    return ok({ assetId: asset.id, status: "processing" });
  }

  const muxStatus = payload.data.status;
  if (!muxStatus) return ok({ assetId: asset.id, status: "no-status" });

  const newState = mapMuxStateToProcessingState(muxStatus);

  if (asset.processingState === VIDEO_ASSET_PROCESSING_STATE.READY && newState !== VIDEO_ASSET_PROCESSING_STATE.READY) {
    return ok({ assetId: asset.id, status: "no-change" });
  }

  const publicPlaybackId = payload.data.playback_ids?.find(p => p.policy === "public")?.id;
  const signedPlaybackId = payload.data.playback_ids?.find(p => p.policy === "signed")?.id;
  const playbackId = signedPlaybackId || publicPlaybackId;

  const updatedAsset = await ctx.writeTransaction(async (tx) => {
    const dataToUpdate: Record<string, unknown> = {
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
      dataToUpdate.failureReason = payload.data.errors?.messages?.join("; ") || "Mux processing error";
      dataToUpdate.isPrimary = false;
      dataToUpdate.pendingPrimaryIntent = false;
    }

    if (newState === VIDEO_ASSET_PROCESSING_STATE.READY) {
      dataToUpdate.failureReason = null;
      if (playbackId) dataToUpdate.providerPlaybackId = playbackId;
      if (payload.data.duration != null) {
        const minutes = Math.floor(payload.data.duration / 60);
        const seconds = Math.floor(payload.data.duration % 60);
        await tx.video.update({
          where: { id: asset.videoId },
          data: { duration: `${minutes}:${seconds.toString().padStart(2, "0")}` },
        });
      }

      const shouldBecomePrimary = asset.pendingPrimaryIntent;
      const existingPrimary = await tx.videoAsset.findFirst({
        where: { videoId: asset.videoId, isPrimary: true, id: { not: asset.id } },
      });

      if (shouldBecomePrimary || !existingPrimary) {
        dataToUpdate.isPrimary = true;
        dataToUpdate.pendingPrimaryIntent = false;
        await tx.videoAsset.updateMany({
          where: { videoId: asset.videoId, id: { not: asset.id } },
          data: { isPrimary: false },
        });
      }
    }

    const updated = await repository.updateAsset(asset.id, dataToUpdate, tx);

    await recordAuditEvent(ctx, {
      action: "VIDEO_ASSET_STATUS_UPDATED",
      targetType: "Video",
      targetId: asset.videoId,
      metadata: {
        assetId: asset.id,
        provider: VIDEO_PROVIDER.MUX,
        muxAssetId: assetId,
        oldState: asset.processingState,
        newState,
        muxEvent: eventType,
      },
    }, tx);

    return updated;
  });

  if (updatedAsset.processingState === VIDEO_ASSET_PROCESSING_STATE.READY) {
    await attemptPublishAfterAssetReady(updatedAsset.videoId, ctx);
  }

  return ok({ assetId: updatedAsset.id, status: updatedAsset.processingState });
}
