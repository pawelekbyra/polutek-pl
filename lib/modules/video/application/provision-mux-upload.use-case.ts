import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoNotFoundError } from "../domain/video.errors";
import { VideoRepository } from "../infrastructure/video.repository";
import { MuxClient } from "../infrastructure/mux.client";
import { VIDEO_ASSET_PROCESSING_STATE, VIDEO_PROVIDER } from "../domain/video-asset.constants";

export interface ProvisionMuxUploadInput {
  videoId: string;
  /** Whether this upload should become primary once Mux reports READY. */
  primaryIntent?: boolean;
}

export interface MuxUploadProvisionDto {
  uploadUrl: string;
  uploadId: string;
  assetId: string;
}

export async function provisionMuxUpload(
  input: ProvisionMuxUploadInput,
  ctx: AppContext
): Promise<UseCaseResult<MuxUploadProvisionDto, VideoNotFoundError | AppError>> {
  if (!MuxClient.isConfigured()) {
    return fail(new AppError("Mux is not configured on this server.", 503, "MUX_NOT_CONFIGURED"));
  }

  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdForMainChannel(input.videoId, mainChannel.id);
  if (!video) return fail(new VideoNotFoundError(input.videoId));

  const client = new MuxClient();

  try {
    const upload = await client.createDirectUpload();

    const asset = await ctx.db.writeTransaction(async (tx) => {
      const created = await tx.videoAsset.create({
        data: {
          videoId: video.id,
          provider: VIDEO_PROVIDER.MUX,
          objectKey: `mux:upload:${upload.id}`,
          muxUploadId: upload.id,
          processingState: VIDEO_ASSET_PROCESSING_STATE.PENDING,
          isPrimary: false,
          pendingPrimaryIntent: Boolean(input.primaryIntent),
          processingStartedAt: new Date(),
          providerSyncedAt: new Date(),
        },
      });

      await recordAuditEvent(ctx, {
        action: "VIDEO_MUX_UPLOAD_PROVISIONED",
        targetType: "Video",
        targetId: video.id,
        metadata: { uploadId: upload.id, primaryIntent: Boolean(input.primaryIntent) },
      }, tx);

      return created;
    });

    return ok({
      uploadUrl: upload.url,
      uploadId: upload.id,
      assetId: asset.id,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) return fail(error);
    return fail(new AppError(
      `Mux upload provisioning failed: ${error instanceof Error ? error.message : String(error)}`,
      502,
      "MUX_UPLOAD_PROVISION_FAILED"
    ));
  }
}
