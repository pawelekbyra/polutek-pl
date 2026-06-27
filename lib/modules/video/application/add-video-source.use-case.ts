import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AppError } from "@/lib/modules/shared/app-error";
import { VideoRepository } from "../infrastructure/video.repository";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER, extractYouTubeVideoId } from "../domain/video-asset.constants";
import type { VideoAsset } from "@prisma/client";

export interface AddVideoSourceInput {
  videoId: string;
  provider: "CLOUDFLARE_STREAM" | "YOUTUBE";
  /** Cloudflare Stream UID when provider=CLOUDFLARE_STREAM */
  providerAssetId?: string;
  /** Full YouTube URL when provider=YOUTUBE */
  youtubeUrl?: string;
}

export async function addVideoSource(
  input: AddVideoSourceInput,
  ctx: AppContext
): Promise<UseCaseResult<{ asset: VideoAsset }, AppError>> {
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdWithAsset(input.videoId);

  if (!video) {
    return fail(new AppError("Film nie został znaleziony.", 404, "VIDEO_NOT_FOUND"));
  }

  if (input.provider === "YOUTUBE") {
    if (!input.youtubeUrl) {
      return fail(new AppError("Adres URL YouTube jest wymagany.", 400, "YOUTUBE_URL_REQUIRED"));
    }

    const videoId = extractYouTubeVideoId(input.youtubeUrl);
    if (!videoId) {
      return fail(new AppError("Podany adres URL nie jest prawidłowym linkiem YouTube.", 400, "INVALID_YOUTUBE_URL"));
    }

    // YouTube is only allowed for PUBLIC / non-patron videos.
    if (video.tier === "PATRON") {
      return fail(new AppError("YouTube nie może być używany jako źródło dla filmów patron-only.", 422, "YOUTUBE_NOT_ALLOWED_FOR_PATRON"));
    }

    // Prevent duplicate YouTube source for the same video ID.
    const assets = await repository.listAssetsForVideo(input.videoId);
    const duplicate = assets.find((a) => a.provider === "YOUTUBE" && a.externalVideoId === videoId);
    if (duplicate) {
      return fail(new AppError("To źródło YouTube już istnieje dla tego filmu.", 409, "DUPLICATE_YOUTUBE_SOURCE"));
    }

    const asset = await (ctx.prisma as any).$transaction(async (tx: any) => {
      const created = await tx.videoAsset.create({
        data: {
          videoId: input.videoId,
          provider: VIDEO_PROVIDER.YOUTUBE,
          objectKey: `youtube:${videoId}`,
          externalVideoId: videoId,
          externalUrl: input.youtubeUrl,
          processingState: VIDEO_ASSET_PROCESSING_STATE.READY,
          isPrimary: assets.length === 0,
        },
      });

      await recordAuditEvent(ctx, {
        action: "VIDEO_SOURCE_ADDED",
        targetType: "Video",
        targetId: input.videoId,
        metadata: { provider: "YOUTUBE", externalVideoId: videoId, assetId: created.id },
      }, tx);

      return created;
    });

    return ok({ asset });
  }

  if (input.provider === "CLOUDFLARE_STREAM") {
    if (!input.providerAssetId) {
      return fail(new AppError("Cloudflare Stream UID jest wymagany.", 400, "CLOUDFLARE_UID_REQUIRED"));
    }

    // Prevent duplicate Cloudflare UID.
    const assets = await repository.listAssetsForVideo(input.videoId);
    const duplicate = assets.find((a) => a.provider === "CLOUDFLARE_STREAM" && a.providerAssetId === input.providerAssetId);
    if (duplicate) {
      return fail(new AppError("Ten Cloudflare Stream UID już istnieje dla tego filmu.", 409, "DUPLICATE_CLOUDFLARE_SOURCE"));
    }

    const asset = await (ctx.prisma as any).$transaction(async (tx: any) => {
      const created = await tx.videoAsset.create({
        data: {
          videoId: input.videoId,
          provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
          objectKey: input.providerAssetId,
          providerAssetId: input.providerAssetId,
          processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
          isPrimary: assets.length === 0,
        },
      });

      await recordAuditEvent(ctx, {
        action: "VIDEO_SOURCE_ADDED",
        targetType: "Video",
        targetId: input.videoId,
        metadata: { provider: "CLOUDFLARE_STREAM", providerAssetId: input.providerAssetId, assetId: created.id },
      }, tx);

      return created;
    });

    return ok({ asset });
  }

  return fail(new AppError("Nieobsługiwany dostawca źródła.", 400, "UNSUPPORTED_PROVIDER"));
}
