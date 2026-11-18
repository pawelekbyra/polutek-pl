import { VideoAssetProcessingState, type Prisma, type PrismaClient } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { recordAuditEvent } from "@/lib/modules/audit";
import { createScopedLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { DurableJobRepository } from "@/lib/modules/shared/durable-job.repository";
import { createAppContext } from "@/lib/modules/shared/app-context";
import type { JobHandler } from "@/lib/modules/shared/durable-job";
import { isHlsAssetKey } from "../domain/keys";
import { parseVersionNumber } from "../domain/encode-job.state";
import { HlsWriter, hlsBucketName, makeR2Client, readR2Credentials } from "../infrastructure/r2-storage";
import { OriginalsMultipart } from "../infrastructure/r2-multipart";
import { requireVideo } from "./video-guard";

const logger = createScopedLogger("VideoPipelineCleanup");

export type HlsDeleter = Pick<HlsWriter, "deletePrefix">;
export const VIDEO_ASSET_CLEANUP_KIND = "VIDEO_ASSET_CLEANUP" as const;

type VideoAssetCleanupPayload = { videoId: string; assetId: string; objectKey: string };

function defaultHlsWriter(): HlsWriter | null {
  const credentials = readR2Credentials();
  return credentials ? new HlsWriter(makeR2Client(credentials, { testEndpoint: process.env.VIDEO_WORKER_TEST_S3_ENDPOINT }), hlsBucketName()) : null;
}

/**
 * Reserves one own-HLS output for durable cleanup. Route deactivation, cleanupPendingAt, audit and queue insert are
 * atomic. An active asset of a PUBLISHED/UNLISTED video is protected; an active DRAFT asset is detached atomically.
 */
export async function deleteSelfHlsAsset(
  input: { videoId: string; assetId: string },
  ctx: AppContext,
  deps?: { hls?: HlsDeleter | null },
): Promise<UseCaseResult<{ queued: true }, AppError>> {
  try {
    const video = await requireVideo(input.videoId, ctx);
    const hls = deps?.hls === undefined ? defaultHlsWriter() : deps.hls;
    if (!hls) return fail(new AppError("Magazyn R2 HLS nie jest skonfigurowany.", 503, "R2_NOT_CONFIGURED"));
    await ctx.db.writeTransaction(async (tx) => {
      // Route activation takes this lock first too. Do not move this check outside the transaction.
      const videos = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Video" WHERE "id" = ${video.id} FOR UPDATE`;
      if (videos.length !== 1) throw new AppError("Film nie istnieje.", 404, "VIDEO_NOT_FOUND");
      const freshVideo = await tx.video.findFirst({
        where: { id: video.id, creatorId: video.creatorId },
        select: { id: true, status: true, activePlaybackRouteId: true },
      });
      if (!freshVideo) throw new AppError("Film nie istnieje.", 404, "VIDEO_NOT_FOUND");
      const asset = await tx.videoAsset.findFirst({ where: { id: input.assetId, videoId: video.id, provider: "SELF_HLS" } });
      if (!asset) throw new AppError("Wynik kodowania nie istnieje.", 404, "ASSET_NOT_FOUND");
      const version = parseVersionNumber(asset.objectKey);
      if (!version || !isHlsAssetKey(video.id, asset.objectKey)) throw new AppError("Niepoprawny klucz wyniku.", 409, "ASSET_KEY_INVALID");

      const active = await tx.videoPlaybackRoute.findFirst({ where: { videoId: video.id, assetId: asset.id, status: "ACTIVE" }, select: { id: true } });
      if (active && (freshVideo.status === "PUBLISHED" || freshVideo.status === "UNLISTED")) {
        throw new AppError("Ta wersja gra opublikowany film. Cofnij publikację albo zakoduj film ponownie.", 409, "ASSET_IN_USE");
      }
      if (!asset.cleanupPendingAt && asset.processingState !== VideoAssetProcessingState.READY) {
        throw new AppError("Wynik nie jest gotowy do usunięcia.", 409, "ASSET_NOT_READY");
      }

      if (!asset.cleanupPendingAt && active) {
        await tx.videoPlaybackRoute.update({
          where: { id: active.id },
          data: { status: "DISABLED", deactivatedAt: new Date(), activationReason: "HLS asset cleanup reserved" },
        });
        await tx.video.updateMany({ where: { id: video.id, activePlaybackRouteId: active.id }, data: { activePlaybackRouteId: null } });
      }
      if (!asset.cleanupPendingAt) {
        const reserved = await tx.videoAsset.updateMany({
          where: { id: asset.id, videoId: video.id, processingState: VideoAssetProcessingState.READY, cleanupPendingAt: null },
          data: { processingState: VideoAssetProcessingState.PROCESSING, cleanupPendingAt: new Date(), isPrimary: false },
        });
        if (reserved.count !== 1) throw new AppError("Wynik zmienił stan podczas rezerwacji cleanupu.", 409, "ASSET_STATE_CHANGED");
      }

      const payload: VideoAssetCleanupPayload = { videoId: video.id, assetId: asset.id, objectKey: asset.objectKey };
      await new DurableJobRepository(tx as unknown as PrismaClient).enqueue({
        kind: VIDEO_ASSET_CLEANUP_KIND,
        dedupeKey: asset.id,
        payload,
        reopen: ["DEAD", "DONE"],
      }, tx);
      await recordAuditEvent(ctx, {
        action: "VIDEO_SELF_HLS_ASSET_DELETION_QUEUED",
        targetType: "Video",
        targetId: video.id,
        metadata: { assetId: asset.id, objectKey: asset.objectKey },
      }, tx);
    });
    return ok({ queued: true });
  } catch (error) {
    if (error instanceof AppError) return fail(error);
    throw error;
  }
}

function parseVideoAssetCleanupPayload(value: unknown): VideoAssetCleanupPayload {
  const payload = value as Partial<VideoAssetCleanupPayload> | null;
  if (!payload || typeof payload.videoId !== "string" || typeof payload.assetId !== "string" || typeof payload.objectKey !== "string") {
    throw new Error("Invalid HLS asset cleanup payload");
  }
  if (!parseVersionNumber(payload.objectKey) || !isHlsAssetKey(payload.videoId, payload.objectKey)) {
    throw new Error("Invalid HLS asset cleanup key");
  }
  return payload as VideoAssetCleanupPayload;
}

export function createVideoAssetCleanupHandler(deps: { db?: PrismaClient; hls?: HlsDeleter | null } = {}): JobHandler<Prisma.TransactionClient> {
  const db = deps.db ?? prisma;
  const hls = deps.hls === undefined ? defaultHlsWriter() : deps.hls;
  return async ({ job }) => {
    if (job.kind !== VIDEO_ASSET_CLEANUP_KIND || job.dedupeKey.length === 0) throw new Error("Invalid HLS asset cleanup job");
    const payload = parseVideoAssetCleanupPayload(job.payload);
    if (job.dedupeKey !== payload.assetId) throw new Error("HLS asset cleanup dedupe key mismatch");
    if (!hls) throw new Error("R2 HLS storage not configured");

    await hls.deletePrefix(`${payload.objectKey}/`);
    const ctx = createAppContext({ prisma: db, actor: { type: "system", reason: "video_hls_asset_cleanup" } });
    await db.$transaction(async (tx) => {
      const asset = await tx.videoAsset.findFirst({
        where: { id: payload.assetId, videoId: payload.videoId, provider: "SELF_HLS", objectKey: payload.objectKey },
        select: { id: true, processingState: true, cleanupPendingAt: true },
      });
      if (!asset) return; // already finalized by an earlier run or cascaded with video deletion
      if (!asset.cleanupPendingAt) {
        throw new Error(`HLS asset ${asset.id} is no longer reserved for cleanup`);
      }
      await tx.videoAsset.delete({ where: { id: asset.id } });
      await recordAuditEvent(ctx, {
        action: "VIDEO_SELF_HLS_ASSET_DELETED",
        targetType: "Video",
        targetId: payload.videoId,
        metadata: { assetId: payload.assetId, objectKey: payload.objectKey },
      }, tx);
    });
    return "done";
  };
}

export interface VideoStorageSnapshot {
  assetKeys: string[];
  originals: Array<{ objectKey: string; uploadId: string | null; status: string }>;
}

/** Reads what the video owns in R2. Take it BEFORE deleting the video (the DB cascade removes the rows). */
export async function snapshotVideoStorage(videoId: string, ctx: AppContext): Promise<VideoStorageSnapshot> {
  const [assets, originals] = await Promise.all([
    ctx.prisma.videoAsset.findMany({ where: { videoId, provider: "SELF_HLS" }, select: { objectKey: true } }),
    ctx.prisma.videoOriginal.findMany({ where: { videoId }, select: { objectKey: true, uploadId: true, status: true } }),
  ]);
  return { assetKeys: assets.map((a) => a.objectKey), originals };
}

/**
 * Best-effort removal of a deleted video's own HLS outputs and original uploads from R2.
 * Never throws: a failed delete leaves orphans that ops can remove (listed in the audit/logs).
 */
export async function purgeVideoStorage(
  videoId: string,
  snapshot: VideoStorageSnapshot,
  deps?: { hls?: HlsDeleter | null; originals?: Pick<OriginalsMultipart, "deleteObject" | "abort"> | null },
): Promise<{ hlsObjects: number; originals: number }> {
  const result = { hlsObjects: 0, originals: 0 };
  try {
    const hls = deps?.hls === undefined ? defaultHlsWriter() : deps.hls;
    const originals = deps?.originals === undefined ? OriginalsMultipart.fromEnv() : deps.originals;
    if (hls) {
      for (const key of snapshot.assetKeys) {
        const version = parseVersionNumber(key);
        if (version && isHlsAssetKey(videoId, key)) result.hlsObjects += await hls.deletePrefix(`${key}/`).catch(() => 0);
      }
    }
    if (originals) {
      for (const o of snapshot.originals) {
        if (!o.objectKey.startsWith(`originals/${videoId}/`)) continue;
        if (o.status === "UPLOADING" && o.uploadId) await originals.abort(o.objectKey, o.uploadId).catch(() => undefined);
        await originals.deleteObject(o.objectKey).then(() => { result.originals += 1; }).catch(() => undefined);
      }
    }
  } catch (error) {
    logger.warn("purgeVideoStorage failed (non-fatal)", { videoId, error: String(error) });
  }
  return result;
}

/**
 * Same as `snapshotVideoStorage`, but INSIDE the transaction that deletes the video (DB-24): the Video
 * row is locked first (`FOR UPDATE`), so an encode worker adding an asset at the same moment either
 * is listed here or fails its foreign key afterwards, and nothing can be created outside the manifest.
 * The caller stores the result as a durable clean-up job in the same transaction.
 */
export async function snapshotVideoStorageInTx(tx: Prisma.TransactionClient, videoId: string): Promise<VideoStorageSnapshot> {
  await tx.$executeRaw`SELECT 1 FROM "Video" WHERE "id" = ${videoId} FOR UPDATE`;
  const [assets, originals] = await Promise.all([
    tx.videoAsset.findMany({ where: { videoId, provider: "SELF_HLS" }, select: { objectKey: true } }),
    tx.videoOriginal.findMany({ where: { videoId }, select: { objectKey: true, uploadId: true, status: true } }),
  ]);
  return { assetKeys: assets.map((a) => a.objectKey), originals };
}

/**
 * Removes the objects of a deleted video's manifest and THROWS when any removal failed (or R2 is not
 * configured while the manifest is not empty), so the durable job retries. Every delete is idempotent
 * (a missing prefix/object is not an error), so a retry after a partial run is safe. Scope is exactly
 * what `purgeVideoStorage` removes: version prefixes of own HLS assets and the video's originals.
 */
export async function purgeVideoStorageStrict(
  videoId: string,
  snapshot: VideoStorageSnapshot,
  deps?: { hls?: HlsDeleter | null; originals?: Pick<OriginalsMultipart, "deleteObject" | "abort"> | null },
): Promise<{ hlsObjects: number; originals: number }> {
  const result = { hlsObjects: 0, originals: 0 };
  const hlsKeys = snapshot.assetKeys.filter((key) => {
    const version = parseVersionNumber(key);
    return Boolean(version) && isHlsAssetKey(videoId, key);
  });
  const originalsToRemove = snapshot.originals.filter((o) => o.objectKey.startsWith(`originals/${videoId}/`));
  if (hlsKeys.length === 0 && originalsToRemove.length === 0) return result;

  const hls = deps?.hls === undefined ? defaultHlsWriter() : deps.hls;
  const originals = deps?.originals === undefined ? OriginalsMultipart.fromEnv() : deps.originals;
  const failures: string[] = [];
  if (hlsKeys.length > 0 && !hls) failures.push("R2 HLS storage not configured");
  if (originalsToRemove.length > 0 && !originals) failures.push("R2 originals storage not configured");
  if (hls) {
    for (const key of hlsKeys) {
      try {
        result.hlsObjects += await hls.deletePrefix(`${key}/`);
      } catch (error) {
        failures.push(`hls ${key}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  if (originals) {
    for (const o of originalsToRemove) {
      if (o.status === "UPLOADING" && o.uploadId) await originals.abort(o.objectKey, o.uploadId).catch(() => undefined);
      try {
        await originals.deleteObject(o.objectKey);
        result.originals += 1;
      } catch (error) {
        failures.push(`original ${o.objectKey}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  if (failures.length > 0) throw new Error(`Storage clean-up of video ${videoId} incomplete: ${failures.join("; ").slice(0, 400)}`);
  return result;
}
