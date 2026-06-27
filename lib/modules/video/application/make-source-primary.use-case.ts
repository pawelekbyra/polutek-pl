import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoNotFoundError } from "../domain/video.errors";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository } from "../infrastructure/video.repository";

export async function makeSourcePrimary(
  { videoId, assetId }: { videoId: string; assetId: string },
  ctx: AppContext,
): Promise<UseCaseResult<AdminVideoDto, AppError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdForMainChannel(videoId, mainChannel.id);
  if (!video) return fail(new VideoNotFoundError(videoId));

  const asset = video.assets.find((a: { id: string }) => a.id === assetId);
  if (!asset) return fail(new AppError("Źródło nie istnieje.", 404, "ASSET_NOT_FOUND"));

  if (asset.processingState !== "READY") {
    return fail(new AppError("Można ustawić jako aktywne tylko gotowe (READY) źródło.", 422, "ASSET_NOT_READY"));
  }

  if (asset.provider === "YOUTUBE" && video.tier === "PATRON") {
    return fail(new AppError("YouTube nie może być aktywnym źródłem dla filmów PATRON.", 422, "YOUTUBE_NOT_ALLOWED_FOR_PATRON"));
  }

  await ctx.prisma.$transaction([
    ctx.prisma.videoAsset.updateMany({ where: { videoId }, data: { isPrimary: false } }),
    ctx.prisma.videoAsset.update({ where: { id: assetId }, data: { isPrimary: true } }),
  ]);

  await recordAuditEvent(ctx, {
    action: "VIDEO_PRIMARY_SOURCE_CHANGED",
    targetType: "Video",
    targetId: videoId,
    metadata: { newPrimaryAssetId: assetId, provider: asset.provider },
  });

  const reloaded = await repository.findByIdForMainChannel(videoId, mainChannel.id);
  if (!reloaded) return fail(new VideoNotFoundError(videoId));
  return ok(toAdminVideoDto(reloaded));
}
