import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CloudflareStreamClient } from "../infrastructure/cloudflare-stream.client";
import { VideoRepository } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoNotFoundError, VideoNotOnMainChannelError } from "../domain/video.errors";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";
import { VideoStatus } from "@prisma/client";

export interface GetCloudflareUploadUrlInput {
  videoId: string;
}

export interface CloudflareUploadUrlDto {
  uploadUrl: string;
  providerAssetId: string;
}

type GetCloudflareUploadUrlFailure = VideoNotFoundError | VideoNotOnMainChannelError | AppError;

export async function getCloudflareUploadUrl(
  input: GetCloudflareUploadUrlInput,
  ctx: AppContext
): Promise<UseCaseResult<CloudflareUploadUrlDto, GetCloudflareUploadUrlFailure>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);

  const video = await repository.findByIdForMainChannel(input.videoId, mainChannel.id);
  if (!video) return fail(new VideoNotFoundError(input.videoId));

  if (video.status !== VideoStatus.DRAFT) {
    return fail(new AppError('Only draft videos can be uploaded to Cloudflare', 400, 'VIDEO_NOT_DRAFT'));
  }

  if (video.asset?.isPrimary && video.asset.processingState === VIDEO_ASSET_PROCESSING_STATE.READY) {
    return fail(new AppError('Video already has a ready primary asset. Replacement is not allowed.', 400, 'VIDEO_HAS_READY_ASSET'));
  }

  const client = new CloudflareStreamClient();

  try {
    const uploadResponse = await client.createDirectUploadUrl();

    await (ctx.prisma as any).$transaction(async (tx: any) => {
      await repository.upsertAsset(video.id, {
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        providerAssetId: uploadResponse.result.uid,
        processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
        isPrimary: false,
        providerSyncedAt: new Date(),
        processingStartedAt: new Date(),
        processingEndedAt: null,
        failureReason: null,
      }, tx);

      await recordAuditEvent(ctx, {
        action: 'VIDEO_CLOUDFLARE_UPLOAD_URL_CREATED',
        targetType: 'Video',
        targetId: video.id,
        metadata: { providerAssetId: uploadResponse.result.uid }
      }, tx);
    });

    return ok({
      uploadUrl: uploadResponse.result.uploadURL,
      providerAssetId: uploadResponse.result.uid
    });
  } catch (error: any) {
    return fail(new AppError(error.message || 'Failed to communicate with Cloudflare Stream API', 502, 'CLOUDFLARE_API_ERROR'));
  }
}
