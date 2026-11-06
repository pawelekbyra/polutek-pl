/** K23 proves that publication and its recoverable notification intent share a PostgreSQL commit. */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enqueuePublishedVideoAnnouncement, runNewVideoFanOutJobs } from "@/lib/modules/notifications/application/new-video-fan-out.use-case";
import { notifyDuePremieres } from "@/lib/modules/notifications/application/premiere-notifications.use-case";

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
});
