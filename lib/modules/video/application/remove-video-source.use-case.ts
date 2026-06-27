import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoNotFoundError } from "../domain/video.errors";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository } from "../infrastructure/video.repository";

export interface RemoveVideoSourceInput {
  videoId: string;
  assetId: string;
}

type RemoveVideoSourceFailure = VideoNotFoundError | AppError;

export async function removeVideoSource(
  input: RemoveVideoSourceInput,
  ctx: AppContext,
): Promise<UseCaseResult<AdminVideoDto, RemoveVideoSourceFailure>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdWithAssets(input.videoId);
  if (!video || video.creatorId !== mainChannel.id) return fail(new VideoNotFoundError(input.videoId));

  const assets = (video as any).assets ?? [];
  const target = assets.find((a: any) => a.id === input.assetId);
  if (!target) return fail(new AppError("Asset not found on this video.", 404, "ASSET_NOT_FOUND"));

  if (target.isPrimary) {
    return fail(new AppError("Cannot remove the primary source. Promote another source first.", 400, "CANNOT_REMOVE_PRIMARY_ASSET"));
  }

  const updatedVideo = await (ctx.prisma as any).$transaction(async (tx: any) => {
    await (tx as any).videoAsset.delete({ where: { id: input.assetId } });

    await recordAuditEvent(ctx, {
      action: "VIDEO_SOURCE_REMOVED",
      targetType: "Video",
      targetId: video.id,
      metadata: { assetId: input.assetId, provider: target.provider },
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
