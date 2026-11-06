/** K23 drives the real publication use case, loses its post-commit kick, then recovers in a fresh process. */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/modules/video/application/announce-published-video", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/modules/video/application/announce-published-video")>();
  return { ...actual, announcePublishedVideo: vi.fn().mockResolvedValue(undefined) };
});
vi.mock("@/lib/modules/video/application/sync-public-thumbnail.service", () => ({
  syncPublicThumbnail: vi.fn().mockResolvedValue("skipped"),
}));
vi.mock("@/lib/modules/video/application/ready-visibility", () => ({
  clearReadyVisibility: vi.fn().mockResolvedValue(undefined),
}));

import { createAppContext } from "@/lib/modules/shared/app-context";
import { announcePublishedVideo } from "@/lib/modules/video/application/announce-published-video";
import { publishAdminVideo } from "@/lib/modules/video/application/publish-admin-video.use-case";
import { notifyNewVideoPublished, runNewVideoFanOutJobs } from "@/lib/modules/notifications/application/new-video-fan-out.use-case";

const prisma = new PrismaClient();
const RUN = `k23-restart-${Date.now().toString(36)}`;
const DATABASE_URL = process.env.DATABASE_URL;
let userId = "";
let subscriberId = "";
let creatorId = "";
let videoId = "";
let assetId = "";
let jobId = "";

beforeAll(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for this PostgreSQL integration test");
  userId = `${RUN}-owner`;
  subscriberId = `${RUN}-subscriber`;
  await prisma.user.createMany({ data: [
    { id: userId, email: `${RUN}-owner@example.test`, name: "K23 publisher" },
    { id: subscriberId, email: `${RUN}-subscriber@example.test`, name: "K23 subscriber" },
  ] });
  const creator = await prisma.creator.create({ data: {
    userId, slug: RUN, name: "K23 restart", status: "ACTIVE",
  } });
  creatorId = creator.id;
  await prisma.subscription.create({ data: { userId: subscriberId, creatorId, notify: true } });
  const video = await prisma.video.create({ data: {
    creatorId,
    title: "K23 durable publication",
    slug: `${RUN}-video`,
    thumbnailUrl: "https://example.test/k23-thumbnail.jpg",
    duration: "0:30",
    tier: "PUBLIC",
  } });
  videoId = video.id;
  const asset = await prisma.videoAsset.create({ data: {
    videoId,
    provider: "SELF_HLS",
    objectKey: `videos/${videoId}/v/v1/attempts/k23-test`,
    bucket: "k23-test-hls",
    processingState: "READY",
    isPrimary: true,
  } });
  assetId = asset.id;
  const route = await prisma.videoPlaybackRoute.create({ data: {
    videoId, assetId, provider: "SELF_HLS", status: "ACTIVE",
  } });
  await prisma.video.update({ where: { id: videoId }, data: { activePlaybackRouteId: route.id } });
});

afterAll(async () => {
  if (jobId) await prisma.durableJob.deleteMany({ where: { id: jobId } });
  if (videoId) await prisma.video.deleteMany({ where: { id: videoId } });
  if (assetId) await prisma.videoAsset.deleteMany({ where: { id: assetId } });
  if (creatorId) await prisma.creator.deleteMany({ where: { id: creatorId } });
  if (userId || subscriberId) await prisma.user.deleteMany({ where: { id: { in: [userId, subscriberId].filter(Boolean) } } });
  await prisma.$disconnect();
});

describe("K23 publication intent recovery after process loss (PostgreSQL)", () => {
  it("publishes atomically, loses the request kick, then delivers once in a fresh runner process", async () => {
    const context = createAppContext({
      actor: { type: "system", reason: "k23_postgres_restart_test" },
      prisma,
      channelId: creatorId,
    });
    const published = await publishAdminVideo(videoId, context);
    expect(published.ok).toBe(true);
    expect(vi.mocked(announcePublishedVideo)).toHaveBeenCalledWith(videoId);
    expect(await prisma.video.findUniqueOrThrow({ where: { id: videoId } })).toMatchObject({ status: "PUBLISHED" });
    const intent = await prisma.durableJob.findUniqueOrThrow({
      where: { kind_dedupeKey: { kind: "NEW_VIDEO_FANOUT", dedupeKey: videoId } },
    });
    jobId = intent.id;
    expect(intent).toMatchObject({ kind: "NEW_VIDEO_FANOUT", status: "PENDING", payload: { variant: "publish" } });
    expect(await prisma.notification.count({ where: { videoId, userId: subscriberId, kind: "NEW_VIDEO" } })).toBe(0);

    const unrelatedPending = await prisma.durableJob.count({
      where: { kind: "NEW_VIDEO_FANOUT", status: "PENDING", dedupeKey: { not: videoId } },
    });
    expect(unrelatedPending).toBe(0);

    const childEnv: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      DATABASE_URL,
      DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED || DATABASE_URL,
    };
    const child = spawnSync(process.execPath, [
      path.join(process.cwd(), "node_modules/tsx/dist/cli.mjs"),
      path.join(process.cwd(), "tests/helpers/k23-recover-notification-job.ts"),
    ], { cwd: process.cwd(), env: childEnv, encoding: "utf8", timeout: 30_000, maxBuffer: 4_096 });
    expect(child.error).toBeUndefined();
    const safeChildOutput = `${child.stdout}\n${child.stderr}`
      .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgresql://[redacted]@")
      .slice(-1_000);
    expect(child.status, safeChildOutput).toBe(0);
    const runner = JSON.parse(child.stdout) as { claimed: number; done: number; retried: number; dead: number };
    expect(runner).toMatchObject({ claimed: 1, done: 1, retried: 0, dead: 0 });

    expect(await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } })).toMatchObject({ status: "DONE" });
    expect(await prisma.notification.findMany({ where: { videoId, userId: subscriberId, kind: "NEW_VIDEO" } })).toHaveLength(1);

    const retry = await notifyNewVideoPublished(videoId, { db: prisma, kick: () => undefined });
    expect(retry).toEqual({ status: "queued" });
    expect(await prisma.durableJob.findUniqueOrThrow({ where: { id: jobId } })).toMatchObject({ status: "PENDING" });
    expect(await runNewVideoFanOutJobs({ db: prisma, maxJobs: 1 })).toMatchObject({ claimed: 1, done: 1 });
    expect(await prisma.notification.count({ where: { videoId, userId: subscriberId, kind: "NEW_VIDEO" } })).toBe(1);
  }, 45_000);
});
