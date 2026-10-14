import type { ChannelStatus, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isUpcomingPremiere } from "@/lib/premiere";
import {
  NEW_VIDEO_SWEEP_SINCE_KEY,
  NEW_VIDEO_SWEEP_WINDOW_MS,
  applyNewVideoTemplate,
  buildNewVideoCopy,
  newVideoHref,
  newVideoLockKey,
  newVideoMarkerKey,
} from "../domain/new-video";

/**
 * NEW_VIDEO fan-out (CLAUDE.md 4.15, 4.18): when a video becomes publicly available, followers of its
 * channel get an in-app notification and, if they consented, a queued e-mail.
 *
 * Rules:
 * - Runs AFTER the publication committed, never inside its transaction; `notifyNewVideoPublished`
 *   swallows every error, so a failing notification can never undo or fail a publication.
 * - In-app audience: `Subscription.notify = true` and `NotificationPreference.newVideoInApp` (no row =
 *   on). The channel owner is not notified of their own video. Written with `createMany` in chunks.
 * - Idempotent per (user, video): existing NEW_VIDEO rows of the video are skipped, and a marker
 *   (`AppSetting new-video-fanout:<videoId>`, written last) makes later calls a no-op. The e-mail is
 *   idempotent by the broadcast `requestKey`.
 * - If anything fails before the marker, nothing is lost: the sweep (`notifyDuePublishedVideos`,
 *   cron notify-new-videos) retries the video while it is inside its window.
 */

const CHUNK = 1000;

export type NewVideoFanOutResult =
  | { status: "skipped"; reason: "NOT_FOUND" | "NOT_PUBLISHED" | "UPCOMING_PREMIERE" | "NOT_VISIBLE" | "ALREADY_DONE" }
  | { status: "done"; inApp: number; emailQueued: number; emailDuplicate: boolean }
  | { status: "error" };

export type QueueNewVideoEmailFn = (
  db: PrismaClient,
  input: { videoId: string; channelId: string; channelName: string; title: string; titleEn?: string | null; slug: string },
) => Promise<{ queued: number; duplicate: boolean }>;

export type NewVideoFanOutDeps = {
  db?: PrismaClient;
  now?: () => Date;
  /** Defaults to the e-mail module's `queueNewVideoEmail` (loaded lazily, see below). */
  queueEmail?: QueueNewVideoEmailFn;
};

/** Moderation states that may be announced; LIMITED and REMOVED videos are not promoted. */
const ANNOUNCEABLE_MODERATION = ["VISIBLE", "AGE_RESTRICTED"] as const;

// Same rule as `publiclyVisibleChannelWhere()` (channel module); inlined so this module keeps no
// static dependency on the channel barrel (a test pins the two together).
const PUBLIC_CHANNEL_WHERE = { status: { in: ["ACTIVE", "LIMITED"] as ChannelStatus[] }, deletedAt: null };

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
  // A scheduled premiere is announced when it starts (the sweep), not when it is scheduled.
  if (isUpcomingPremiere({ status: video.status, premiereAt: video.premiereAt }, now)) {
    return { status: "skipped", reason: "UPCOMING_PREMIERE" };
  }
  const channel = video.creator;
  const channelPublic = Boolean(channel) && !channel.deletedAt && (channel.status === "ACTIVE" || channel.status === "LIMITED");
  const notDue = Boolean(video.publishedAt) && video.publishedAt!.getTime() > now.getTime();
  if (notDue || !channelPublic || !(ANNOUNCEABLE_MODERATION as readonly string[]).includes(video.moderationStatus)) {
    return { status: "skipped", reason: "NOT_VISIBLE" };
  }

  const markerKey = newVideoMarkerKey(video.id);
  if (await db.appSetting.findUnique({ where: { key: markerKey }, select: { key: true } })) {
    return { status: "skipped", reason: "ALREADY_DONE" };
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
      // Two fan-outs of one video (publish hook and sweep) wait for each other, so the "already
      // notified" read below cannot be stale: there is no unique index on (user, video).
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

  const queueEmail = deps.queueEmail ?? (await import("@/lib/modules/email")).queueNewVideoEmail;
  const email = await queueEmail(db, {
    videoId: video.id,
    channelId: channel.id,
    channelName: channel.name,
    title: video.title,
    titleEn: video.titleEn,
    slug: video.slug,
  });

  await db.appSetting.upsert({
    where: { key: markerKey },
    create: { key: markerKey, value: now.toISOString() },
    update: { value: now.toISOString() },
  });

  return { status: "done", inApp, emailQueued: email.queued, emailDuplicate: email.duplicate };
}

/**
 * The entry point for publication code: never throws. A failure is logged and the video stays
 * un-marked, so the sweep picks it up again.
 */
export async function notifyNewVideoPublished(videoId: string, deps: NewVideoFanOutDeps = {}): Promise<NewVideoFanOutResult> {
  try {
    return await fanOutNewVideo(videoId, deps);
  } catch (error) {
    logger.error("[notifications] new-video fan-out failed", { videoId, error: error instanceof Error ? error.message : String(error) });
    return { status: "error" };
  }
}

export type NewVideoSweepResult = {
  /** First run: the cut-off was recorded, nothing was announced. */
  initialized: boolean;
  candidates: number;
  done: number;
  skipped: number;
  errors: number;
};

/**
 * Announces videos that became public without a fan-out yet: a premiere that has just started, or a
 * publication whose hook failed. There is no other trigger for premieres (CLAUDE.md 4.15: the
 * premiere is evaluated at read time), hence the cron `notify-new-videos` every 5 minutes.
 *
 * Only videos whose effective publication time (later of publishedAt and premiereAt) lies after the
 * recorded start of the feature and within the last 3 days are looked at.
 */
export async function notifyDuePublishedVideos(
  deps: NewVideoFanOutDeps & { limit?: number } = {},
): Promise<NewVideoSweepResult> {
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  const result: NewVideoSweepResult = { initialized: false, candidates: 0, done: 0, skipped: 0, errors: 0 };

  const sinceRow = await db.appSetting.findUnique({ where: { key: NEW_VIDEO_SWEEP_SINCE_KEY }, select: { value: true } });
  const since = sinceRow ? new Date(sinceRow.value) : null;
  if (!since || Number.isNaN(since.getTime())) {
    await db.appSetting.upsert({
      where: { key: NEW_VIDEO_SWEEP_SINCE_KEY },
      create: { key: NEW_VIDEO_SWEEP_SINCE_KEY, value: now.toISOString() },
      update: { value: now.toISOString() },
    });
    result.initialized = true;
    return result;
  }

  const lowerBound = new Date(Math.max(since.getTime(), now.getTime() - NEW_VIDEO_SWEEP_WINDOW_MS));
  const candidates = await db.video.findMany({
    where: {
      status: "PUBLISHED",
      moderationStatus: { in: [...ANNOUNCEABLE_MODERATION] },
      creator: { is: PUBLIC_CHANNEL_WHERE },
      AND: [{ OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] }],
      OR: [
        { premiereAt: { gt: lowerBound, lte: now } },
        { premiereAt: null, publishedAt: { gt: lowerBound, lte: now } },
        { premiereAt: { lte: lowerBound }, publishedAt: { gt: lowerBound, lte: now } },
      ],
    },
    select: { id: true },
    orderBy: { publishedAt: "asc" },
    take: deps.limit ?? 100,
  });
  result.candidates = candidates.length;
  if (candidates.length === 0) return result;

  const markers = await db.appSetting.findMany({
    where: { key: { in: candidates.map((c) => newVideoMarkerKey(c.id)) } },
    select: { key: true },
  });
  const done = new Set(markers.map((m) => m.key));

  for (const candidate of candidates) {
    if (done.has(newVideoMarkerKey(candidate.id))) continue;
    const outcome = await notifyNewVideoPublished(candidate.id, { ...deps, db, now: () => now });
    if (outcome.status === "done") result.done++;
    else if (outcome.status === "error") result.errors++;
    else result.skipped++;
  }
  return result;
}
