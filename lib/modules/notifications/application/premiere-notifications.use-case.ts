import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { enqueueNewVideoFanOut } from "./new-video-fan-out.use-case";

/**
 * Premiere notifications (CLAUDE.md 4.18): a video published with a future `premiereAt` is skipped by
 * the publish-time fan-out; this use case (run every minute by the `premiere-notifications` cron)
 * announces it once the premiere time has passed.
 *
 * - Candidates: PUBLISHED, `premiereAt <= now`, `premiereNotifiedAt` null, VISIBLE/AGE_RESTRICTED,
 *   public channel (ACTIVE/LIMITED, not deleted): the same eligibility as the publish-time fan-out.
 *   UNLISTED, DRAFT and ARCHIVED videos never qualify.
 * - Each candidate is put in the durable queue (`NEW_VIDEO_FANOUT` job, one per video, variant
 *   "premiere"); the same cron tick then runs the queue (see the route). The job, not this function,
 *   delivers the notifications and sets `premiereNotifiedAt` when the LAST page is written, so a
 *   process that dies half-way no longer leaves a video "claimed" forever: the unfinished job is
 *   taken over after its lease runs out and continues from its cursor. A candidate stays a candidate
 *   until the job finished, and enqueueing it again is a no-op while the job is pending (a finished
 *   job that skipped the video is opened again; a DEAD one is left for an operator).
 */

export const PREMIERE_BATCH_DEFAULT = 50;

export type PremiereNotificationsResult = {
  candidates: number;
  enqueued: number;
  failed: number;
};

export type PremiereNotificationsDeps = {
  db?: PrismaClient;
  now?: () => Date;
  batchSize?: number;
};

export async function notifyDuePremieres(deps: PremiereNotificationsDeps = {}): Promise<PremiereNotificationsResult> {
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  const take = Math.max(1, Math.min(deps.batchSize ?? PREMIERE_BATCH_DEFAULT, 200));

  const due = await db.video.findMany({
    where: {
      status: "PUBLISHED",
      premiereAt: { not: null, lte: now },
      premiereNotifiedAt: null,
      moderationStatus: { in: ["VISIBLE", "AGE_RESTRICTED"] },
      OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
      creator: { deletedAt: null, status: { in: ["ACTIVE", "LIMITED"] } },
    },
    orderBy: { premiereAt: "asc" },
    take,
    select: { id: true },
  });

  const result: PremiereNotificationsResult = { candidates: due.length, enqueued: 0, failed: 0 };
  for (const video of due) {
    try {
      await enqueueNewVideoFanOut(video.id, "premiere", ["DONE"], db);
      result.enqueued += 1;
    } catch (error) {
      result.failed += 1;
      logger.error("[notifications] enqueueing premiere fan-out failed", { videoId: video.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}
