import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { VideoRepository } from "../infrastructure/video.repository";
import { CloudflareStreamClient } from "../infrastructure/cloudflare-stream.client";
import { handleCloudflareStreamWebhook } from "./handle-cloudflare-webhook.use-case";
import { VIDEO_PROVIDER } from "../domain/video-asset.constants";

export async function syncCloudflareStatus(
  videoId: string,
  ctx: AppContext
): Promise<UseCaseResult<any, any>> {
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdWithAsset(videoId);

  if (!video || !video.asset || video.asset.provider !== VIDEO_PROVIDER.CLOUDFLARE_STREAM || !video.asset.providerAssetId) {
    return fail({ code: 'NO_CLOUDFLARE_ASSET', message: 'No Cloudflare asset found for this video', statusCode: 404 });
  }

  const client = new CloudflareStreamClient();
  try {
    const details = await client.getAssetDetails(video.asset.providerAssetId);

    if (!details?.success || !details?.result) {
      return fail({ code: 'CLOUDFLARE_API_ERROR', message: 'Invalid response from Cloudflare API', statusCode: 500 });
    }

    // Use the webhook handler logic to process the status
    return await handleCloudflareStreamWebhook({
      uid: details.result.uid,
      status: details.result.status,
      playback: details.result.playback,
      duration: details.result.duration,
      size: details.result.size,
    }, ctx);
  } catch (error: any) {
    if (error.message?.includes('404')) {
        // Asset not found on Cloudflare - mark as FAILED
        return await handleCloudflareStreamWebhook({
            uid: video.asset.providerAssetId,
            status: {
                state: 'error',
                errorReasonText: 'Asset not found on Cloudflare (404 during sync)'
            }
        }, ctx);
    }
    return fail({ code: 'CLOUDFLARE_API_ERROR', message: error.message, statusCode: 500 });
  }
}
