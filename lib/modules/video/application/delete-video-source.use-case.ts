import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoNotFoundError } from "../domain/video.errors";
import { VideoRepository } from "../infrastructure/video.repository";

export async function deleteVideoSource(
  { videoId, assetId }: { videoId: string; assetId: string },
  ctx: AppContext,
): Promise<UseCaseResult<{ deleted: true }, AppError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdForMainChannel(videoId, mainChannel.id);
  if (!video) return fail(new VideoNotFoundError(videoId));

  const asset = video.assets.find((a: { id: string }) => a.id === assetId);
  if (!asset) return fail(new AppError("Źródło nie istnieje.", 404, "ASSET_NOT_FOUND"));
  if (asset.isPrimary) return fail(new AppError("Nie można usunąć aktywnego źródła. Ustaw inne źródło jako aktywne, a następnie usuń to.", 422, "CANNOT_DELETE_PRIMARY"));

  await ctx.prisma.videoAsset.delete({ where: { id: assetId } });
  await recordAuditEvent(ctx, {
    action: "VIDEO_SOURCE_DELETED",
    targetType: "Video",
    targetId: videoId,
    metadata: { deletedAssetId: assetId, provider: asset.provider },
  });
  return ok({ deleted: true });
}
