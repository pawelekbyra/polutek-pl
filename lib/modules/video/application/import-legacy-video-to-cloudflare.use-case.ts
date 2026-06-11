import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AppError } from "@/lib/modules/shared/app-error";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoRepository } from "../infrastructure/video.repository";
import { CloudflareStreamClient } from "../infrastructure/cloudflare-stream.client";
import { AdminVideoDto, toAdminVideoDto } from "../domain/video.dto";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";
import { VideoNotFoundError } from "../domain/video.errors";

export interface ImportLegacyVideoToCloudflareInput {
  videoId: string;
}

export class LegacyVideoUrlRequiredError extends AppError {
  constructor() {
    super("Legacy video URL is required before importing to Cloudflare Stream.", 400, "LEGACY_VIDEO_URL_REQUIRED");
  }
}

export class CloudflareAssetAlreadyExistsError extends AppError {
  constructor() {
    super("Cloudflare Stream asset is already attached or import is already in progress for this video.", 409, "CLOUDFLARE_ASSET_ALREADY_EXISTS");
  }
}

export class CloudflareLegacyImportError extends AppError {
  constructor() {
    super("Cloudflare Stream could not start the legacy video import. Check provider configuration and legacy source availability.", 502, "CLOUDFLARE_LEGACY_IMPORT_FAILED");
  }
}

export async function importLegacyVideoToCloudflare(
  input: ImportLegacyVideoToCloudflareInput,
  ctx: AppContext
): Promise<UseCaseResult<AdminVideoDto, VideoNotFoundError | LegacyVideoUrlRequiredError | CloudflareAssetAlreadyExistsError | CloudflareLegacyImportError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);

  const video = await repository.findByIdForMainChannel(input.videoId, mainChannel.id);
  if (!video) return fail(new VideoNotFoundError(input.videoId));

  const legacyVideoUrl = video.videoUrl?.trim();
  if (!legacyVideoUrl) return fail(new LegacyVideoUrlRequiredError());

  if (video.asset?.provider === VIDEO_PROVIDER.CLOUDFLARE_STREAM) {
    return fail(new CloudflareAssetAlreadyExistsError());
  }

  const client = new CloudflareStreamClient();

  let providerAssetId: string;
  try {
    const importResponse = await client.importVideoByUrl(legacyVideoUrl);
    providerAssetId = importResponse.result.uid;
  } catch {
    return fail(new CloudflareLegacyImportError());
  }

  let updatedVideo: any;

  try {
    updatedVideo = await (ctx.prisma as any).$transaction(async (tx: any) => {
      const current = await tx.video.findFirst({
        where: { id: input.videoId, creatorId: mainChannel.id },
        include: { asset: true, _count: { select: { comments: true } } }
      });

      if (!current) throw new VideoNotFoundError(input.videoId);
      if (current.asset?.provider === VIDEO_PROVIDER.CLOUDFLARE_STREAM) {
        throw new CloudflareAssetAlreadyExistsError();
      }

      await repository.upsertAsset(current.id, {
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        objectKey: `cloudflare-stream/${providerAssetId}`,
        bucket: null,
        providerAssetId,
        providerPlaybackId: providerAssetId,
        processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
        isPrimary: true,
        failureReason: null,
        providerSyncedAt: new Date(),
        processingStartedAt: new Date(),
        processingEndedAt: null,
      }, tx);

      await recordAuditEvent(ctx, {
        action: "VIDEO_CLOUDFLARE_LEGACY_IMPORT_STARTED",
        targetType: "Video",
        targetId: current.id,
        metadata: {
          provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
          providerAssetId,
          legacyUrlPreserved: true,
        }
      }, tx);

      return await tx.video.findFirst({
        where: { id: current.id, creatorId: mainChannel.id },
        include: { asset: true, _count: { select: { comments: true } } }
      });
    });
  } catch (error) {
    if (error instanceof VideoNotFoundError || error instanceof CloudflareAssetAlreadyExistsError) {
      return fail(error);
    }
    throw error;
  }

  if (!updatedVideo) return fail(new VideoNotFoundError(input.videoId));

  return ok(toAdminVideoDto(updatedVideo));
}
