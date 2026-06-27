import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoNotFoundError } from "../domain/video.errors";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository } from "../infrastructure/video.repository";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";

export interface MakeSourcePrimaryInput {
  videoId: string;
  assetId: string;
}

type MakeSourcePrimaryFailure = VideoNotFoundError | AppError;

export async function makeSourcePrimary(
  input: MakeSourcePrimaryInput,
  ctx: AppContext,
): Promise<UseCaseResult<AdminVideoDto, MakeSourcePrimaryFailure>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdWithAssets(input.videoId);
  if (!video || video.creatorId !== mainChannel.id) return fail(new VideoNotFoundError(input.videoId));

  const assets = (video as any).assets ?? [];
  const target = assets.find((a: any) => a.id === input.assetId);
  if (!target) return fail(new AppError("Asset not found on this video.", 404, "ASSET_NOT_FOUND"));

  // Guard: only PLAYABLE providers can be primary
  const isCloudflare = target.provider === VIDEO_PROVIDER.CLOUDFLARE_STREAM;
  const isYoutube = target.provider === VIDEO_PROVIDER.YOUTUBE;

  if (!isCloudflare && !isYoutube) {
    return fail(new AppError("Only Cloudflare Stream and YouTube assets can be set as primary.", 400, "NON_PLAYABLE_PROVIDER"));
  }

  if (isCloudflare && target.processingState !== VIDEO_ASSET_PROCESSING_STATE.READY) {
    return fail(new AppError("Cloudflare Stream asset must be in READY state to become primary.", 400, "ASSET_NOT_READY"));
  }

  if (isYoutube && !target.externalVideoId) {
    return fail(new AppError("YouTube asset is missing a video ID.", 400, "MISSING_YOUTUBE_VIDEO_ID"));
  }

  if (isYoutube && video.tier === "PATRON") {
    return fail(new AppError("YouTube cannot be the primary source for PATRON-tier videos.", 400, "YOUTUBE_PATRON_FORBIDDEN"));
  }

  if (target.isPrimary) {
    return ok(toAdminVideoDto(video));
  }

  const updatedVideo = await (ctx.prisma as any).$transaction(async (tx: any) => {
    // Demote all other primary assets
    await (tx as any).videoAsset.updateMany({
      where: { videoId: video.id, isPrimary: true, id: { not: input.assetId } },
      data: { isPrimary: false },
    });

    // Promote the target
    await (tx as any).videoAsset.update({
      where: { id: input.assetId },
      data: { isPrimary: true },
    });

    await recordAuditEvent(ctx, {
      action: "VIDEO_SOURCE_MADE_PRIMARY",
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
