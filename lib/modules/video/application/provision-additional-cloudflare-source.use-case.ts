import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CloudflareStreamClient } from "../infrastructure/cloudflare-stream.client";
import { VideoRepository } from "../infrastructure/video.repository";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { CloudflareApiError, CloudflareConfigurationError, VideoNotFoundError } from "../domain/video.errors";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";

export interface ProvisionAdditionalCFSourceInput {
  videoId: string;
  uploadLength: string;
  uploadMetadata?: string | null;
}

export interface AdditionalCFSourceDto {
  uploadUrl: string;
  providerAssetId: string;
  assetId: string;
}

function decodeTusMeta(metadata: string | null | undefined, key: string): string | undefined {
  if (!metadata) return undefined;
  for (const raw of metadata.split(",")) {
    const [k, v] = raw.trim().split(/\s+/, 2);
    if (k !== key || !v) continue;
    try {
      // Buffer is available in Node.js runtime; the TS error is a missing @types/node (preistniejące w projekcie)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (globalThis as any).Buffer.from(v, "base64").toString("utf8");
    } catch { return undefined; }
  }
  return undefined;
}

export async function provisionAdditionalCloudflareSource(
  input: ProvisionAdditionalCFSourceInput,
  ctx: AppContext,
): Promise<UseCaseResult<AdditionalCFSourceDto, AppError>> {
  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdForMainChannel(input.videoId, mainChannel.id);
  if (!video) return fail(new VideoNotFoundError(input.videoId));

  const client = new CloudflareStreamClient();
  try {
    const uploadResponse = await client.createTusDirectUploadUrl({
      uploadLength: input.uploadLength,
      uploadMetadata: input.uploadMetadata,
    });

    const fileName = decodeTusMeta(input.uploadMetadata, "filename");
    const contentType = decodeTusMeta(input.uploadMetadata, "filetype");
    const fileSize = Number(input.uploadLength);

    // Tworzymy NOWY asset — nie upsertujemy istniejącego primary
    const asset = await ctx.prisma.videoAsset.create({
      data: {
        videoId: video.id,
        provider: VIDEO_PROVIDER.CLOUDFLARE_STREAM,
        objectKey: uploadResponse.result.uid,
        providerAssetId: uploadResponse.result.uid,
        processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
        isPrimary: false,
        providerSyncedAt: new Date(),
        processingStartedAt: new Date(),
        mimeType: contentType,
        sizeBytes: Number.isFinite(fileSize) && fileSize > 0 ? fileSize : undefined,
      },
    });

    await recordAuditEvent(ctx, {
      action: "VIDEO_SOURCE_CF_UPLOAD_PROVISIONED",
      targetType: "Video",
      targetId: video.id,
      metadata: { providerAssetId: uploadResponse.result.uid, fileName },
    });

    return ok({ uploadUrl: uploadResponse.result.uploadURL, providerAssetId: uploadResponse.result.uid, assetId: asset.id });
  } catch (error: unknown) {
    if (error instanceof CloudflareConfigurationError || error instanceof CloudflareApiError || error instanceof AppError) return fail(error);
    return fail(new CloudflareApiError());
  }
}
