import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { MainChannelService } from "@/lib/modules/channel";
import { VideoNotFoundError } from "../domain/video.errors";
import { VideoRepository } from "../infrastructure/video.repository";
import { R2OriginalStorageClient } from "../infrastructure/r2-original-storage.client";
import { recordAuditEvent } from "@/lib/modules/audit";

export interface ProvisionOriginalUploadInput {
  videoId: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
}

export interface OriginalUploadProvisionDto {
  uploadUrl: string;
  originalId: string;
  objectKey: string;
  bucket: string;
}

type Failure = VideoNotFoundError | AppError;

export async function provisionOriginalUpload(
  input: ProvisionOriginalUploadInput,
  ctx: AppContext
): Promise<UseCaseResult<OriginalUploadProvisionDto, Failure>> {
  if (!R2OriginalStorageClient.isConfigured()) {
    return fail(new AppError("R2 storage is not configured.", 503, "R2_NOT_CONFIGURED"));
  }

  const mainChannel = await MainChannelService.getRequired(ctx);
  const repository = new VideoRepository(ctx.prisma);
  const video = await repository.findByIdForMainChannel(input.videoId, mainChannel.id);
  if (!video) return fail(new VideoNotFoundError(input.videoId));

  const rawExt = input.fileName?.split(".").pop() ?? "mp4";
  const ext = /^[a-z0-9]{1,10}$/i.test(rawExt) ? rawExt.toLowerCase() : "mp4";
  const objectKey = `originals/${video.id}/${Date.now()}.${ext}`;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS!;

  // Create DB record first — if presign fails after, no orphaned URL exists
  const original = await ctx.prisma.videoOriginal.upsert({
    where: { videoId: video.id },
    create: {
      videoId: video.id,
      bucket,
      objectKey,
      originalFileName: input.fileName,
      mimeType: input.contentType,
      sizeBytes: input.fileSize ? BigInt(input.fileSize) : null,
      status: "UPLOADING",
      uploadStartedAt: new Date(),
    },
    update: {
      bucket,
      objectKey,
      originalFileName: input.fileName,
      mimeType: input.contentType,
      sizeBytes: input.fileSize ? BigInt(input.fileSize) : null,
      status: "UPLOADING",
      uploadStartedAt: new Date(),
      uploadCompletedAt: null,
      failureReason: null,
    },
  });

  const r2 = new R2OriginalStorageClient();
  const { uploadUrl } = await r2.createPresignedUploadUrl({
    objectKey,
    contentType: input.contentType,
    expiresInSeconds: 7200,
  });

  await recordAuditEvent(ctx, {
    action: "VIDEO_ORIGINAL_UPLOAD_PROVISIONED",
    targetType: "Video",
    targetId: video.id,
    metadata: { originalId: original.id, objectKey, bucket },
  });

  return ok({
    uploadUrl,
    originalId: original.id,
    objectKey,
    bucket,
  });
}
