import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AppError } from "@/lib/modules/shared/app-error";
import { VideoRepository } from "../infrastructure/video.repository";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VIDEO_ASSET_PROCESSING_STATE, PLAYABLE_PROVIDERS } from "../domain/video-asset.constants";
import type { VideoAsset } from "@prisma/client";

export async function makeSourcePrimary(
  videoId: string,
  assetId: string,
  ctx: AppContext
): Promise<UseCaseResult<{ asset: VideoAsset }, AppError>> {
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdWithAssets(videoId);

  if (!video) {
    return fail(new AppError("Film nie został znaleziony.", 404, "VIDEO_NOT_FOUND"));
  }

  const asset = video.assets.find((a: { id: string }) => a.id === assetId) as (typeof video.assets)[number] | undefined;
  if (!asset) {
    return fail(new AppError("Źródło nie zostało znalezione.", 404, "ASSET_NOT_FOUND"));
  }

  // Only READY assets can become primary.
  if (asset.processingState !== VIDEO_ASSET_PROCESSING_STATE.READY) {
    return fail(new AppError("Tylko gotowe (READY) źródło może być ustawione jako główne.", 422, "ASSET_NOT_READY"));
  }

  // Only playable providers can be set as primary.
  if (!PLAYABLE_PROVIDERS.includes(asset.provider)) {
    return fail(new AppError(
      `Dostawca ${asset.provider} nie jest obsługiwany jako aktywne źródło odtwarzania. Dozwolone: ${PLAYABLE_PROVIDERS.join(", ")}.`,
      422,
      "PROVIDER_NOT_PLAYABLE"
    ));
  }

  // YouTube cannot be primary for PATRON videos.
  if (asset.provider === "YOUTUBE" && video.tier === "PATRON") {
    return fail(new AppError("YouTube nie może być głównym źródłem dla filmów patron-only.", 422, "YOUTUBE_NOT_ALLOWED_FOR_PATRON"));
  }

  const updated = await (ctx.prisma as any).$transaction(async (tx: any) => {
    // Unset all others.
    await tx.videoAsset.updateMany({
      where: { videoId, id: { not: assetId } },
      data: { isPrimary: false },
    });

    const promoted = await tx.videoAsset.update({
      where: { id: assetId },
      data: { isPrimary: true },
    });

    await recordAuditEvent(ctx, {
      action: "VIDEO_SOURCE_PRIMARY_SET",
      targetType: "Video",
      targetId: videoId,
      metadata: { assetId, provider: asset.provider },
    }, tx);

    return promoted;
  });

  return ok({ asset: updated });
}
