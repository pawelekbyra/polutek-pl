import { VideoAssetProcessingState, type PrismaClient } from "@prisma/client";
import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { recordAuditEvent } from "@/lib/modules/audit";
import { createScopedLogger } from "@/lib/logger";
import { DurableJobRepository } from "@/lib/modules/shared/durable-job.repository";
import { isHlsAssetKey } from "../domain/keys";
import { parseVersionNumber } from "../domain/encode-job.state";
import { readR2Credentials } from "../infrastructure/r2-storage";
import { VIDEO_ASSET_CLEANUP_KIND } from "./output-cleanup.use-cases";

const logger = createScopedLogger("RoutelessAssetSweep");

/**
 * A READY own-HLS asset with no playback route at all is a leak (audit U5): the encode worker commits the asset first
 * and activates the route second, so an unknown activation outcome (or a crash in between) leaves an output nothing
 * plays and nothing owns. A route of ANY status (also DISABLED/SUPERSEDED) means the asset has been used, so only
 * assets that never had one qualify. The grace period is long on purpose: the cost of waiting is a few GB, the cost
 * of deleting too early is a re-encode.
 */
export const ROUTELESS_ASSET_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
/** At most this many assets are reserved per run; the next run continues (the cron is daily). */
export const ROUTELESS_ASSET_BATCH = 25;

export interface RoutelessAssetSweepResult {
  /** Candidates found in this run (before the in-transaction re-check). */
  found: number;
  /** Assets reserved for cleanup: the existing VIDEO_ASSET_CLEANUP durable job deletes the R2 prefix and the row. */
  queued: number;
  /** Candidates skipped by the re-check inside the transaction (a route/job appeared, state changed). */
  skipped: number;
  failed: number;
  /** Object keys of the candidates (dry run and live), for the operator. */
  keys: string[];
}

type SweepDeps = { now?: () => number; r2Configured?: boolean };

/**
 * Cron: finds READY SELF_HLS assets older than the grace period that never had a playback route and whose video has
 * no queued/running encode, and hands each to the regular cleanup path: reservation (`cleanupPendingAt`, the
 * route-activation trigger then refuses the asset), durable `VIDEO_ASSET_CLEANUP` job, audit. Nothing is deleted
 * here; objects and the row go when that job runs. `dryRun` only lists the candidates.
 */
export async function sweepRoutelessReadyAssets(
  input: { dryRun?: boolean },
  ctx: AppContext,
  deps: SweepDeps = {},
): Promise<UseCaseResult<RoutelessAssetSweepResult, AppError>> {
  try {
    // Daily cron only: the sweep has no per-video authorization, so it refuses every actor but the system.
    if (ctx.actor.type !== "system") return fail(new AppError("Forbidden", 403, "FORBIDDEN"));
    const cutoff = new Date((deps.now ? deps.now() : Date.now()) - ROUTELESS_ASSET_GRACE_MS);
    const candidates = await ctx.prisma.videoAsset.findMany({
      where: routelessWhere(cutoff),
      select: { id: true, videoId: true, objectKey: true },
      orderBy: { createdAt: "asc" },
      take: ROUTELESS_ASSET_BATCH,
    });
    const result: RoutelessAssetSweepResult = { found: candidates.length, queued: 0, skipped: 0, failed: 0, keys: candidates.map((c) => c.objectKey) };
    if (input.dryRun || candidates.length === 0) return ok(result);

    const r2Configured = deps.r2Configured ?? Boolean(readR2Credentials());
    if (!r2Configured) return fail(new AppError("Magazyn R2 HLS nie jest skonfigurowany.", 503, "R2_NOT_CONFIGURED"));

    for (const candidate of candidates) {
      try {
        const queued = await reserveOne(candidate, cutoff, ctx);
        if (queued) result.queued += 1;
        else result.skipped += 1;
      } catch (error) {
        result.failed += 1;
        logger.error("Could not reserve a routeless asset for cleanup", { assetId: candidate.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
    if (result.failed > 0 && result.queued === 0) return fail(new AppError("Nie udało się zarezerwować żadnego wyniku do sprzątania.", 500, "ROUTELESS_SWEEP_FAILED"));
    return ok(result);
  } catch (error) {
    if (error instanceof AppError) return fail(error);
    throw error;
  }
}

function routelessWhere(cutoff: Date) {
  return {
    provider: "SELF_HLS" as const,
    processingState: VideoAssetProcessingState.READY,
    cleanupPendingAt: null,
    createdAt: { lt: cutoff },
    playbackRoutes: { none: {} },
    video: { encodeJobs: { none: { status: { in: ["QUEUED" as const, "RUNNING" as const] } } } },
  };
}

async function reserveOne(candidate: { id: string; videoId: string; objectKey: string }, cutoff: Date, ctx: AppContext): Promise<boolean> {
  if (!parseVersionNumber(candidate.objectKey) || !isHlsAssetKey(candidate.videoId, candidate.objectKey)) {
    logger.warn("Routeless asset has an unexpected key; left for manual review", { assetId: candidate.id });
    return false;
  }
  return ctx.db.writeTransaction(async (tx) => {
    // Route activation and deleteSelfHlsAsset take this row lock first too: after it, no route can appear unseen.
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Video" WHERE "id" = ${candidate.videoId} FOR UPDATE`;
    if (locked.length !== 1) return false;
    // Same predicate as the candidate query, evaluated again under the lock.
    const still = await tx.videoAsset.findFirst({
      where: { ...routelessWhere(cutoff), id: candidate.id, videoId: candidate.videoId },
      select: { id: true, objectKey: true },
    });
    if (!still || still.objectKey !== candidate.objectKey) return false;

    const reserved = await tx.videoAsset.updateMany({
      where: { id: still.id, processingState: VideoAssetProcessingState.READY, cleanupPendingAt: null },
      data: { processingState: VideoAssetProcessingState.PROCESSING, cleanupPendingAt: new Date(), isPrimary: false },
    });
    if (reserved.count !== 1) return false;

    await new DurableJobRepository(tx as unknown as PrismaClient).enqueue({
      kind: VIDEO_ASSET_CLEANUP_KIND,
      dedupeKey: still.id,
      payload: { videoId: candidate.videoId, assetId: still.id, objectKey: still.objectKey },
      reopen: ["DEAD", "DONE"],
    }, tx);
    await recordAuditEvent(ctx, {
      action: "VIDEO_SELF_HLS_ROUTELESS_ASSET_CLEANUP_QUEUED",
      targetType: "Video",
      targetId: candidate.videoId,
      metadata: { assetId: still.id, objectKey: still.objectKey, graceDays: ROUTELESS_ASSET_GRACE_MS / 86_400_000 },
    }, tx);
    return true;
  });
}
