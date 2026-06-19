import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CloudflareStreamClient } from "../infrastructure/cloudflare-stream.client";
import { VideoRepository } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoNotFoundError, VideoNotOnMainChannelError } from "../domain/video.errors";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";
import { VideoStatus } from "@prisma/client";

export interface ProvisionCloudflareUploadInput {
  videoId: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
}

export interface CloudflareUploadProvisionDto {
  uploadUrl: string;
  providerAssetId: string;
  assetId: string;
}

export async function provisionCloudflareUpload(
  input: ProvisionCloudflareUploadInput,
  ctx: AppContext
): Promise<UseCaseResult<CloudflareUploadProvisionDto, any>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);

  const video = await repository.findByIdForMainChannel(input.videoId, mainChannel.id);
  if (!video) return fail(new VideoNotFoundError(input.videoId));

  // Policy: Only DRAFT videos can have new uploads provisioned
  if (video.status !== VideoStatus.DRAFT) {
      return fail({
          code: 'VIDEO_NOT_DRAFT',
          message: 'Only draft videos can be uploaded to Cloudflare',
          statusCode: 400
      });
  }

  // Policy: Do not replace READY primary asset
  if (video.asset && video.asset.isPrimary && video.asset.processingState === VIDEO_ASSET_PROCESSING_STATE.READY) {
      return fail({
          code: 'VIDEO_HAS_READY_ASSET',
          message: 'Video already has a ready primary asset. Replacement is not allowed.',
          statusCode: 400
      });
  }

  const client = new CloudflareStreamClient();

  try {
    const uploadResponse = await client.createDirectUploadUrl();

    const asset = await (ctx.prisma as any).$transaction(async (tx: any) => {
      const upserted = await repository.upsertAsset(video.id, {
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        providerAssetId: uploadResponse.result.uid,
        processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
        isPrimary: false, // Not primary until READY
        providerSyncedAt: new Date(),
        processingStartedAt: new Date(),
        processingEndedAt: null,
        failureReason: null,
        mimeType: input.contentType,
        sizeBytes: input.fileSize,
      }, tx);

      await recordAuditEvent(ctx, {
        action: 'VIDEO_CLOUDFLARE_UPLOAD_PROVISIONED',
        targetType: 'Video',
        targetId: video.id,
        metadata: {
            providerAssetId: uploadResponse.result.uid,
            fileName: input.fileName,
            fileSize: input.fileSize
        }
      }, tx);

      return upserted;
    });

    return ok({
      uploadUrl: uploadResponse.result.uploadURL,
      providerAssetId: uploadResponse.result.uid,
      assetId: asset?.id || ""
    });
  } catch (error: any) {
    return fail({
      code: 'CLOUDFLARE_API_ERROR',
      message: error.message || 'Failed to communicate with Cloudflare Stream API',
      statusCode: 500
    } as any);
  }
}
