import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CloudflareStreamClient } from "../infrastructure/cloudflare-stream.client";
import { VideoRepository } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { CloudflareApiError, CloudflareConfigurationError, VideoNotFoundError, VideoNotOnMainChannelError } from "../domain/video.errors";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";
import { VideoStatus } from "@prisma/client";
import { requestPublishAfterAssetReady } from "./publish-after-asset-ready.use-case";

export interface ProvisionCloudflareUploadInput {
  videoId: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
}

export interface ProvisionCloudflareTusUploadInput {
  videoId: string;
  uploadLength: string;
  uploadMetadata?: string | null;
  maxDurationSeconds?: number;
}

export interface CloudflareUploadProvisionDto {
  uploadUrl: string;
  providerAssetId: string;
  assetId: string;
}

type CloudflareUploadProvisionFailure = VideoNotFoundError | VideoNotOnMainChannelError | AppError;

type UploadableVideo = Awaited<ReturnType<VideoRepository["findByIdForMainChannel"]>>;

type UploadableVideoResult =
  | { ok: true; video: NonNullable<UploadableVideo>; repository: VideoRepository }
  | { ok: false; error: CloudflareUploadProvisionFailure };

function decodeTusMetadataValue(metadata: string | null | undefined, key: string): string | undefined {
  if (!metadata) return undefined;

  for (const rawEntry of metadata.split(",")) {
    const [entryKey, encodedValue] = rawEntry.trim().split(/\s+/, 2);
    if (entryKey !== key || !encodedValue) continue;

    try {
      return Buffer.from(encodedValue, "base64").toString("utf8");
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function numberFromUploadLength(uploadLength: string): number | undefined {
  const parsed = Number(uploadLength);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

async function getUploadableVideo(
  videoId: string,
  ctx: AppContext
): Promise<UploadableVideoResult> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);

  const video = await repository.findByIdForMainChannel(videoId, mainChannel.id);
  if (!video) return { ok: false, error: new VideoNotFoundError(videoId) };

  if (video.status !== VideoStatus.DRAFT) {
      return { ok: false, error: new AppError('Only draft videos can be uploaded to Cloudflare', 400, 'VIDEO_NOT_DRAFT') };
  }

  if (video.asset && video.asset.isPrimary && video.asset.processingState === VIDEO_ASSET_PROCESSING_STATE.READY) {
      return { ok: false, error: new AppError('Video already has a ready primary asset. Replacement is not allowed.', 400, 'VIDEO_HAS_READY_ASSET') };
  }

  if (video.publishAfterAssetReady) {
    await requestPublishAfterAssetReady(video.id, ctx);
  }

  return { ok: true, video, repository };
}

async function persistProvisionedAsset(input: {
  ctx: AppContext;
  repository: VideoRepository;
  videoId: string;
  providerAssetId: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
  auditAction: string;
}) {
  return await (input.ctx.prisma as any).$transaction(async (tx: any) => {
    const upserted = await input.repository.updateVideoAsset(input.videoId, {
      provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
      providerAssetId: input.providerAssetId,
      processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
      isPrimary: false,
      providerSyncedAt: new Date(),
      processingStartedAt: new Date(),
      processingEndedAt: null,
      failureReason: null,
      mimeType: input.contentType,
      sizeBytes: input.fileSize,
    }, tx);

    await recordAuditEvent(input.ctx, {
      action: input.auditAction,
      targetType: 'Video',
      targetId: input.videoId,
      metadata: {
          providerAssetId: input.providerAssetId,
          fileName: input.fileName,
          fileSize: input.fileSize
      }
    }, tx);

    return upserted;
  });
}

export async function provisionCloudflareUpload(
  input: ProvisionCloudflareUploadInput,
  ctx: AppContext
): Promise<UseCaseResult<CloudflareUploadProvisionDto, CloudflareUploadProvisionFailure>> {
  const uploadable = await getUploadableVideo(input.videoId, ctx);
  if (!uploadable.ok) return fail(uploadable.error);

  const client = new CloudflareStreamClient();

  try {
    const uploadResponse = await client.createDirectUploadUrl();

    const asset = await persistProvisionedAsset({
      ctx,
      repository: uploadable.repository,
      videoId: uploadable.video.id,
      providerAssetId: uploadResponse.result.uid,
      fileName: input.fileName,
      fileSize: input.fileSize,
      contentType: input.contentType,
      auditAction: 'VIDEO_CLOUDFLARE_UPLOAD_PROVISIONED',
    });

    return ok({
      uploadUrl: uploadResponse.result.uploadURL,
      providerAssetId: uploadResponse.result.uid,
      assetId: asset?.id || ""
    });
  } catch (error: unknown) {
    if (error instanceof CloudflareConfigurationError || error instanceof CloudflareApiError || error instanceof AppError) {
      return fail(error);
    }
    return fail(new CloudflareApiError());
  }
}

export async function provisionCloudflareTusUpload(
  input: ProvisionCloudflareTusUploadInput,
  ctx: AppContext
): Promise<UseCaseResult<CloudflareUploadProvisionDto, CloudflareUploadProvisionFailure>> {
  const uploadable = await getUploadableVideo(input.videoId, ctx);
  if (!uploadable.ok) return fail(uploadable.error);

  const client = new CloudflareStreamClient();

  try {
    const uploadResponse = await client.createTusDirectUploadUrl({
      uploadLength: input.uploadLength,
      uploadMetadata: input.uploadMetadata,
      maxDurationSeconds: input.maxDurationSeconds,
    });

    const fileName = decodeTusMetadataValue(input.uploadMetadata, "filename");
    const contentType = decodeTusMetadataValue(input.uploadMetadata, "filetype");
    const fileSize = numberFromUploadLength(input.uploadLength);

    const asset = await persistProvisionedAsset({
      ctx,
      repository: uploadable.repository,
      videoId: uploadable.video.id,
      providerAssetId: uploadResponse.result.uid,
      fileName,
      fileSize,
      contentType,
      auditAction: 'VIDEO_CLOUDFLARE_TUS_UPLOAD_PROVISIONED',
    });

    return ok({
      uploadUrl: uploadResponse.result.uploadURL,
      providerAssetId: uploadResponse.result.uid,
      assetId: asset?.id || ""
    });
  } catch (error: unknown) {
    if (error instanceof CloudflareConfigurationError || error instanceof CloudflareApiError || error instanceof AppError) {
      return fail(error);
    }
    return fail(new CloudflareApiError());
  }
}
