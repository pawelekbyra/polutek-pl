import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { DurableJobRepository } from "@/lib/modules/shared/durable-job.repository";
import { runDurableJobs, type JobHandler, type RunJobsResult } from "@/lib/modules/shared/durable-job";
import { purgeVideoStorageStrict, snapshotVideoStorageInTx, type VideoStorageSnapshot } from "@/lib/modules/video-pipeline";
import { R2CaptionStorageClient, R2ThumbnailStorageClient, isCaptionKeyOf } from "@/lib/modules/media";

/**
 * Durable R2 clean-up of a deleted video (DB-24). The manifest (what the video owns in R2) is written
 * as a `STORAGE_CLEANUP` job in the SAME transaction that deletes the video, so the DB cascade can no
 * longer erase the only record of the objects. A runner (post-delete kick, minute cron) then removes
 * them; each removal is idempotent and any failure makes the job retry with backoff (DEAD after 8
 * attempts, kept for an operator), where it used to be swallowed and the objects stayed forever.
 */

export const STORAGE_CLEANUP_KIND = "STORAGE_CLEANUP" as const;

export type StorageCleanupManifest = {
  videoId: string;
  snapshot: VideoStorageSnapshot;
  /** Keys in the public thumbnails bucket (our own subtitle files), already filtered to `/subtitles/`. */
  publicKeys: string[];
  /** Keys in the private HLS bucket (the panel's caption files, `videos/<id>/captions/...`). Absent in manifests written before captions became private. */
  captionKeys?: string[];
};

/** Call inside the video delete transaction (`deleteAdminVideo`'s `beforeDelete`). Nothing is enqueued for a video that owns nothing in R2. */
export async function enqueueStorageCleanupInTx(tx: Prisma.TransactionClient, videoId: string, publicKeys: string[], captionKeys: string[] = []): Promise<void> {
  const snapshot = await snapshotVideoStorageInTx(tx, videoId);
  if (snapshot.assetKeys.length === 0 && snapshot.originals.length === 0 && publicKeys.length === 0 && captionKeys.length === 0) return;
  const manifest: StorageCleanupManifest = { videoId, snapshot, publicKeys, ...(captionKeys.length > 0 ? { captionKeys } : {}) };
  // enqueue() only touches the transaction it is given, so the repository needs no client of its own here.
  await new DurableJobRepository(tx as unknown as PrismaClient).enqueue({ kind: STORAGE_CLEANUP_KIND, dedupeKey: videoId, payload: manifest }, tx);
}

function parseManifest(payload: unknown): StorageCleanupManifest {
  const p = payload as Partial<StorageCleanupManifest> | null;
  if (!p || typeof p.videoId !== "string" || !p.snapshot || !Array.isArray(p.snapshot.assetKeys) || !Array.isArray(p.snapshot.originals)) {
    throw new Error("Invalid storage clean-up manifest");
  }
  const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((k): k is string => typeof k === "string") : []);
  return { videoId: p.videoId, snapshot: p.snapshot, publicKeys: strings(p.publicKeys), captionKeys: strings(p.captionKeys) };
}

export type StorageCleanupDeps = {
  purge?: typeof purgeVideoStorageStrict;
  publicStorage?: { isConfigured(): boolean; deletePublic(key: string): Promise<unknown> };
  captionStorage?: { isConfigured(): boolean; deleteCaption(videoId: string, key: string): Promise<unknown> };
};

export function createStorageCleanupHandler(deps: StorageCleanupDeps = {}): JobHandler<Prisma.TransactionClient> {
  const purge = deps.purge ?? purgeVideoStorageStrict;
  return async (ctx) => {
    const manifest = parseManifest(ctx.job.payload);
    await purge(manifest.videoId, manifest.snapshot);
    if (manifest.publicKeys.length > 0) {
      const storage = deps.publicStorage ?? {
        isConfigured: () => R2ThumbnailStorageClient.isPublicServingConfigured(),
        deletePublic: (key: string) => new R2ThumbnailStorageClient().deletePublic(key),
      };
      if (!storage.isConfigured()) throw new Error("Public R2 storage not configured");
      const failed: string[] = [];
      for (const key of manifest.publicKeys) {
        if (!key.includes("/subtitles/")) continue;
        await storage.deletePublic(key).catch(() => failed.push(key));
      }
      if (failed.length > 0) throw new Error(`Public clean-up failed for ${failed.length} subtitle file(s)`);
    }
    const captionKeys = (manifest.captionKeys ?? []).filter((key) => isCaptionKeyOf(manifest.videoId, key));
    if (captionKeys.length > 0) {
      const captions = deps.captionStorage ?? {
        isConfigured: () => R2CaptionStorageClient.isConfigured(),
        deleteCaption: (videoId: string, key: string) => new R2CaptionStorageClient().deleteCaption(videoId, key),
      };
      if (!captions.isConfigured()) throw new Error("Private caption storage not configured");
      const failed: string[] = [];
      for (const key of captionKeys) await captions.deleteCaption(manifest.videoId, key).catch(() => failed.push(key));
      if (failed.length > 0) throw new Error(`Caption clean-up failed for ${failed.length} file(s)`);
    }
    return "done";
  };
}

export function runStorageCleanupJobs(deps: { db?: PrismaClient; maxJobs?: number } = {}): Promise<RunJobsResult> {
  return runDurableJobs<Prisma.TransactionClient>({
    store: new DurableJobRepository(deps.db ?? prisma),
    handlers: { STORAGE_CLEANUP: createStorageCleanupHandler() },
    maxJobs: deps.maxJobs,
  });
}

/** Starts a runner right after a delete (fire and forget); if this process dies the minute cron picks the job up. */
export function kickStorageCleanup(): void {
  void runStorageCleanupJobs({ maxJobs: 1 }).catch((error) => {
    logger.error("[admin-content] storage clean-up kick failed (the cron will pick the job up)", { error: error instanceof Error ? error.message : String(error) });
  });
}
