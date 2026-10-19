import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { buildNewVideoParams, buildPremiereCopy, newVideoHref } from "../domain/new-video";
import { deliverNewVideoNotifications } from "./new-video-fan-out.use-case";

/**
 * Premiere notifications (CLAUDE.md 4.18): a video published with a future `premiereAt` is skipped by
 * the publish-time fan-out; this use case (run every minute by the `premiere-notifications` cron)
 * announces it once the premiere time has passed.
 *
 * - Candidates: PUBLISHED, `premiereAt <= now`, `premiereNotifiedAt` null, VISIBLE/AGE_RESTRICTED,
 *   public channel (ACTIVE/LIMITED, not deleted): the same eligibility as the publish-time fan-out.
 *   UNLISTED, DRAFT and ARCHIVED videos never qualify.
 * - Each video is CLAIMED first with `updateMany where premiereNotifiedAt is null` (the first run
 *   wins, a parallel run gets count 0 and skips), then fanned out like a new video (same audience,
 *   preference, owner exclusion, advisory lock and chunking, same NEW_VIDEO kind so per-user dedupe
 *   holds across both paths). If the delivery throws, the claim is released so the next run retries
 *   (per-user dedupe makes the retry safe).
 */

export const PREMIERE_BATCH_DEFAULT = 50;

export type PremiereNotificationsResult = {
  candidates: number;
  claimed: number;
  notifications: number;
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
    select: {
      id: true,
      title: true,
      titleEn: true,
      slug: true,
      creator: { select: { id: true, name: true, userId: true } },
    },
  });

  const result: PremiereNotificationsResult = { candidates: due.length, claimed: 0, notifications: 0, failed: 0 };
  for (const video of due) {
    // Atomic claim: exactly one concurrent run gets count 1.
    const claim = await db.video.updateMany({
      where: { id: video.id, status: "PUBLISHED", premiereNotifiedAt: null },
      data: { premiereNotifiedAt: now },
    });
    if (claim.count !== 1) continue;
    result.claimed += 1;
    try {
      const copyInput = { channelName: video.creator.name, title: video.title, titleEn: video.titleEn };
      const copy = buildPremiereCopy(copyInput);
      result.notifications += await deliverNewVideoNotifications(db, {
        videoId: video.id,
        channel: video.creator,
        copy,
        href: newVideoHref(video.slug),
        template: { key: "premiere", params: buildNewVideoParams(copyInput) },
      });
    } catch (error) {
      result.failed += 1;
      logger.error("[notifications] premiere fan-out failed", { videoId: video.id, error: error instanceof Error ? error.message : String(error) });
      try {
        await db.video.updateMany({ where: { id: video.id, premiereNotifiedAt: now }, data: { premiereNotifiedAt: null } });
      } catch (releaseError) {
        logger.error("[notifications] releasing premiere claim failed", { videoId: video.id, error: releaseError instanceof Error ? releaseError.message : String(releaseError) });
      }
    }
  }
  return result;
}
