import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CloudflareStreamClient } from "../infrastructure/cloudflare-stream.client";
import { VideoRepository } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoNotFoundError, VideoNotOnMainChannelError } from "../domain/video.errors";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";

export interface GetCloudflareUploadUrlInput {
  videoId: string;
}

export interface CloudflareUploadUrlDto {
  uploadUrl: string;
  providerAssetId: string;
}

export async function getCloudflareUploadUrl(
  input: GetCloudflareUploadUrlInput,
  ctx: AppContext
): Promise<UseCaseResult<CloudflareUploadUrlDto, VideoNotFoundError | VideoNotOnMainChannelError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);

  const video = await repository.findByIdForMainChannel(input.videoId, mainChannel.id);
  if (!video) return fail(new VideoNotFoundError(input.videoId));

  const client = new CloudflareStreamClient();

  try {
    const uploadResponse = await client.createDirectUploadUrl();

    await (ctx.prisma as any).$transaction(async (tx: any) => {
      await repository.upsertAsset(video.id, {
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        providerAssetId: uploadResponse.result.uid,
        processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
        isPrimary: false, // Not primary until actually uploaded/ready
        providerSyncedAt: new Date()
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
    return fail({
      code: 'CLOUDFLARE_API_ERROR',
      message: error.message || 'Failed to communicate with Cloudflare Stream API',
      statusCode: 500
    } as any);
  }
}
