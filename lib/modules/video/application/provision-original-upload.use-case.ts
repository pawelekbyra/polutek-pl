import { randomUUID } from "node:crypto";
import { Prisma, VideoStatus } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, fail, ok } from "@/lib/modules/shared/result";
import { MainChannelService } from "@/lib/modules/channel";
import { recordAuditEvent } from "@/lib/modules/audit";
import { VideoRepository } from "../infrastructure/video.repository";
import { R2OriginalStorageClient } from "../infrastructure/r2-original-storage.client";
import { VideoNotFoundError, VideoNotOnMainChannelError } from "../domain/video.errors";

export type VideoOriginalStatus = "UPLOADING" | "READY" | "FAILED" | "DELETED";

export interface VideoOriginalDto {
  id: string;
  videoId: string;
  provider: "R2";
  bucket: string;
  objectKey: string;
  originalFileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  checksumSha256?: string | null;
  status: VideoOriginalStatus;
  failureReason?: string | null;
  uploadStartedAt?: Date | null;
  uploadCompletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProvisionOriginalUploadInput {
  videoId: string;
  fileName?: string | null;
  fileSize?: number | null;
  contentType?: string | null;
}

export interface ProvisionOriginalUploadDto {
  original: VideoOriginalDto;
  uploadUrl: string;
  expiresAt: Date;
  requiredHeaders: Record<string, string>;
}

export interface CompleteOriginalUploadInput {
  videoId: string;
  originalId: string;
}

export interface CompleteOriginalUploadDto {
  original: VideoOriginalDto;
}

type OriginalUploadFailure = VideoNotFoundError | VideoNotOnMainChannelError | AppError;

type VideoOriginalRecord = VideoOriginalDto;

function toVideoOriginalDto(record: VideoOriginalRecord): VideoOriginalDto {
  return {
    ...record,
    provider: "R2",
    status: record.status as VideoOriginalStatus,
  };
}

async function findOriginalByVideoId(db: any, videoId: string): Promise<VideoOriginalRecord | null> {
  const rows = await db.$queryRaw<VideoOriginalRecord[]>(Prisma.sql`
    SELECT
      id,
      "videoId",
      provider,
      bucket,
      "objectKey",
      "originalFileName",
      "mimeType",
      "sizeBytes",
      "checksumSha256",
      status,
      "failureReason",
      "uploadStartedAt",
      "uploadCompletedAt",
      "createdAt",
      "updatedAt"
    FROM "VideoOriginal"
    WHERE "videoId" = ${videoId}
    LIMIT 1
  `);

  return rows[0] ?? null;
}

async function findOriginalByIdForVideo(db: any, id: string, videoId: string): Promise<VideoOriginalRecord | null> {
  const rows = await db.$queryRaw<VideoOriginalRecord[]>(Prisma.sql`
    SELECT
      id,
      "videoId",
      provider,
      bucket,
      "objectKey",
      "originalFileName",
      "mimeType",
      "sizeBytes",
      "checksumSha256",
      status,
      "failureReason",
      "uploadStartedAt",
      "uploadCompletedAt",
      "createdAt",
      "updatedAt"
    FROM "VideoOriginal"
    WHERE id = ${id} AND "videoId" = ${videoId}
    LIMIT 1
  `);

  return rows[0] ?? null;
}

async function getUploadableVideo(input: { videoId: string; ctx: AppContext }) {
  const mainChannel = await MainChannelService.getRequired(input.ctx);
  const repository = new VideoRepository(input.ctx.prisma);
  const video = await repository.findByIdForMainChannel(input.videoId, mainChannel.id);

  if (!video) return { ok: false as const, error: new VideoNotFoundError(input.videoId) };
  if (video.status !== VideoStatus.DRAFT) {
    return { ok: false as const, error: new AppError("Only draft videos can receive a new R2 original upload.", 400, "VIDEO_NOT_DRAFT") };
  }

  return { ok: true as const, video, repository };
}

export async function provisionOriginalUpload(
  input: ProvisionOriginalUploadInput,
  ctx: AppContext,
): Promise<UseCaseResult<ProvisionOriginalUploadDto, OriginalUploadFailure>> {
  const uploadable = await getUploadableVideo({ videoId: input.videoId, ctx });
  if (!uploadable.ok) return fail(uploadable.error);

  const storage = new R2OriginalStorageClient();
  const bucket = storage.bucket;
  let original: VideoOriginalRecord;

  try {
    original = await ctx.db.writeTransaction(async (tx) => {
      const db = tx as any;
      const existing = await findOriginalByVideoId(db, uploadable.video.id);
      const now = ctx.now();

      if (existing?.status === "READY") {
        throw new AppError("Video already has a completed R2 original. Replacement requires an explicit future admin action.", 409, "VIDEO_ORIGINAL_ALREADY_READY");
      }

      if (existing?.status === "UPLOADING") return existing;

      const originalId = existing?.id ?? randomUUID();
      const objectKey = storage.createObjectKey({ videoId: uploadable.video.id, fileName: input.fileName });
      const fileSize = typeof input.fileSize === "number" && Number.isFinite(input.fileSize) ? Math.max(0, Math.floor(input.fileSize)) : null;
      const contentType = input.contentType?.trim() || null;
      const fileName = input.fileName?.trim() || null;

      if (existing) {
        await db.$executeRaw(Prisma.sql`
          UPDATE "VideoOriginal"
          SET
            bucket = ${bucket},
            "objectKey" = ${objectKey},
            "originalFileName" = ${fileName},
            "mimeType" = ${contentType},
            "sizeBytes" = ${fileSize},
            "checksumSha256" = NULL,
            status = 'UPLOADING',
            "failureReason" = NULL,
            "uploadStartedAt" = ${now},
            "uploadCompletedAt" = NULL,
            "updatedAt" = ${now}
          WHERE id = ${originalId}
        `);
      } else {
        await db.$executeRaw(Prisma.sql`
          INSERT INTO "VideoOriginal" (
            id,
            "videoId",
            provider,
            bucket,
            "objectKey",
            "originalFileName",
            "mimeType",
            "sizeBytes",
            "checksumSha256",
            status,
            "failureReason",
            "uploadStartedAt",
            "uploadCompletedAt",
            "createdAt",
            "updatedAt"
          ) VALUES (
            ${originalId},
            ${uploadable.video.id},
            'R2',
            ${bucket},
            ${objectKey},
            ${fileName},
            ${contentType},
            ${fileSize},
            NULL,
            'UPLOADING',
            NULL,
            ${now},
            NULL,
            ${now},
            ${now}
          )
        `);
      }

      await recordAuditEvent(ctx, {
        action: "VIDEO_ORIGINAL_UPLOAD_PROVISIONED",
        targetType: "Video",
        targetId: uploadable.video.id,
        metadata: {
          originalId,
          bucket,
          objectKey,
          fileName,
          fileSize,
          contentType,
        },
      }, tx);

      const updated = await findOriginalByIdForVideo(db, originalId, uploadable.video.id);
      if (!updated) throw new AppError("R2 original record could not be created.", 500, "VIDEO_ORIGINAL_CREATE_FAILED");
      return updated;
    });

    const signed = await storage.createPresignedPutUrl({
      objectKey: original.objectKey,
      contentType: original.mimeType,
    });

    return ok({
      original: toVideoOriginalDto(original),
      uploadUrl: signed.uploadUrl,
      expiresAt: signed.expiresAt,
      requiredHeaders: signed.requiredHeaders,
    });
  } catch (error: unknown) {
    if (error instanceof AppError || error instanceof VideoNotFoundError || error instanceof VideoNotOnMainChannelError) return fail(error);
    return fail(new AppError("Could not provision R2 original upload.", 500, "VIDEO_ORIGINAL_UPLOAD_PROVISION_FAILED"));
  }
}

export async function completeOriginalUpload(
  input: CompleteOriginalUploadInput,
  ctx: AppContext,
): Promise<UseCaseResult<CompleteOriginalUploadDto, OriginalUploadFailure>> {
  const uploadable = await getUploadableVideo({ videoId: input.videoId, ctx });
  if (!uploadable.ok) return fail(uploadable.error);

  const storage = new R2OriginalStorageClient();

  try {
    const existing = await findOriginalByIdForVideo(ctx.prisma as any, input.originalId, uploadable.video.id);
    if (!existing) return fail(new AppError("R2 original upload record was not found for this video.", 404, "VIDEO_ORIGINAL_NOT_FOUND"));
    if (existing.status === "DELETED") return fail(new AppError("R2 original upload record is deleted.", 410, "VIDEO_ORIGINAL_DELETED"));

    const metadata = await storage.getObjectMetadata(existing.objectKey);

    const original = await ctx.db.writeTransaction(async (tx) => {
      const db = tx as any;
      const now = ctx.now();
      await db.$executeRaw(Prisma.sql`
        UPDATE "VideoOriginal"
        SET
          "mimeType" = ${metadata.contentType ?? existing.mimeType ?? null},
          "sizeBytes" = ${metadata.sizeBytes ?? existing.sizeBytes ?? null},
          "checksumSha256" = ${metadata.checksumSha256 ?? existing.checksumSha256 ?? null},
          status = 'READY',
          "failureReason" = NULL,
          "uploadCompletedAt" = ${now},
          "updatedAt" = ${now}
        WHERE id = ${existing.id} AND "videoId" = ${uploadable.video.id}
      `);

      await recordAuditEvent(ctx, {
        action: "VIDEO_ORIGINAL_UPLOAD_COMPLETED",
        targetType: "Video",
        targetId: uploadable.video.id,
        metadata: {
          originalId: existing.id,
          bucket: existing.bucket,
          objectKey: existing.objectKey,
          sizeBytes: metadata.sizeBytes,
          contentType: metadata.contentType,
          etag: metadata.etag,
        },
      }, tx);

      const updated = await findOriginalByIdForVideo(db, existing.id, uploadable.video.id);
      if (!updated) throw new AppError("R2 original record could not be completed.", 500, "VIDEO_ORIGINAL_COMPLETE_FAILED");
      return updated;
    });

    return ok({ original: toVideoOriginalDto(original) });
  } catch (error: unknown) {
    if (error instanceof AppError || error instanceof VideoNotFoundError || error instanceof VideoNotOnMainChannelError) return fail(error);
    return fail(new AppError("Could not complete R2 original upload.", 500, "VIDEO_ORIGINAL_UPLOAD_COMPLETE_FAILED"));
  }
}
