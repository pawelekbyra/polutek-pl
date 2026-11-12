import type { VideoOriginal } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { recordAuditEvent, recordAuditEventSafe } from "@/lib/modules/audit";
import { requestPublishAfterAssetReady } from "@/lib/modules/video";
import {
  MAX_PARTS_PER_PRESIGN,
  PART_URL_TTL_SECONDS,
  SNIFF_BYTES,
  isValidPartNumbers,
  maxUploadBytes,
  mimeForContainer,
  originalObjectKey,
  planParts,
  sniffVideoContainer,
  validateUploadRequest,
  type UploadRequest,
} from "../domain/upload-policy";
import { OriginalsMultipart, type UploadedPart } from "../infrastructure/r2-multipart";
import { enqueueEncode, type EncodeJobDto } from "./encode-queue.use-cases";
import { requireVideo } from "./video-guard";
import { channelUploadLimitError } from "./channel-limits";
import { MainChannelService } from "@/lib/modules/channel";
import type { WriteTx } from "@/lib/modules/shared/db";

/** The storage operations the use cases need (R2 in production, a fake in tests). */
export type OriginalsStoragePort = Pick<OriginalsMultipart, "bucket" | "create" | "presignPart" | "listParts" | "complete" | "abort" | "head" | "readHead" | "deleteObject">;

export interface UploadDeps {
  storage?: OriginalsStoragePort | null;
  now?: () => number;
  maxBytes?: number;
}

function storageOrFail(deps: UploadDeps | undefined): OriginalsStoragePort {
  const storage = deps?.storage === undefined ? OriginalsMultipart.fromEnv() : deps.storage;
  if (!storage) throw new AppError("Magazyn R2 na oryginały nie jest skonfigurowany.", 503, "R2_NOT_CONFIGURED");
  return storage;
}

/** Keeps only a harmless display name: no path, no control characters, bounded length. */
export function sanitizeFileName(name: string | undefined): string | null {
  if (!name) return null;
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return clean ? clean.slice(0, 200) : null;
}

async function loadUploadingOriginal(videoId: string, originalId: string, ctx: AppContext): Promise<VideoOriginal> {
  const original = await ctx.prisma.videoOriginal.findFirst({ where: { id: originalId, videoId } });
  if (!original) throw new AppError("Upload nie istnieje.", 404, "ORIGINAL_NOT_FOUND");
  return original;
}

async function lockOriginalCompletion(tx: WriteTx, videoId: string): Promise<void> {
  await tx.$queryRaw`SELECT 'locked'::text FROM (SELECT pg_advisory_xact_lock(hashtext(${`original-complete:${videoId}`}))) AS completion_lock`;
}

async function activeOriginalVersion(tx: WriteTx, videoId: string): Promise<number> {
  const video = await tx.video.findFirst({ where: { id: videoId }, select: { activeOriginalId: true } });
  if (!video?.activeOriginalId) return 0;
  const active = await tx.videoOriginal.findFirst({ where: { id: video.activeOriginalId, videoId }, select: { version: true } });
  return active?.version ?? 0;
}

async function latestReadyVersion(tx: WriteTx, videoId: string): Promise<number> {
  const latest = await tx.videoOriginal.findFirst({ where: { videoId, status: "READY" }, orderBy: { version: "desc" }, select: { version: true } });
  return latest?.version ?? 0;
}

async function enqueueWithinTransaction(videoId: string, originalId: string, ctx: AppContext, tx: WriteTx): Promise<EncodeJobDto> {
  const queued = await enqueueEncode({ videoId, originalId }, { ...ctx, prisma: tx });
  if (!queued.ok) throw queued.error;
  return queued.data;
}

function requireOpenUpload(original: VideoOriginal): asserts original is VideoOriginal & { uploadId: string; uploadPartCount: number; uploadPartSize: number } {
  if (original.status !== "UPLOADING" || !original.uploadId || !original.uploadPartCount || !original.uploadPartSize) {
    throw new AppError("Ten upload nie jest otwarty (zakończony, przerwany albo odrzucony).", 409, "UPLOAD_NOT_OPEN");
  }
}

function asFailure(error: unknown): AppError {
  if (error instanceof AppError) return error;
  throw error;
}

export interface StartedUpload {
  originalId: string;
  version: number;
  partSize: number;
  partCount: number;
  fileSize: number;
}

/** Opens a multipart upload for a video. Replaces earlier unfinished uploads of the same video. */
export async function startOriginalUpload(input: { videoId: string } & UploadRequest, ctx: AppContext, deps?: UploadDeps): Promise<UseCaseResult<StartedUpload, AppError>> {
  try {
    const checked = validateUploadRequest(input, deps?.maxBytes ?? maxUploadBytes());
    if (!checked.ok) return fail(new AppError(checked.message, 400, checked.code));
    const storage = storageOrFail(deps);
    const video = await requireVideo(input.videoId, ctx, "video.upload");
    const channel = await MainChannelService.getRequired(ctx);
    const limited = await channelUploadLimitError(ctx, channel, checked.value.fileSize);
    if (limited) return fail(limited);

    const active = await ctx.prisma.videoEncodeJob.findFirst({ where: { videoId: video.id, status: { in: ["QUEUED", "RUNNING"] } }, select: { id: true } });
    if (active) return fail(new AppError("Dla tego filmu trwa kodowanie. Poczekaj na koniec albo je anuluj.", 409, "ENCODE_ALREADY_ACTIVE"));

    const { fileSize, extension, contentType } = checked.value;
    const { partSize, partCount } = planParts(fileSize);
    const objectKey = originalObjectKey(video.id, (deps?.now ?? Date.now)(), extension);
    const uploadId = await storage.create(objectKey, contentType);

    // Limit check, abandoning of earlier uploads and the new row are one transaction under a per-channel lock
    // (S13/DB-05): parallel starts for different videos of one channel queue up and each sees the rows of the
    // previous one, so the daily/queue/storage limits cannot be passed by racing requests. The check above stays
    // as the cheap early refusal. R2 calls stay outside the transaction.
    let original: VideoOriginal;
    let abandoned: VideoOriginal[] = [];
    try {
      const reserved = await ctx.db.writeTransaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`upload-start:${channel.id}`}))`;
        const refused = await channelUploadLimitError({ ...ctx, prisma: tx } as AppContext, channel, checked.value.fileSize);
        if (refused) throw refused;

        // An unfinished earlier upload of this video is abandoned (its multipart upload is aborted below so R2 frees the parts).
        const stale = await tx.videoOriginal.findMany({ where: { videoId: video.id, status: "UPLOADING" } });
        for (const old of stale) {
          await tx.videoOriginal.update({ where: { id: old.id }, data: { status: "ABANDONED", failureReason: "Zastąpiony nowym uploadem." } });
        }
        const latest = await tx.videoOriginal.findFirst({ where: { videoId: video.id }, orderBy: { version: "desc" }, select: { version: true } });
        const created = await tx.videoOriginal.create({
          data: {
            videoId: video.id,
            version: (latest?.version ?? 0) + 1,
            bucket: storage.bucket,
            objectKey,
            originalFileName: sanitizeFileName(input.fileName),
            mimeType: contentType,
            sizeBytes: BigInt(fileSize),
            status: "UPLOADING",
            uploadId,
            uploadPartSize: partSize,
            uploadPartCount: partCount,
            uploadStartedAt: new Date(),
          },
        });
        return { created, stale };
      });
      original = reserved.created;
      abandoned = reserved.stale;
    } catch (error) {
      await storage.abort(objectKey, uploadId).catch(() => undefined);
      throw error;
    }
    for (const old of abandoned) {
      if (old.uploadId) await storage.abort(old.objectKey, old.uploadId).catch(() => undefined);
    }

    await recordAuditEvent(ctx, {
      action: "VIDEO_ORIGINAL_UPLOAD_PROVISIONED",
      targetType: "Video",
      targetId: video.id,
      metadata: { originalId: original.id, bucket: storage.bucket, sizeBytes: fileSize, partCount, extension },
    });
    return ok({ originalId: original.id, version: original.version, partSize, partCount, fileSize });
  } catch (error) {
    return fail(asFailure(error));
  }
}

/** Presigned PUT URLs for some parts (the browser asks in batches, so URLs stay fresh on long uploads). */
export async function presignOriginalParts(
  input: { videoId: string; originalId: string; partNumbers: number[] },
  ctx: AppContext,
  deps?: UploadDeps,
): Promise<UseCaseResult<{ urls: Array<{ partNumber: number; url: string }>; expiresAt: string }, AppError>> {
  try {
    const storage = storageOrFail(deps);
    await requireVideo(input.videoId, ctx, "video.upload");
    const original = await loadUploadingOriginal(input.videoId, input.originalId, ctx);
    requireOpenUpload(original);
    if (!isValidPartNumbers(input.partNumbers, original.uploadPartCount)) {
      return fail(new AppError(`Numery części muszą mieścić się w 1..${original.uploadPartCount} (najwyżej ${MAX_PARTS_PER_PRESIGN} naraz).`, 400, "UPLOAD_BAD_PARTS"));
    }
    const urls = await Promise.all(
      [...new Set(input.partNumbers)].map(async (partNumber) => ({
        partNumber,
        url: await storage.presignPart(original.objectKey, original.uploadId, partNumber, PART_URL_TTL_SECONDS),
      })),
    );
    return ok({ urls, expiresAt: new Date((deps?.now ?? Date.now)() + PART_URL_TTL_SECONDS * 1000).toISOString() });
  } catch (error) {
    return fail(asFailure(error));
  }
}

/** For resuming: which parts R2 already has. */
export async function listOriginalParts(
  input: { videoId: string; originalId: string },
  ctx: AppContext,
  deps?: UploadDeps,
): Promise<UseCaseResult<{ parts: UploadedPart[]; partSize: number; partCount: number }, AppError>> {
  try {
    const storage = storageOrFail(deps);
    await requireVideo(input.videoId, ctx, "video.upload");
    const original = await loadUploadingOriginal(input.videoId, input.originalId, ctx);
    requireOpenUpload(original);
    const parts = await storage.listParts(original.objectKey, original.uploadId);
    return ok({ parts, partSize: original.uploadPartSize, partCount: original.uploadPartCount });
  } catch (error) {
    return fail(asFailure(error));
  }
}

export interface CompletedUpload {
  originalId: string;
  job: EncodeJobDto;
}

/**
 * Finishes the multipart upload, verifies what actually landed in R2 (declared size, size cap, magic
 * bytes) and only then marks the original READY and queues encoding. A file that fails verification
 * is deleted from R2 and the original is marked FAILED with the reason.
 */
export async function completeOriginalMultipart(
  input: { videoId: string; originalId: string; parts: Array<{ partNumber: number; etag: string }>; publishAfterReady?: boolean },
  ctx: AppContext,
  deps?: UploadDeps,
): Promise<UseCaseResult<CompletedUpload, AppError>> {
  try {
    const storage = storageOrFail(deps);
    const video = await requireVideo(input.videoId, ctx, "video.upload");
    const original = await loadUploadingOriginal(video.id, input.originalId, ctx);

    // Retried "complete" after success: repair a historical READY -> enqueue gap, but never
    // let a stale read reactivate an original that a newer version has already superseded.
    if (original.status === "READY") {
      const recovered = await ctx.db.writeTransaction(async (tx) => {
        await lockOriginalCompletion(tx, video.id);
        const current = await tx.videoOriginal.findFirst({ where: { id: original.id, videoId: video.id } });
        if (!current || current.status !== "READY") return null;

        const [activeVersion, newestReadyVersion, currentVideo] = await Promise.all([
          activeOriginalVersion(tx, video.id),
          latestReadyVersion(tx, video.id),
          tx.video.findFirst({ where: { id: video.id }, select: { activeOriginalId: true } }),
        ]);
        const newerVersion = Math.max(activeVersion, newestReadyVersion);
        if (current.version < newerVersion) {
          await tx.videoOriginal.updateMany({
            where: { id: current.id, status: "READY" },
            data: { status: "SUPERSEDED", supersededAt: ctx.now() },
          });
          return null;
        }

        if (currentVideo?.activeOriginalId !== current.id) {
          await tx.videoOriginal.updateMany({
            where: { videoId: video.id, status: "READY", version: { lt: current.version } },
            data: { status: "SUPERSEDED", supersededAt: ctx.now() },
          });
          const pointer = await tx.video.updateMany({
            where: { id: video.id, activeOriginalId: currentVideo?.activeOriginalId ?? null },
            data: { activeOriginalId: current.id },
          });
          if (pointer.count !== 1) throw new AppError("Aktywny plik zmienił się podczas odzyskiwania uploadu.", 409, "UPLOAD_SUPERSEDED");
        }
        return enqueueWithinTransaction(video.id, current.id, ctx, tx);
      });
      if (!recovered) return fail(new AppError("Nowsza wersja pliku zastąpiła ten upload.", 409, "UPLOAD_SUPERSEDED"));
      return ok({ originalId: original.id, job: recovered });
    }

    requireOpenUpload(original);
    const numbers = input.parts.map((p) => p.partNumber);
    const unique = new Set(numbers);
    if (input.parts.length !== original.uploadPartCount || unique.size !== numbers.length || !numbers.every((n) => n >= 1 && n <= original.uploadPartCount) || input.parts.some((p) => !p.etag.trim())) {
      return fail(new AppError("Lista części jest niekompletna albo niepoprawna.", 400, "UPLOAD_BAD_PARTS"));
    }

    try {
      await storage.complete(original.objectKey, original.uploadId, input.parts.map((p) => ({ partNumber: p.partNumber, etag: p.etag })));
    } catch (error) {
      // A retried "complete" (the first one succeeded in R2 but the answer was lost) finds no open upload;
      // the object may already be there, so continue to the verification below instead of failing.
      const name = (error as { name?: string })?.name;
      if (name === "InvalidPart" || name === "InvalidPartOrder" || name === "EntityTooSmall") {
        return fail(new AppError("Nie wszystkie części zostały poprawnie wgrane. Wznów upload.", 409, "UPLOAD_PARTS_INCOMPLETE"));
      }
      if (name !== "NoSuchUpload") throw error;
    }

    const reject = async (code: string, message: string) => {
      await storage.deleteObject(original.objectKey).catch(() => undefined);
      await ctx.prisma.videoOriginal.update({ where: { id: original.id }, data: { status: "FAILED", failureReason: message, uploadId: null } });
      await recordAuditEventSafe(ctx, { action: "VIDEO_ORIGINAL_UPLOAD_REJECTED", targetType: "Video", targetId: video.id, metadata: { originalId: original.id, code } });
      return fail(new AppError(message, 422, code));
    };

    const head = await storage.head(original.objectKey);
    const limit = deps?.maxBytes ?? maxUploadBytes();
    if (!head.exists || head.sizeBytes === null) return reject("UPLOAD_MISSING", "Plik nie pojawił się w magazynie po zakończeniu uploadu.");
    if (head.sizeBytes > limit) return reject("UPLOAD_TOO_LARGE", "Wgrany plik przekracza dozwolony rozmiar.");
    if (original.sizeBytes !== null && BigInt(head.sizeBytes) !== original.sizeBytes) return reject("UPLOAD_SIZE_MISMATCH", "Rozmiar wgranego pliku nie zgadza się z zadeklarowanym.");

    const container = sniffVideoContainer(await storage.readHead(original.objectKey, SNIFF_BYTES));
    if (!container) return reject("UPLOAD_BAD_CONTENT", "Zawartość pliku nie jest rozpoznanym formatem wideo.");

    // One transaction (DB-06): READY of the new file is a compare-and-set from UPLOADING (a concurrent abort or a
    // newer start that abandoned this row wins and is never silently reverted), and the previous READY files and
    // the active pointer move with it, so a crash cannot leave half of the switch.
    const now = new Date();
    const verifiedSize = BigInt(head.sizeBytes);
    const promoted = await ctx.db.writeTransaction(async (tx) => {
      await lockOriginalCompletion(tx, video.id);
      const current = await tx.videoOriginal.findFirst({ where: { id: original.id, videoId: video.id } });
      if (!current || current.status !== "UPLOADING") return null;

      const [activeVersion, newestReadyVersion] = await Promise.all([
        activeOriginalVersion(tx, video.id),
        latestReadyVersion(tx, video.id),
      ]);
      if (Math.max(activeVersion, newestReadyVersion) >= current.version) {
        await tx.videoOriginal.updateMany({
          where: { id: current.id, status: "UPLOADING" },
          data: { status: "SUPERSEDED", supersededAt: now, uploadId: null },
        });
        return { kind: "superseded" as const };
      }

      const cas = await tx.videoOriginal.updateMany({
        where: { id: current.id, status: "UPLOADING", version: current.version },
        data: { status: "READY", uploadCompletedAt: now, verifiedAt: now, uploadId: null, sizeBytes: verifiedSize, mimeType: mimeForContainer(container), failureReason: null },
      });
      if (cas.count === 0) return null;
      await tx.videoOriginal.updateMany({ where: { videoId: video.id, status: "READY", version: { lt: current.version } }, data: { status: "SUPERSEDED", supersededAt: now } });
      await tx.video.update({ where: { id: video.id }, data: { activeOriginalId: original.id } });
      const job = await enqueueWithinTransaction(video.id, original.id, ctx, tx);
      return { kind: "promoted" as const, job };
    });
    if (!promoted) {
      // Two Studio tabs may submit complete for the same upload at once. Both can read UPLOADING
      // before either calls R2; one completes the multipart upload and promotes it, while R2
      // answers NoSuchUpload to the other. If that second request then loses the DB lock, return
      // the already-created job only when this exact original is still the latest active version.
      // A genuinely stale completion must never revive an older original.
      const replayed = await ctx.db.writeTransaction(async (tx) => {
        await lockOriginalCompletion(tx, video.id);
        const current = await tx.videoOriginal.findFirst({ where: { id: original.id, videoId: video.id } });
        if (!current || current.status !== "READY") return null;
        const [latestVersion, currentVideo] = await Promise.all([
          latestReadyVersion(tx, video.id),
          tx.video.findFirst({ where: { id: video.id }, select: { activeOriginalId: true } }),
        ]);
        if (current.version !== latestVersion || currentVideo?.activeOriginalId !== current.id) return null;
        return enqueueWithinTransaction(video.id, current.id, ctx, tx);
      });
      if (replayed) return ok({ originalId: original.id, job: replayed });
      return fail(new AppError("Ten upload nie jest otwarty (zakończony, przerwany albo odrzucony).", 409, "UPLOAD_NOT_OPEN"));
    }
    if (promoted.kind === "superseded") {
      await storage.deleteObject(original.objectKey).catch(() => undefined);
      return fail(new AppError("Nowsza wersja pliku zastąpiła ten upload.", 409, "UPLOAD_SUPERSEDED"));
    }
    if (input.publishAfterReady) await requestPublishAfterAssetReady(video.id, ctx);

    await recordAuditEvent(ctx, {
      action: "VIDEO_ORIGINAL_UPLOAD_COMPLETED",
      targetType: "Video",
      targetId: video.id,
      metadata: { originalId: original.id, sizeBytes: head.sizeBytes, container, jobId: promoted.job.id, publishAfterReady: Boolean(input.publishAfterReady) },
    });
    return ok({ originalId: original.id, job: promoted.job });
  } catch (error) {
    return fail(asFailure(error));
  }
}

/** Cancels an unfinished upload: aborts the multipart upload (R2 drops the parts) and abandons the row. */
/** R2 aborts an unfinished multipart upload after 7 days; our row is closed at the same age. */
export const STALE_UPLOAD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Cron: closes uploads left UPLOADING (browser closed, admin never came back). Aborts the R2
 * multipart upload (frees the stored parts at once; an already expired one is fine) and marks
 * the row ABANDONED, so the panel stops showing "UPLOADING" forever. `dryRun` only counts.
 */
export async function abandonStaleOriginalUploads(
  input: { dryRun?: boolean },
  ctx: AppContext,
  deps?: UploadDeps,
): Promise<UseCaseResult<{ found: number; abandoned: number; abortFailures: number }, AppError>> {
  try {
    const now = deps?.now ? deps.now() : Date.now();
    const cutoff = new Date(now - STALE_UPLOAD_MS);
    const stale = await ctx.prisma.videoOriginal.findMany({
      where: { status: "UPLOADING", OR: [{ uploadStartedAt: { lt: cutoff } }, { uploadStartedAt: null, createdAt: { lt: cutoff } }] },
      select: { id: true, videoId: true, objectKey: true, uploadId: true },
      take: 200,
    });
    if (input.dryRun || stale.length === 0) return ok({ found: stale.length, abandoned: 0, abortFailures: 0 });

    const storage = storageOrFail(deps);
    let abandoned = 0;
    let abortFailures = 0;
    for (const original of stale) {
      if (original.uploadId) {
        // NoSuchUpload (R2 already expired it) is the normal case here; any other failure is
        // counted, and the row is still closed: the bucket lifecycle rule removes the parts.
        await storage.abort(original.objectKey, original.uploadId).catch((error: unknown) => {
          if (!/NoSuchUpload/i.test(String((error as { name?: string })?.name ?? error))) abortFailures += 1;
        });
      }
      const r = await ctx.prisma.videoOriginal.updateMany({
        where: { id: original.id, status: "UPLOADING" },
        data: { status: "ABANDONED", failureReason: "Upload nie został dokończony w ciągu 7 dni.", uploadId: null },
      });
      abandoned += r.count;
    }
    if (abandoned > 0) await recordAuditEventSafe(ctx, { action: "VIDEO_ORIGINAL_UPLOADS_ABANDONED", targetType: "VideoOriginal", targetId: "stale", metadata: { abandoned, abortFailures } });
    return ok({ found: stale.length, abandoned, abortFailures });
  } catch (error) {
    return fail(asFailure(error));
  }
}

export async function abortOriginalUpload(input: { videoId: string; originalId: string }, ctx: AppContext, deps?: UploadDeps): Promise<UseCaseResult<{ originalId: string }, AppError>> {
  try {
    const storage = storageOrFail(deps);
    const video = await requireVideo(input.videoId, ctx, "video.upload");
    const original = await loadUploadingOriginal(video.id, input.originalId, ctx);
    if (original.status !== "UPLOADING") return fail(new AppError("Ten upload nie jest już w toku.", 409, "UPLOAD_NOT_OPEN"));
    if (original.uploadId) {
      await storage.abort(original.objectKey, original.uploadId).catch((error: unknown) => {
        const name = (error as { name?: string })?.name;
        if (name !== "NoSuchUpload") throw error;
      });
    }
    const closed = await ctx.prisma.videoOriginal.updateMany({
      where: { id: original.id, videoId: video.id, status: "UPLOADING" },
      data: { status: "ABANDONED", failureReason: "Przerwany przez admina.", uploadId: null },
    });
    if (closed.count !== 1) return fail(new AppError("Ten upload został już zakończony albo zastąpiony.", 409, "UPLOAD_NOT_OPEN"));
    await recordAuditEvent(ctx, { action: "VIDEO_ORIGINAL_UPLOAD_ABORTED", targetType: "Video", targetId: video.id, metadata: { originalId: original.id } });
    return ok({ originalId: original.id });
  } catch (error) {
    return fail(asFailure(error));
  }
}
