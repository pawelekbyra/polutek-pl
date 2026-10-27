import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isUpcomingPremiere } from "@/lib/premiere";
import { DurableJobRepository } from "@/lib/modules/shared/durable-job.repository";
import { runDurableJobs, type EnqueueInput, type JobHandler, type RunJobsResult } from "@/lib/modules/shared/durable-job";
import { applyNewVideoTemplate, buildNewVideoCopy, buildNewVideoParams, buildPremiereCopy, newVideoHref, newVideoLockKey } from "../domain/new-video";
import type { NotificationParams, NotificationTemplateKey } from "../domain/notification-render";

/**
 * NEW_VIDEO fan-out (CLAUDE.md 4.18): when a video becomes publicly available as PUBLISHED, the
 * followers of its channel get an in-app notification.
 *
 * Durable (DB-15, DB-16, W06): publication (and the premiere cron) only ENQUEUES a `NEW_VIDEO_FANOUT`
 * job (`DurableJob`, one per video); a runner takes it with a lease and writes the notifications in
 * small committed pages keyed by userId, saving the resume point (`DurableJob.cursor`) in the same
 * transaction as each page. A crash or a lost lease therefore loses at most the page in flight; the
 * next run (cron tick every minute, or the post-publish kick) continues after the last page. When
 * the last page is written the video is marked `premiereNotifiedAt` and the job is DONE.
 *
 * Rules:
 * - Enqueued AFTER the publication committed, never inside its transaction; `notifyNewVideoPublished`
 *   swallows every error, so a failing notification can never undo or fail a publication.
 * - Only PUBLISHED without an upcoming premiere. UNLISTED, DRAFT, ARCHIVED and scheduled premieres
 *   are skipped; a scheduled premiere is announced when it starts by `premiere-notifications.use-case.ts`
 *   (cron). A completed job sets `Video.premiereNotifiedAt`, so that cron never repeats it.
 * - Audience: `Subscription.notify = true` and `NotificationPreference.newVideoInApp` (no row = on).
 *   The channel owner is not notified of their own video.
 * - Idempotent per (user, video): each page first reads the NEW_VIDEO rows of that video for its
 *   userIds (index kind+videoId+userId) under an advisory lock and skips them, so a repeated or
 *   resumed run writes nothing twice. The job row (not the prunable Notification rows) is the proof
 *   that the fan-out finished.
 */

/** Recipients per committed page (one transaction each). */
export const FAN_OUT_PAGE_SIZE = 500;
export const NEW_VIDEO_FANOUT_KIND = "NEW_VIDEO_FANOUT" as const;

export type NewVideoVariant = "publish" | "premiere";

export type NewVideoFanOutResult =
  | { status: "skipped"; reason: "NOT_FOUND" | "NOT_PUBLISHED" | "UPCOMING_PREMIERE" | "NOT_VISIBLE" }
  | { status: "queued" }
  | { status: "error" };

export type NewVideoFanOutDeps = {
  db?: PrismaClient;
  now?: () => Date;
  /** Starts a runner right after enqueueing (default: fire and forget); tests pass a no-op. */
  kick?: () => void;
};

/** Moderation states that may be announced; LIMITED and REMOVED videos are not promoted. */
const ANNOUNCEABLE_MODERATION = ["VISIBLE", "AGE_RESTRICTED"] as const;

type Announceable = {
  id: string;
  title: string;
  titleEn: string | null;
  slug: string;
  channel: { id: string; name: string; userId: string };
};

type Skipped = Extract<NewVideoFanOutResult, { status: "skipped" }>;

/** Is the video announceable right now? Shared by the enqueue step and the job run (state may change in between). */
async function evaluateNewVideo(db: PrismaClient, videoId: string, now: Date): Promise<{ skipped: Skipped } | { video: Announceable }> {
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
  if (!video) return { skipped: { status: "skipped", reason: "NOT_FOUND" } };
  if (video.status !== "PUBLISHED") return { skipped: { status: "skipped", reason: "NOT_PUBLISHED" } };
  // A scheduled premiere is announced when it starts (premiere-notifications cron).
  if (isUpcomingPremiere({ status: video.status, premiereAt: video.premiereAt }, now)) {
    return { skipped: { status: "skipped", reason: "UPCOMING_PREMIERE" } };
  }
  const channel = video.creator;
  const channelPublic = Boolean(channel) && !channel.deletedAt && (channel.status === "ACTIVE" || channel.status === "LIMITED");
  const notDue = Boolean(video.publishedAt) && video.publishedAt!.getTime() > now.getTime();
  if (notDue || !channelPublic || !(ANNOUNCEABLE_MODERATION as readonly string[]).includes(video.moderationStatus)) {
    return { skipped: { status: "skipped", reason: "NOT_VISIBLE" } };
  }
  return { video: { id: video.id, title: video.title, titleEn: video.titleEn, slug: video.slug, channel: { id: channel.id, name: channel.name, userId: channel.userId } } };
}

/** Puts the fan-out of one video in the durable queue (no-op while one is pending). `reopen` = finished states to run again. */
export async function enqueueNewVideoFanOut(
  videoId: string,
  variant: NewVideoVariant,
  reopen: EnqueueInput["reopen"],
  db: PrismaClient = prisma,
): Promise<void> {
  await new DurableJobRepository(db).enqueue({ kind: NEW_VIDEO_FANOUT_KIND, dedupeKey: videoId, payload: { variant }, reopen });
}

function variantOf(payload: unknown): NewVideoVariant {
  return (payload as { variant?: unknown } | null)?.variant === "premiere" ? "premiere" : "publish";
}

/**
 * The job handler: writes the notifications of one video in pages of `FAN_OUT_PAGE_SIZE` users after
 * the saved cursor. Returns "continue" when the run's time budget is spent mid-way, "done" when the
 * last page is written (or the video is no longer announceable: nothing to send).
 */
export function createNewVideoFanOutHandler(deps: { db?: PrismaClient; now?: () => Date } = {}): JobHandler<Prisma.TransactionClient> {
  const db = deps.db ?? prisma;
  const clock = deps.now ?? (() => new Date());
  return async (ctx) => {
    const videoId = ctx.job.dedupeKey;
    const now = clock();
    const evaluated = await evaluateNewVideo(db, videoId, now);
    if ("skipped" in evaluated) {
      logger.info("[notifications] new-video fan-out job skipped", { videoId, reason: evaluated.skipped.reason });
      return "done";
    }
    const { video } = evaluated;
    const channel = video.channel;
    const href = newVideoHref(video.slug);
    const input = { channelName: channel.name, title: video.title, titleEn: video.titleEn };
    let copy: { titlePl: string; titleEn: string; bodyPl: string; bodyEn: string };
    let template: { key: NotificationTemplateKey; params: NotificationParams } | undefined;
    if (variantOf(ctx.job.payload) === "premiere") {
      copy = buildPremiereCopy(input);
      template = { key: "premiere", params: buildNewVideoParams(input) };
    } else {
      const override = await db.notificationTemplate.findUnique({ where: { kind: "NEW_VIDEO" } });
      copy = applyNewVideoTemplate(override, buildNewVideoCopy(input), input);
      // An admin-edited template is static text: such rows keep it as written and carry no per-language key.
      template = override ? undefined : { key: "new_video", params: buildNewVideoParams(input) };
    }

    let cursor = ctx.job.cursor;
    for (;;) {
      const page = await db.subscription.findMany({
        where: {
          creatorId: channel.id,
          notify: true,
          userId: cursor ? { gt: cursor, not: channel.userId } : { not: channel.userId },
          user: {
            isDeleted: false,
            OR: [{ notificationPreference: { is: null } }, { notificationPreference: { is: { newVideoInApp: true } } }],
          },
        },
        orderBy: { userId: "asc" },
        take: FAN_OUT_PAGE_SIZE,
        select: { userId: true },
      });
      if (page.length === 0) break;
      const ids = page.map((s) => s.userId);
      const last = ids[ids.length - 1];
      await db.$transaction(async (tx) => {
        // Old-version code (during a deploy) and a second job of the same video wait for each other, so the
        // "already notified" read below cannot be stale: there is no unique index on (user, video).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${newVideoLockKey(video.id)}))`;
        const already = await tx.notification.findMany({
          where: { kind: "NEW_VIDEO", videoId: video.id, userId: { in: ids } },
          select: { userId: true },
        });
        const notified = new Set(already.map((n) => n.userId));
        const fresh = ids.filter((userId) => !notified.has(userId));
        if (fresh.length > 0) {
          await tx.notification.createMany({
            data: fresh.map((userId) => ({
              userId,
              kind: "NEW_VIDEO" as const,
              titlePl: copy.titlePl,
              titleEn: copy.titleEn,
              bodyPl: copy.bodyPl,
              bodyEn: copy.bodyEn,
              href,
              ...(template ? { templateKey: template.key, params: template.params } : {}),
              channelId: channel.id,
              videoId: video.id,
            })),
          });
        }
        // Same transaction as the page: either the rows and the cursor are both saved, or neither (a lost lease throws and rolls the rows back).
        await ctx.checkpoint(last, tx);
      });
      cursor = last;
      if (page.length < FAN_OUT_PAGE_SIZE) break;
      if (ctx.shouldYield()) return "continue";
    }
    // The fan-out counts as "announced": the premiere cron must never send a second one.
    await db.video.updateMany({ where: { id: video.id, premiereNotifiedAt: null }, data: { premiereNotifiedAt: now } });
    return "done";
  };
}

/** One runner pass over the NEW_VIDEO_FANOUT jobs (cron tick, post-publish kick). */
export function runNewVideoFanOutJobs(deps: { db?: PrismaClient; now?: () => Date; maxJobs?: number } = {}): Promise<RunJobsResult> {
  const db = deps.db ?? prisma;
  return runDurableJobs<Prisma.TransactionClient>({
    store: new DurableJobRepository(db),
    handlers: { NEW_VIDEO_FANOUT: createNewVideoFanOutHandler({ db, now: deps.now }) },
    maxJobs: deps.maxJobs,
  });
}

function kickRunner(): void {
  void runNewVideoFanOutJobs({ maxJobs: 1 }).catch((error) => {
    logger.error("[notifications] new-video fan-out kick failed (the cron will pick the job up)", { error: error instanceof Error ? error.message : String(error) });
  });
}

/**
 * The entry point for publication code: never throws. Checks the video is announceable, enqueues the
 * durable job and starts a runner at once (so the bell fills as fast as before); if this process dies
 * the minute cron continues the job. A failure is logged only.
 */
export async function notifyNewVideoPublished(videoId: string, deps: NewVideoFanOutDeps = {}): Promise<NewVideoFanOutResult> {
  try {
    const db = deps.db ?? prisma;
    const evaluated = await evaluateNewVideo(db, videoId, (deps.now ?? (() => new Date()))());
    if ("skipped" in evaluated) return evaluated.skipped;
    // A publication after an earlier (finished or dead) fan-out of the same video runs it again: new followers get it, old ones are deduped.
    await enqueueNewVideoFanOut(videoId, "publish", ["DONE", "DEAD"], db);
    (deps.kick ?? kickRunner)();
    return { status: "queued" };
  } catch (error) {
    logger.error("[notifications] new-video fan-out failed", { videoId, error: error instanceof Error ? error.message : String(error) });
    return { status: "error" };
  }
}
