/** K23 proves that publication and its recoverable notification intent share a PostgreSQL commit. */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { enqueuePublishedVideoAnnouncement, runNewVideoFanOutJobs } from "@/lib/modules/notifications/application/new-video-fan-out.use-case";

const prisma = new PrismaClient();
const RUN = `k23-${Date.now().toString(36)}`;
let userId = "";
let creatorId = "";
const videoIds: string[] = [];

beforeAll(async () => {
  userId = `${RUN}-user`;
  const user = await prisma.user.create({ data: { id: userId, email: `${RUN}@example.test` } });
  const creator = await prisma.creator.create({ data: { userId: user.id, slug: `${RUN}-creator`, name: "K23 test" } });
  creatorId = creator.id;
});

afterAll(async () => {
  await prisma.durableJob.deleteMany({ where: { kind: "NEW_VIDEO_FANOUT", dedupeKey: { in: videoIds } } });
  if (videoIds.length) await prisma.video.deleteMany({ where: { id: { in: videoIds } } });
  if (creatorId) await prisma.creator.deleteMany({ where: { id: creatorId } });
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
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
});
