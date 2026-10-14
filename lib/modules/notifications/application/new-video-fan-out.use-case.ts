import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isUpcomingPremiere } from "@/lib/premiere";
import { applyNewVideoTemplate, buildNewVideoCopy, newVideoHref, newVideoLockKey } from "../domain/new-video";

/**
 * NEW_VIDEO fan-out (CLAUDE.md 4.18): when a video becomes publicly available as PUBLISHED, the
 * followers of its channel get an in-app notification.
 *
 * Rules:
 * - Runs AFTER the publication committed, never inside its transaction; `notifyNewVideoPublished`
 *   swallows every error, so a failing notification can never undo or fail a publication.
 * - Only PUBLISHED without an upcoming premiere. UNLISTED, DRAFT, ARCHIVED and scheduled premieres
 *   are skipped (a premiere is not announced when it starts yet: no trigger exists for that).
 * - Audience: `Subscription.notify = true` and `NotificationPreference.newVideoInApp` (no row = on).
 *   The channel owner is not notified of their own video. Written with `createMany` in chunks.
 * - Idempotent per (user, video): rows of kind NEW_VIDEO for the video are read under an advisory
 *   lock and skipped, so a repeated call writes nothing.
 */

const CHUNK = 1000;

export type NewVideoFanOutResult =
  | { status: "skipped"; reason: "NOT_FOUND" | "NOT_PUBLISHED" | "UPCOMING_PREMIERE" | "NOT_VISIBLE" }
  | { status: "done"; inApp: number }
  | { status: "error" };

export type NewVideoFanOutDeps = {
  db?: PrismaClient;
  now?: () => Date;
};

/** Moderation states that may be announced; LIMITED and REMOVED videos are not promoted. */
const ANNOUNCEABLE_MODERATION = ["VISIBLE", "AGE_RESTRICTED"] as const;

export async function fanOutNewVideo(videoId: string, deps: NewVideoFanOutDeps = {}): Promise<NewVideoFanOutResult> {
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();

  const video = await db.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      title: true,
      titleEn: true,
      slug: true,
      status: true,
      premiereAt: true,
      publishedAt: true,
      moderationStatus: true,
      creatorId: true,
      creator: { select: { id: true, name: true, userId: true, status: true, deletedAt: true } },
    },
  });
  if (!video) return { status: "skipped", reason: "NOT_FOUND" };
  if (video.status !== "PUBLISHED") return { status: "skipped", reason: "NOT_PUBLISHED" };
  // A scheduled premiere is not announced (left for a later step).
  if (isUpcomingPremiere({ status: video.status, premiereAt: video.premiereAt }, now)) {
    return { status: "skipped", reason: "UPCOMING_PREMIERE" };
  }
  const channel = video.creator;
  const channelPublic = Boolean(channel) && !channel.deletedAt && (channel.status === "ACTIVE" || channel.status === "LIMITED");
  const notDue = Boolean(video.publishedAt) && video.publishedAt!.getTime() > now.getTime();
  if (notDue || !channelPublic || !(ANNOUNCEABLE_MODERATION as readonly string[]).includes(video.moderationStatus)) {
    return { status: "skipped", reason: "NOT_VISIBLE" };
  }

  const input = { channelName: channel.name, title: video.title, titleEn: video.titleEn };
  const override = await db.notificationTemplate.findUnique({ where: { kind: "NEW_VIDEO" } });
  const copy = applyNewVideoTemplate(override, buildNewVideoCopy(input), input);
  const href = newVideoHref(video.slug);

  // One set query for the audience (never one query per follower).
  const subscribers = await db.subscription.findMany({
    where: {
      creatorId: channel.id,
      notify: true,
      userId: { not: channel.userId },
      user: {
        isDeleted: false,
        OR: [{ notificationPreference: { is: null } }, { notificationPreference: { is: { newVideoInApp: true } } }],
      },
    },
    select: { userId: true },
  });

  let inApp = 0;
  if (subscribers.length > 0) {
    inApp = await db.$transaction(async (tx) => {
      // Two fan-outs of one video wait for each other, so the "already notified" read below
      // cannot be stale: there is no unique index on (user, video).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${newVideoLockKey(video.id)}))`;
      const already = await tx.notification.findMany({
        where: { kind: "NEW_VIDEO", videoId: video.id },
        select: { userId: true },
      });
      const notified = new Set(already.map((n) => n.userId));
      const fresh = [...new Set(subscribers.map((s) => s.userId))].filter((userId) => !notified.has(userId));
      for (let i = 0; i < fresh.length; i += CHUNK) {
        await tx.notification.createMany({
          data: fresh.slice(i, i + CHUNK).map((userId) => ({
            userId,
            kind: "NEW_VIDEO" as const,
            titlePl: copy.titlePl,
            titleEn: copy.titleEn,
            bodyPl: copy.bodyPl,
            bodyEn: copy.bodyEn,
            href,
            channelId: channel.id,
            videoId: video.id,
          })),
        });
      }
      return fresh.length;
    });
  }

  return { status: "done", inApp };
}

/**
 * The entry point for publication code: never throws. A failure is logged only.
 */
export async function notifyNewVideoPublished(videoId: string, deps: NewVideoFanOutDeps = {}): Promise<NewVideoFanOutResult> {
  try {
    return await fanOutNewVideo(videoId, deps);
  } catch (error) {
    logger.error("[notifications] new-video fan-out failed", { videoId, error: error instanceof Error ? error.message : String(error) });
    return { status: "error" };
  }
}
