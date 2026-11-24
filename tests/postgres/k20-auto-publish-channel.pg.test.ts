/** K20 verifies channel ownership through the real database-backed Self-HLS finalizer. */
import { randomUUID } from "node:crypto";
import { PrismaClient, type Video, type VideoEncodeJob } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSelfHlsFinalizer } from "@/lib/modules/video-pipeline/application/finalize-self-hls";
import { hlsAttemptAssetKey } from "@/lib/modules/video-pipeline/domain/keys";
import { MAIN_CHANNEL_SETTING_KEY } from "@/lib/modules/channel/domain/main-channel-setting";

const prisma = new PrismaClient();
const RUN = `k20-${Date.now().toString(36)}`;
let userIds: string[] = [];
let creatorIds: string[] = [];
const videoIds: string[] = [];
let previousMainChannelSetting: string | null = null;
let hadMainChannelSetting = false;

beforeAll(async () => {
  for (const [index, status] of (["ACTIVE", "ACTIVE", "SUSPENDED", "DELETED"] as const).entries()) {
    const user = await prisma.user.create({ data: { id: `${RUN}-user-${index}`, email: `${RUN}-${index}@example.test` } });
    userIds.push(user.id);
    const creator = await prisma.creator.create({
      data: { userId: user.id, slug: `${RUN}-creator-${index}`, name: `K20 creator ${index}`, status,
        ...(status === "DELETED" ? { deletedAt: new Date() } : {}) },
    });
    creatorIds.push(creator.id);
  }
  const existingMainChannelSetting = await prisma.appSetting.findUnique({ where: { key: MAIN_CHANNEL_SETTING_KEY } });
  hadMainChannelSetting = Boolean(existingMainChannelSetting);
  previousMainChannelSetting = existingMainChannelSetting?.value ?? null;
  await prisma.appSetting.upsert({
    where: { key: MAIN_CHANNEL_SETTING_KEY },
    create: { key: MAIN_CHANNEL_SETTING_KEY, value: creatorIds[0] },
    update: { value: creatorIds[0] },
  });
});

afterAll(async () => {
  if (hadMainChannelSetting && previousMainChannelSetting !== null) {
    await prisma.appSetting.update({ where: { key: MAIN_CHANNEL_SETTING_KEY }, data: { value: previousMainChannelSetting } });
  } else {
    await prisma.appSetting.deleteMany({ where: { key: MAIN_CHANNEL_SETTING_KEY } });
  }
  if (videoIds.length) await prisma.video.deleteMany({ where: { id: { in: videoIds } } });
  if (creatorIds.length) await prisma.creator.deleteMany({ where: { id: { in: creatorIds } } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

async function fixture(name: string, channelIndex = 0, visibility: "PUBLISHED" | "UNLISTED" = "PUBLISHED") {
  const video = await prisma.video.create({
    data: {
      creatorId: creatorIds[channelIndex], title: `K20 ${name}`, slug: `${RUN}-${name}`,
      thumbnailUrl: "https://example.test/cover.jpg", duration: "0:30", tier: "PUBLIC",
      publishAfterAssetReady: true, publishAfterAssetReadyVisibility: visibility,
    },
  });
  videoIds.push(video.id);
  const original = await prisma.videoOriginal.create({
    data: { videoId: video.id, bucket: "k20-test", objectKey: `originals/${video.id}/source.mp4`, version: 1, status: "READY" },
  });
  const job = await prisma.videoEncodeJob.create({
    data: {
      videoId: video.id, originalId: original.id, versionNumber: 1, idempotencyKey: `${original.id}:k20`,
      status: "RUNNING", attemptCount: 1, attemptId: randomUUID(), workerId: "k20-worker",
      channelId: creatorIds[channelIndex], heartbeatAt: new Date(),
    },
  });
  return { video, original, job };
}

function finalizeInput(video: Video, job: VideoEncodeJob) {
  return {
    job,
    assetKey: hlsAttemptAssetKey(video.id, job.versionNumber, job.attemptId),
    hlsBucket: "k20-test-hls",
    posterPath: "/unused.jpg",
    meta: { source: { durationSeconds: 30 } },
    totalBytes: 100,
  };
}

async function finalize(video: Video, job: VideoEncodeJob) {
  await createSelfHlsFinalizer(prisma).finalize(finalizeInput(video, job));
  return prisma.video.findUniqueOrThrow({
    where: { id: video.id },
    include: { activePlaybackRoute: { include: { asset: true } } },
  });
}

describe("K20 auto-publish channel context (PostgreSQL)", () => {
  it.each([
    ["public", "PUBLISHED", "PUBLISHED"],
    ["unlisted", "UNLISTED", "UNLISTED"],
  ] as const)("publishes a non-main creator's %s video into its own route and visibility", async (name, visibility, expected) => {
    const { video, job } = await fixture(name, 1, visibility);
    const result = await finalize(video, job);
    expect(result.status).toBe(expected);
    expect(result.creatorId).toBe(creatorIds[1]);
    expect(result.activePlaybackRoute?.videoId).toBe(video.id);
    expect(result.activePlaybackRoute?.asset.videoId).toBe(video.id);
    expect(result.activePlaybackRoute?.asset.objectKey).toBe(hlsAttemptAssetKey(video.id, job.versionNumber, job.attemptId));
    expect(result.publishAfterAssetReadyCompletedAt).not.toBeNull();
  });

  it.each([["suspended", 2], ["deleted", 3]] as const)("does not publish to a %s channel", async (_label, channelIndex) => {
    const { video, job } = await fixture(`refused-${channelIndex}`, channelIndex);
    const result = await finalize(video, job);
    expect(result.status).toBe("DRAFT");
    expect(result.publishAfterAssetReadyCompletedAt).toBeNull();
    expect(result.activePlaybackRoute?.asset.videoId).toBe(video.id);
  });

  it("does not publish when the persisted job channel differs from the video's channel", async () => {
    const { video, job } = await fixture("mismatched-channel", 0);
    await prisma.videoEncodeJob.update({ where: { id: job.id }, data: { channelId: creatorIds[1] } });
    const result = await finalize(video, job);
    expect(result.status).toBe("DRAFT");
    expect(result.publishAfterAssetReadyCompletedAt).toBeNull();
  });

  it("keeps the main channel path working", async () => {
    const { video, job } = await fixture("main", 0);
    const result = await finalize(video, job);
    expect(result.status).toBe("PUBLISHED");
    expect(result.creatorId).toBe(creatorIds[0]);
  });

  it("refuses a stale claim before a route or publication can be committed", async () => {
    const { video, job } = await fixture("stale", 1);
    const staleJob = { ...job, attemptId: randomUUID() } as VideoEncodeJob;
    await expect(createSelfHlsFinalizer(prisma).finalize(finalizeInput(video, staleJob))).rejects.toThrow("Encode attempt no longer owns this job");
    expect(await prisma.videoPlaybackRoute.count({ where: { videoId: video.id, status: "ACTIVE" } })).toBe(0);
    expect((await prisma.video.findUniqueOrThrow({ where: { id: video.id } })).status).toBe("DRAFT");
  });
});
