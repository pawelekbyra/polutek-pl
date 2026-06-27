import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoNotFoundError } from "../domain/video.errors";
import { AdminVideoAssetDto, toAdminVideoAssetDto } from "../domain/video.dto";
import { VideoRepository } from "../infrastructure/video.repository";
import { extractYouTubeVideoId, buildYouTubeWatchUrl } from "../domain/youtube-adapter";

export type AddVideoSourceInput =
  | { provider: "CLOUDFLARE_STREAM"; videoId: string; providerAssetId: string; providerPlaybackId?: string }
  | { provider: "YOUTUBE"; videoId: string; youtubeUrl: string }
  | { provider: "R2"; videoId: string; bucket: string; objectKey: string }
  | { provider: "MUX"; videoId: string; providerAssetId: string };

export async function addVideoSource(
  input: AddVideoSourceInput,
  ctx: AppContext,
): Promise<UseCaseResult<AdminVideoAssetDto | null, AppError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdForMainChannel(input.videoId, mainChannel.id);
  if (!video) return fail(new VideoNotFoundError(input.videoId));

  if (input.provider === "YOUTUBE") {
    const ytId = extractYouTubeVideoId(input.youtubeUrl);
    if (!ytId) return fail(new AppError("Nieprawidłowy URL YouTube.", 400, "INVALID_YOUTUBE_URL"));
    if (video.tier === "PATRON") {
      return fail(new AppError("YouTube nie może być źródłem dla filmów PATRON.", 422, "YOUTUBE_NOT_ALLOWED_FOR_PATRON"));
    }

    const asset = await ctx.prisma.videoAsset.create({
      data: {
        videoId: video.id,
        provider: "YOUTUBE",
        objectKey: ytId,
        externalVideoId: ytId,
        externalUrl: buildYouTubeWatchUrl(ytId),
        processingState: "READY",
        isPrimary: false,
      },
    });
    await recordAuditEvent(ctx, { action: "VIDEO_SOURCE_ADDED", targetType: "Video", targetId: video.id, metadata: { provider: "YOUTUBE", externalVideoId: ytId } });
    return ok(toAdminVideoAssetDto(asset));
  }

  if (input.provider === "CLOUDFLARE_STREAM") {
    const providerAssetId = input.providerAssetId.trim();
    if (!providerAssetId) return fail(new AppError("Cloudflare Stream UID jest wymagany.", 400, "MISSING_PROVIDER_ASSET_ID"));
    const asset = await ctx.prisma.videoAsset.create({
      data: {
        videoId: video.id,
        provider: "CLOUDFLARE_STREAM",
        objectKey: providerAssetId,
        providerAssetId,
        providerPlaybackId: input.providerPlaybackId?.trim() || providerAssetId,
        processingState: "PENDING",
        isPrimary: false,
      },
    });
    await recordAuditEvent(ctx, { action: "VIDEO_SOURCE_ADDED", targetType: "Video", targetId: video.id, metadata: { provider: "CLOUDFLARE_STREAM", providerAssetId } });
    return ok(toAdminVideoAssetDto(asset));
  }

  if (input.provider === "R2") {
    const asset = await ctx.prisma.videoAsset.create({
      data: {
        videoId: video.id,
        provider: "R2",
        objectKey: input.objectKey,
        bucket: input.bucket,
        processingState: "READY",
        isPrimary: false,
      },
    });
    await recordAuditEvent(ctx, { action: "VIDEO_SOURCE_ADDED", targetType: "Video", targetId: video.id, metadata: { provider: "R2", objectKey: input.objectKey } });
    return ok(toAdminVideoAssetDto(asset));
  }

  if (input.provider === "MUX") {
    const providerAssetId = input.providerAssetId.trim();
    if (!providerAssetId) return fail(new AppError("Mux Asset ID jest wymagany.", 400, "MISSING_PROVIDER_ASSET_ID"));
    const asset = await ctx.prisma.videoAsset.create({
      data: {
        videoId: video.id,
        provider: "MUX",
        objectKey: providerAssetId,
        providerAssetId,
        processingState: "PENDING",
        isPrimary: false,
      },
    });
    await recordAuditEvent(ctx, { action: "VIDEO_SOURCE_ADDED", targetType: "Video", targetId: video.id, metadata: { provider: "MUX", providerAssetId } });
    return ok(toAdminVideoAssetDto(asset));
  }

  return fail(new AppError("Nieobsługiwany provider.", 400, "UNSUPPORTED_PROVIDER"));
}
