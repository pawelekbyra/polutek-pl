import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoNotFoundError } from "../domain/video.errors";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VideoRepository } from "../infrastructure/video.repository";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";
import { VideoPlaybackRouteService } from "./video-playback-route.service";

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
  const target = assets.find((asset: { id: string }) => asset.id === input.assetId);
  if (!target) return fail(new AppError("Asset not found on this video.", 404, "ASSET_NOT_FOUND"));

  // Guard: only PLAYABLE providers can be primary
  const isCloudflare = target.provider === VIDEO_PROVIDER.CLOUDFLARE_STREAM;
  const isMux = target.provider === VIDEO_PROVIDER.MUX;
  const isYoutube = target.provider === VIDEO_PROVIDER.YOUTUBE;
  const isVimeo = target.provider === VIDEO_PROVIDER.VIMEO;

  if (!isCloudflare && !isMux && !isYoutube && !isVimeo) {
    return fail(new AppError("Only Cloudflare Stream, Mux, YouTube and Vimeo assets can be set as primary.", 400, "NON_PLAYABLE_PROVIDER"));
  }

  if (video.tier === "PATRON" && isYoutube) {
    return fail(new AppError("YouTube sources are not allowed for PATRON-tier videos.", 403, "YOUTUBE_PATRON_FORBIDDEN"));
  }

  if (video.tier === "PATRON" && isVimeo) {
    return fail(new AppError("Vimeo sources are not allowed for PATRON-tier videos.", 403, "VIMEO_PATRON_FORBIDDEN"));
  }

  if ((isCloudflare || isMux) && target.processingState !== VIDEO_ASSET_PROCESSING_STATE.READY) {
    return fail(new AppError(`${target.provider} asset must be in READY state to become primary.`, 400, "ASSET_NOT_READY"));
  }

  if (isYoutube && !target.externalVideoId) {
    return fail(new AppError("YouTube asset is missing a video ID.", 400, "MISSING_YOUTUBE_VIDEO_ID"));
  }

  if (isVimeo && !target.externalVideoId) {
    return fail(new AppError("Vimeo asset is missing a video ID.", 400, "MISSING_VIMEO_VIDEO_ID"));
  }

  if (target.isPrimary) {
    return ok(toAdminVideoDto(video));
  }

  const updatedVideo = await new VideoPlaybackRouteService().activateRoute({
    videoId: video.id,
    assetId: input.assetId,
    activatedBy: "ADMIN",
    reason: "legacy-set-primary-compat",
  }, ctx).then(async () => {
    await recordAuditEvent(ctx, {
      action: "VIDEO_SOURCE_MADE_PRIMARY",
      targetType: "Video",
      targetId: video.id,
      metadata: { assetId: input.assetId, provider: target.provider, compatibilityRouteActivation: true },
    });
    return repository.findByIdForMainChannel(video.id, mainChannel.id);
  }).catch((error: unknown) => {
    if (error instanceof AppError) return error;
    throw error;
  });

  if (updatedVideo instanceof AppError) return fail(updatedVideo);
  if (!updatedVideo) return fail(new VideoNotFoundError(input.videoId));
  return ok(toAdminVideoDto(updatedVideo));
}
