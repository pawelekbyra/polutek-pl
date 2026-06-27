import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { MainChannelService } from "@/lib/modules/channel";
import { VideoRepository } from "../infrastructure/video.repository";
import { CloudflareStreamClient } from "../infrastructure/cloudflare-stream.client";
import { handleCloudflareStreamWebhook } from "./handle-cloudflare-webhook.use-case";
import { CloudflareNotFoundError } from "../domain/video.errors";

export async function syncVideoAssetStatus(
  { videoId, assetId }: { videoId: string; assetId: string },
  ctx: AppContext,
): Promise<UseCaseResult<{ assetId: string; status: string }, AppError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdForMainChannel(videoId, mainChannel.id);
  if (!video) return fail(new AppError("Film nie istnieje.", 404, "VIDEO_NOT_FOUND"));

  const asset = video.assets.find((a: { id: string }) => a.id === assetId);
  if (!asset) return fail(new AppError("Źródło nie istnieje.", 404, "ASSET_NOT_FOUND"));
  if ((asset as any).provider !== "CLOUDFLARE_STREAM") {
    return fail(new AppError(`Sync nie jest obsługiwany dla ${(asset as any).provider}.`, 422, "SYNC_NOT_SUPPORTED"));
  }

  const providerAssetId = (asset as any).providerAssetId;
  if (!providerAssetId) return fail(new AppError("Asset nie ma providerAssetId.", 422, "MISSING_PROVIDER_ASSET_ID"));

  const client = new CloudflareStreamClient();
  try {
    const details = await client.getAssetDetails(providerAssetId);
    if (!details?.success || !details?.result) {
      return fail(new AppError("Nieprawidłowa odpowiedź z Cloudflare API.", 500, "CLOUDFLARE_API_ERROR"));
    }
    const webhookResult = await handleCloudflareStreamWebhook({
      uid: details.result.uid,
      status: details.result.status,
      playback: details.result.playback,
      duration: details.result.duration,
      size: details.result.size,
    }, ctx);
    if (!webhookResult.ok) return fail(new AppError("Błąd synchronizacji.", 500, "SYNC_ERROR"));
    return ok(webhookResult.data);
  } catch (error: any) {
    if (error instanceof CloudflareNotFoundError) {
      await handleCloudflareStreamWebhook({ uid: providerAssetId, status: { state: "error", errorReasonText: "Asset not found on Cloudflare (404 during sync)" } }, ctx);
      return fail(new AppError("Asset nie istnieje na Cloudflare.", 404, "CLOUDFLARE_ASSET_NOT_FOUND"));
    }
    return fail(new AppError(error.message, 500, "CLOUDFLARE_API_ERROR"));
  }
}
