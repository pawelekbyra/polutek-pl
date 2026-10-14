import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { recordAuditEvent } from "@/lib/modules/audit";
import { createScopedLogger } from "@/lib/logger";
import { hlsAssetKey } from "../domain/keys";
import { parseVersionNumber } from "../domain/encode-job.state";
import { HlsWriter, hlsBucketName, makeR2Client, readR2Credentials } from "../infrastructure/r2-storage";
import { OriginalsMultipart } from "../infrastructure/r2-multipart";
import { requireVideo } from "./video-guard";

const logger = createScopedLogger("VideoPipelineCleanup");

export type HlsDeleter = Pick<HlsWriter, "deletePrefix">;

function defaultHlsWriter(): HlsWriter | null {
  const credentials = readR2Credentials();
  return credentials ? new HlsWriter(makeR2Client(credentials), hlsBucketName()) : null;
}

/**
 * Deletes one own-HLS output (all objects under its version prefix + the asset row).
 * The asset that currently plays a PUBLISHED or UNLISTED video cannot be deleted: re-encode first or unpublish.
 */
export async function deleteSelfHlsAsset(
  input: { videoId: string; assetId: string },
  ctx: AppContext,
  deps?: { hls?: HlsDeleter | null },
): Promise<UseCaseResult<{ removedObjects: number }, AppError>> {
  try {
    const video = await requireVideo(input.videoId, ctx);
    const asset = await ctx.prisma.videoAsset.findFirst({ where: { id: input.assetId, videoId: video.id, provider: "SELF_HLS" } });
    if (!asset) return fail(new AppError("Wynik kodowania nie istnieje.", 404, "ASSET_NOT_FOUND"));
    const version = parseVersionNumber(asset.objectKey);
    if (!version || asset.objectKey !== hlsAssetKey(video.id, version)) return fail(new AppError("Niepoprawny klucz wyniku.", 409, "ASSET_KEY_INVALID"));

    const active = await ctx.prisma.videoPlaybackRoute.findFirst({ where: { videoId: video.id, assetId: asset.id, status: "ACTIVE" }, select: { id: true } });
    if (active && (video.status === "PUBLISHED" || video.status === "UNLISTED")) {
      return fail(new AppError("Ta wersja gra opublikowany film. Cofnij publikację albo zakoduj film ponownie.", 409, "ASSET_IN_USE"));
    }

    const hls = deps?.hls === undefined ? defaultHlsWriter() : deps.hls;
    if (!hls) return fail(new AppError("Magazyn R2 HLS nie jest skonfigurowany.", 503, "R2_NOT_CONFIGURED"));
    const removed = await hls.deletePrefix(`${asset.objectKey}/`);
    await ctx.prisma.videoAsset.delete({ where: { id: asset.id } });
    await ctx.prisma.video.updateMany({ where: { id: video.id, activePlaybackRouteId: active?.id ?? "-" }, data: { activePlaybackRouteId: null } });
    await recordAuditEvent(ctx, { action: "VIDEO_SELF_HLS_ASSET_DELETED", targetType: "Video", targetId: video.id, metadata: { assetId: asset.id, objectKey: asset.objectKey, removedObjects: removed } });
    return ok({ removedObjects: removed });
  } catch (error) {
    if (error instanceof AppError) return fail(error);
    throw error;
  }
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
        if (version && key === hlsAssetKey(videoId, version)) result.hlsObjects += await hls.deletePrefix(`${key}/`).catch(() => 0);
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
