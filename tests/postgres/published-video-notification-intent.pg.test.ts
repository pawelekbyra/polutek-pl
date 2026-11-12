/** K23 proves that publication and its recoverable notification intent share a PostgreSQL commit. */
import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createNewVideoFanOutHandler, enqueuePublishedVideoAnnouncement, runNewVideoFanOutJobs } from "@/lib/modules/notifications/application/new-video-fan-out.use-case";
import { notifyDuePremieres } from "@/lib/modules/notifications/application/premiere-notifications.use-case";
import { DurableJobRepository } from "@/lib/modules/shared/durable-job.repository";
import { DURABLE_JOB_LEASE_MS, runDurableJobs, type ClaimedJob, type DurableJobStore } from "@/lib/modules/shared/durable-job";

const prisma = new PrismaClient();
const RUN = `k23-${Date.now().toString(36)}`;
let userId = "";
let subscriberId = "";
let creatorId = "";
const videoIds: string[] = [];

beforeAll(async () => {
  userId = `${RUN}-user`;
  subscriberId = `${RUN}-subscriber`;
  await prisma.user.createMany({ data: [
    { id: userId, email: `${RUN}@example.test` },
    { id: subscriberId, email: `${RUN}-subscriber@example.test` },
  ] });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const creator = await prisma.creator.create({ data: { userId: user.id, slug: `${RUN}-creator`, name: "K23 test" } });
  creatorId = creator.id;
  await prisma.subscription.create({ data: { creatorId, userId: subscriberId, notify: true } });
});

afterAll(async () => {
  await prisma.durableJob.deleteMany({ where: { kind: "NEW_VIDEO_FANOUT", dedupeKey: { in: videoIds } } });
  if (videoIds.length) await prisma.video.deleteMany({ where: { id: { in: videoIds } } });
  if (creatorId) await prisma.creator.deleteMany({ where: { id: creatorId } });
  if (userId || subscriberId) await prisma.user.deleteMany({ where: { id: { in: [userId, subscriberId].filter(Boolean) } } });
  await prisma.$disconnect();
});

async function draft(name: string) {
  const video = await prisma.video.create({ data: {
    creatorId,
    title: `K23 ${name}`,
    slug: `${RUN}-${name}`,
    thumbnailUrl: "/logo.png",
  } });
  videoIds.push(video.id);
  return video;
}

describe("K23 publication notification intent (PostgreSQL)", () => {
  it("leaves a pending durable intent after commit, even if the request process never kicks the runner", async () => {
    const video = await draft("crash-after-commit");
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.video.update({ where: { id: video.id }, data: { status: "PUBLISHED", publishedAt: now } });
      expect(await enqueuePublishedVideoAnnouncement(video.id, tx, now)).toBe(true);
      expect(await enqueuePublishedVideoAnnouncement(video.id, tx, now)).toBe(true);
    });

    expect(await prisma.video.findUniqueOrThrow({ where: { id: video.id } })).toMatchObject({ status: "PUBLISHED", publishedAt: now });
    expect(await prisma.durableJob.findUnique({ where: { kind_dedupeKey: { kind: "NEW_VIDEO_FANOUT", dedupeKey: video.id } } })).toMatchObject({
      kind: "NEW_VIDEO_FANOUT",
      dedupeKey: video.id,
      payload: { variant: "publish" },
      status: "PENDING",
    });
    expect(await prisma.durableJob.count({ where: { kind: "NEW_VIDEO_FANOUT", dedupeKey: video.id } })).toBe(1);

    // Simulate the scheduled recovery pass after the request process was lost following commit.
    expect(await runNewVideoFanOutJobs({ db: prisma, maxJobs: 1 })).toMatchObject({ claimed: 1, done: 1 });
    expect(await prisma.durableJob.findUnique({ where: { kind_dedupeKey: { kind: "NEW_VIDEO_FANOUT", dedupeKey: video.id } } })).toMatchObject({ status: "DONE" });
  });

  it("rolls back publication and intent together if the publication transaction fails", async () => {
    const video = await draft("rollback-together");
    const now = new Date();

    await expect(prisma.$transaction(async (tx) => {
      await tx.video.update({ where: { id: video.id }, data: { status: "PUBLISHED", publishedAt: now } });
      await enqueuePublishedVideoAnnouncement(video.id, tx, now);
      throw new Error("force transaction rollback");
    })).rejects.toThrow("force transaction rollback");

    expect(await prisma.video.findUniqueOrThrow({ where: { id: video.id } })).toMatchObject({ status: "DRAFT", publishedAt: null });
    expect(await prisma.durableJob.count({ where: { kind: "NEW_VIDEO_FANOUT", dedupeKey: video.id } })).toBe(0);
  });

  it("enqueues a due premiere once and delivers its premiere notification through the durable runner", async () => {
    const video = await draft("premiere");
    const now = new Date("2026-11-07T12:00:00.000Z");
    await prisma.video.update({ where: { id: video.id }, data: {
      status: "PUBLISHED",
      publishedAt: new Date(now.getTime() - 60_000),
      premiereAt: new Date(now.getTime() - 1_000),
    } });

    const firstTick = await notifyDuePremieres({ db: prisma, now: () => now });
    expect(firstTick).toMatchObject({ candidates: 1, enqueued: 1, failed: 0 });
    const job = await prisma.durableJob.findUniqueOrThrow({
      where: { kind_dedupeKey: { kind: "NEW_VIDEO_FANOUT", dedupeKey: video.id } },
    });
    expect(job).toMatchObject({ status: "PENDING", payload: { variant: "premiere" } });

    await notifyDuePremieres({ db: prisma, now: () => now });
    expect(await prisma.durableJob.count({ where: { kind: "NEW_VIDEO_FANOUT", dedupeKey: video.id } })).toBe(1);
    expect(await runNewVideoFanOutJobs({ db: prisma, now: () => now, maxJobs: 1 })).toMatchObject({ claimed: 1, done: 1 });
    expect(await prisma.notification.findMany({ where: { videoId: video.id, userId: subscriberId, kind: "NEW_VIDEO" } })).toMatchObject([
      { templateKey: "premiere", titlePl: "Premiera: K23 premiere" },
    ]);
    expect(await prisma.video.findUniqueOrThrow({ where: { id: video.id } })).toMatchObject({ premiereNotifiedAt: now });
    expect(await notifyDuePremieres({ db: prisma, now: () => now })).toMatchObject({ candidates: 0, enqueued: 0, failed: 0 });
    expect(await prisma.notification.count({ where: { videoId: video.id, userId: subscriberId, kind: "NEW_VIDEO" } })).toBe(1);
  });

  it("keeps a failed fan-out page atomic and retries it to completion", async () => {
    const video = await draft("retry-after-notification-write-failure");
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.video.update({ where: { id: video.id }, data: { status: "PUBLISHED", publishedAt: now } });
      await enqueuePublishedVideoAnnouncement(video.id, tx, now);
    });
    const job = await prisma.durableJob.findUniqueOrThrow({
      where: { kind_dedupeKey: { kind: "NEW_VIDEO_FANOUT", dedupeKey: video.id } },
    });
    const sqlSuffix = RUN.replace(/[^a-zA-Z0-9]/g, "_");
    const functionName = `k23_fail_notification_${sqlSuffix}`;
    const triggerName = `k23_fail_notification_${sqlSuffix}`;
    expect(video.id).toMatch(/^[a-zA-Z0-9_-]+$/);
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${functionName}"() RETURNS trigger AS $$
      BEGIN
        IF NEW."videoId" = '${video.id}' THEN RAISE EXCEPTION 'K23 simulated notification page write failure'; END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "Notification" FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`);

    const repository = new DurableJobRepository(prisma);
    const targetedStore: DurableJobStore<Prisma.TransactionClient> = {
      enqueue: (input, tx) => repository.enqueue(input, tx),
      claimNext: async (_kinds, leaseMs, token) => {
        const rows = await prisma.$queryRaw<Array<Omit<ClaimedJob, "token">>>`
          UPDATE "DurableJob" AS j
          SET "lockedBy" = ${token},
              "lockedUntil" = (now() AT TIME ZONE 'UTC') + make_interval(secs => ${Math.ceil(leaseMs / 1000)}::double precision),
              "updatedAt" = (now() AT TIME ZONE 'UTC')
          WHERE j."id" = ${job.id} AND j."kind" = 'NEW_VIDEO_FANOUT' AND j."status" = 'PENDING'
            AND j."runAfter" <= (now() AT TIME ZONE 'UTC')
            AND (j."lockedUntil" IS NULL OR j."lockedUntil" < (now() AT TIME ZONE 'UTC'))
          RETURNING j."id", j."kind", j."dedupeKey", j."payload", j."cursor", j."attempts"
        `;
        return rows[0] ? { ...rows[0], token } : null;
      },
      checkpoint: (claimed, cursor, leaseMs, tx) => repository.checkpoint(claimed, cursor, leaseMs, tx),
      complete: (claimed) => repository.complete(claimed),
      release: (claimed, input) => repository.release(claimed, input),
    };
    const handler = createNewVideoFanOutHandler({ db: prisma });
    const run = () => runDurableJobs({
      store: targetedStore,
      handlers: { NEW_VIDEO_FANOUT: handler },
      leaseMs: DURABLE_JOB_LEASE_MS,
      maxJobs: 1,
    });

    try {
      expect(await run()).toMatchObject({ claimed: 1, retried: 1, done: 0, dead: 0 });
      const failed = await prisma.durableJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(failed).toMatchObject({ status: "PENDING", attempts: 1, cursor: null });
      expect(failed.lastError).toContain("tx.notification.createMany");
      expect(await prisma.notification.count({ where: { videoId: video.id, userId: subscriberId, kind: "NEW_VIDEO" } })).toBe(0);
      expect((await prisma.video.findUniqueOrThrow({ where: { id: video.id } })).premiereNotifiedAt).toBeNull();

      await prisma.$executeRawUnsafe(`DROP TRIGGER "${triggerName}" ON "Notification"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION "${functionName}"()`);
      await prisma.durableJob.update({ where: { id: job.id }, data: { runAfter: new Date(0) } });
      expect(await run()).toMatchObject({ claimed: 1, done: 1, retried: 0 });
      expect(await prisma.durableJob.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({ status: "DONE", attempts: 1, lastError: null });
      expect(await prisma.notification.count({ where: { videoId: video.id, userId: subscriberId, kind: "NEW_VIDEO" } })).toBe(1);
      expect((await prisma.video.findUniqueOrThrow({ where: { id: video.id } })).premiereNotifiedAt).not.toBeNull();
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "Notification"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
    }
  });
});
