import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoNotFoundError, VideoNotOnMainChannelError } from "../domain/video.errors";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository } from "../infrastructure/video.repository";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER, extractYouTubeVideoId, extractVimeoVideoId } from "../domain/video-asset.constants";

export type AddVideoSourceProvider = "CLOUDFLARE_STREAM" | "MUX" | "YOUTUBE" | "VIMEO";

export interface AddVideoSourceInput {
  videoId: string;
  provider: AddVideoSourceProvider;
  /** Cloudflare Stream: asset UID */
  providerAssetId?: string;
  /** Cloudflare Stream: playback UID (defaults to providerAssetId) */
  providerPlaybackId?: string;
  /** YouTube: full URL or raw video ID */
  externalVideoId?: string;
  /** YouTube: canonical watch URL */
  externalUrl?: string;
  /** Set as primary immediately (only allowed when no existing READY primary exists) */
  setAsPrimary?: boolean;
}

type AddVideoSourceFailure = VideoNotFoundError | VideoNotOnMainChannelError | AppError;

export async function addVideoSource(
  input: AddVideoSourceInput,
  ctx: AppContext,
): Promise<UseCaseResult<AdminVideoDto, AddVideoSourceFailure>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdForMainChannel(input.videoId, mainChannel.id);
  if (!video) return fail(new VideoNotFoundError(input.videoId));

  if (input.provider === "CLOUDFLARE_STREAM") {
    const providerAssetId = input.providerAssetId?.trim();
    if (!providerAssetId) return fail(new AppError("providerAssetId is required for CLOUDFLARE_STREAM.", 400, "MISSING_PROVIDER_ASSET_ID"));

    const existing = await repository.findAssetByProviderId(VIDEO_PROVIDER.CLOUDFLARE_STREAM, providerAssetId);
    if (existing && existing.videoId !== video.id) {
      return fail(new AppError(`Cloudflare Stream asset ${providerAssetId} is already attached to another video.`, 409, "CLOUDFLARE_ASSET_IN_USE"));
    }

    if (existing && existing.videoId === video.id) {
      return ok(toAdminVideoDto(video));
    }

    const updatedVideo = await (ctx.prisma as any).$transaction(async (tx: any) => {
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
        action: "VIDEO_SOURCE_ADDED",
        targetType: "Video",
        targetId: video.id,
        metadata: { provider: "CLOUDFLARE_STREAM", providerAssetId },
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

  if (input.provider === "YOUTUBE") {
    const rawId = input.externalVideoId?.trim() || "";
    const videoId = extractYouTubeVideoId(rawId) || (rawId.match(/^[A-Za-z0-9_-]{11}$/) ? rawId : null);
    if (!videoId) {
      return fail(new AppError("A valid YouTube video ID or URL is required.", 400, "INVALID_YOUTUBE_VIDEO_ID"));
    }

    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Validate video exists via keyless oEmbed (no API key / quota needed).
    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!oembedRes.ok) {
        return fail(new AppError("YouTube video not found or not embeddable.", 422, "YOUTUBE_VIDEO_NOT_FOUND"));
      }
    } catch {
      return fail(new AppError("Could not verify YouTube video (network error). Try again.", 502, "YOUTUBE_OEMBED_UNAVAILABLE"));
    }

    const updatedVideo = await (ctx.prisma as any).$transaction(async (tx: any) => {
      const existingYt = await (tx as any).videoAsset.findFirst({
        where: { videoId: video.id, provider: "YOUTUBE" },
      });

      if (existingYt) {
        await (tx as any).videoAsset.update({
          where: { id: existingYt.id },
          data: {
            externalVideoId: videoId,
            externalUrl: input.externalUrl?.trim() || canonicalUrl,
            objectKey: `youtube:${videoId}`,
            processingState: VIDEO_ASSET_PROCESSING_STATE.READY,
          },
        });
      } else {
        await (tx as any).videoAsset.create({
          data: {
            videoId: video.id,
            provider: "YOUTUBE",
            objectKey: `youtube:${videoId}`,
            externalVideoId: videoId,
            externalUrl: input.externalUrl?.trim() || canonicalUrl,
            processingState: VIDEO_ASSET_PROCESSING_STATE.READY,
            isPrimary: false,
          },
        });
      }

      await recordAuditEvent(ctx, {
        action: "VIDEO_SOURCE_ADDED",
        targetType: "Video",
        targetId: video.id,
        metadata: { provider: "YOUTUBE", externalVideoId: videoId },
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

  if (input.provider === "MUX") {
    const providerAssetId = input.providerAssetId?.trim();
    if (!providerAssetId) {
      return fail(new AppError("providerAssetId (Mux playback ID) is required for MUX.", 400, "MISSING_PROVIDER_ASSET_ID"));
    }

    const existing = await repository.findAssetByProviderId(VIDEO_PROVIDER.MUX, providerAssetId);
    if (existing && existing.videoId !== video.id) {
      return fail(new AppError(`Mux asset ${providerAssetId} is already attached to another video.`, 409, "MUX_ASSET_IN_USE"));
    }
    if (existing && existing.videoId === video.id) {
      return ok(toAdminVideoDto(video));
    }

    const updatedVideo = await (ctx.prisma as any).$transaction(async (tx: any) => {
      await (tx as any).videoAsset.create({
        data: {
          videoId: video.id,
          provider: VIDEO_PROVIDER.MUX,
          objectKey: `mux:${providerAssetId}`,
          providerAssetId,
          providerPlaybackId: input.providerPlaybackId?.trim() || providerAssetId,
          processingState: VIDEO_ASSET_PROCESSING_STATE.READY,
          isPrimary: false,
          pendingPrimaryIntent: false,
          providerSyncedAt: new Date(),
          processingStartedAt: new Date(),
          processingEndedAt: new Date(),
        },
      });

      await recordAuditEvent(ctx, {
        action: "VIDEO_SOURCE_ADDED",
        targetType: "Video",
        targetId: video.id,
        metadata: { provider: "MUX", providerAssetId },
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

  if (input.provider === "VIMEO") {
    const rawId = input.externalVideoId?.trim() || "";
    const videoIdExtracted = extractVimeoVideoId(rawId) || (/^\d+$/.test(rawId) ? rawId : null);
    if (!videoIdExtracted) {
      return fail(new AppError("A valid Vimeo video ID or URL is required.", 400, "INVALID_VIMEO_VIDEO_ID"));
    }

    const canonicalUrl = `https://vimeo.com/${videoIdExtracted}`;

    try {
      const oembedRes = await fetch(
        `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(canonicalUrl)}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!oembedRes.ok) {
        return fail(new AppError("Vimeo video not found or not embeddable.", 422, "VIMEO_VIDEO_NOT_FOUND"));
      }
    } catch {
      return fail(new AppError("Could not verify Vimeo video (network error). Try again.", 502, "VIMEO_OEMBED_UNAVAILABLE"));
    }

    const updatedVideo = await (ctx.prisma as any).$transaction(async (tx: any) => {
      const existingVimeo = await tx.videoAsset.findFirst({
        where: { videoId: video.id, provider: "VIMEO" },
      });

      if (existingVimeo) {
        await (tx as any).videoAsset.update({
          where: { id: existingVimeo.id },
          data: {
            externalVideoId: videoIdExtracted,
            externalUrl: canonicalUrl,
            objectKey: `vimeo:${videoIdExtracted}`,
            processingState: VIDEO_ASSET_PROCESSING_STATE.READY,
          },
        });
      } else {
        await (tx as any).videoAsset.create({
          data: {
            videoId: video.id,
            provider: "VIMEO",
            objectKey: `vimeo:${videoIdExtracted}`,
            externalVideoId: videoIdExtracted,
            externalUrl: canonicalUrl,
            processingState: VIDEO_ASSET_PROCESSING_STATE.READY,
            isPrimary: false,
          },
        });
      }

      await recordAuditEvent(ctx, {
        action: "VIDEO_SOURCE_ADDED",
        targetType: "Video",
        targetId: video.id,
        metadata: { provider: "VIMEO", externalVideoId: videoIdExtracted },
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

  return fail(new AppError(`Unsupported provider: ${input.provider}`, 400, "UNSUPPORTED_PROVIDER"));
}
