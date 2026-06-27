import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AppError } from "@/lib/modules/shared/app-error";
import { VideoRepository } from "../infrastructure/video.repository";
import { recordAuditEvent } from "@/lib/modules/audit";

export async function removeVideoSource(
  videoId: string,
  assetId: string,
  ctx: AppContext
): Promise<UseCaseResult<{ deleted: boolean }, AppError>> {
  const repository = new VideoRepository(ctx.prisma);
  const assets = await repository.listAssetsForVideo(videoId);

  const asset = assets.find((a) => a.id === assetId);
  if (!asset || asset.videoId !== videoId) {
    return fail(new AppError("Źródło nie zostało znalezione.", 404, "ASSET_NOT_FOUND"));
  }

  if (asset.isPrimary) {
    return fail(new AppError("Nie można usunąć głównego źródła. Najpierw ustaw inne źródło jako główne.", 422, "CANNOT_DELETE_PRIMARY"));
  }

  await (ctx.prisma as any).$transaction(async (tx: any) => {
    await tx.videoAsset.delete({ where: { id: assetId } });

    await recordAuditEvent(ctx, {
      action: "VIDEO_SOURCE_REMOVED",
      targetType: "Video",
      targetId: videoId,
      metadata: { assetId, provider: asset.provider },
    }, tx);
  });

  return ok({ deleted: true });
}
