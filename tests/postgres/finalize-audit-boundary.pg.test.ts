/** K18 verifies transactional route audit and recovery when the COMMIT acknowledgement is lost. */
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  failAudit: false,
  recordAuditEvent: vi.fn(),
}));

vi.mock("@/lib/modules/audit", () => ({ recordAuditEvent: mocks.recordAuditEvent }));

import { createSelfHlsFinalizer } from "@/lib/modules/video-pipeline/application/finalize-self-hls";
import { hlsAttemptAssetKey } from "@/lib/modules/video-pipeline/domain/keys";
import { VideoPlaybackRouteService } from "@/lib/modules/video/application/video-playback-route.service";

const prisma = new PrismaClient();
const RUN = `k18-${Date.now().toString(36)}`;
let userId = "";
let creatorId = "";
const videoIds: string[] = [];

beforeAll(async () => {
  userId = `${RUN}-user`;
  const user = await prisma.user.create({ data: { id: userId, email: `${RUN}@example.test` } });
  const creator = await prisma.creator.create({ data: { userId: user.id, slug: `${RUN}-creator`, name: "K18 test" } });
  creatorId = creator.id;
  mocks.recordAuditEvent.mockImplementation(async (ctx, input, tx) => {
    if (mocks.failAudit) throw new Error("injected audit insert failure");
    const db = tx ?? ctx.prisma;
    return db.auditLog.create({
      data: { action: input.action, targetType: input.targetType, targetId: input.targetId, metadata: input.metadata ?? undefined, actorType: "system", systemReason: "video_encode_worker" },
    });
  });
});

afterEach(() => {
  mocks.failAudit = false;
  vi.restoreAllMocks();
});

afterAll(async () => {
  if (videoIds.length) {
    // AuditLog is immutable for 400 days by database trigger; the disposable test database is removed after the run.
    await prisma.video.deleteMany({ where: { id: { in: videoIds } } });
  }
  if (creatorId) await prisma.creator.deleteMany({ where: { id: creatorId } });
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

async function fixture(suffix: string) {
  const video = await prisma.video.create({
    data: { creatorId, title: "K18 audit boundary", slug: `${RUN}-${suffix}`, thumbnailUrl: "https://example.test/cover.jpg", duration: "0:30" },
  });
  videoIds.push(video.id);
  const original = await prisma.videoOriginal.create({
    data: { videoId: video.id, bucket: "k18-test", objectKey: `originals/${video.id}/source.mp4`, version: 1, status: "READY" },
  });
  const job = await prisma.videoEncodeJob.create({
    data: {
      videoId: video.id, originalId: original.id, versionNumber: 1, idempotencyKey: `${original.id}:k18`,
      status: "RUNNING", attemptCount: 1, attemptId: `${suffix}0000-4000-8000-000000000000`, workerId: "k18-worker", heartbeatAt: new Date(),
    },
  });
  return { video, job };
}

function finalizeInput(videoId: string, job: Awaited<ReturnType<typeof fixture>>["job"]) {
  return {
    job,
    assetKey: hlsAttemptAssetKey(videoId, job.versionNumber, job.attemptId),
    hlsBucket: "k18-test-hls",
    posterPath: "/unused.jpg",
    meta: { source: { durationSeconds: 30 } },
    totalBytes: 100,
  };
}

describe("K18 finalizer audit boundary (PostgreSQL)", () => {
  it("rolls back a new route and removes the unactivated asset when mandatory audit fails", async () => {
    const { video, job } = await fixture("new");
    mocks.failAudit = true;
    await expect(createSelfHlsFinalizer(prisma).finalize(finalizeInput(video.id, job))).rejects.toThrow("injected audit insert failure");
    expect(await prisma.videoPlaybackRoute.count({ where: { videoId: video.id } })).toBe(0);
    expect(await prisma.videoAsset.count({ where: { videoId: video.id, provider: "SELF_HLS" } })).toBe(0);
    expect(await prisma.video.findUniqueOrThrow({ where: { id: video.id }, select: { activePlaybackRouteId: true } })).toEqual({ activePlaybackRouteId: null });
  });

  it("removes a previously unactivated asset row if its route transaction rolls back", async () => {
    const { video, job } = await fixture("existing");
    const assetKey = hlsAttemptAssetKey(video.id, job.versionNumber, job.attemptId);
    await prisma.videoAsset.create({
      data: { videoId: video.id, provider: "SELF_HLS", objectKey: assetKey, bucket: "k18-test-hls", mimeType: "application/x-mpegURL", processingState: "READY", isPrimary: false },
    });
    mocks.failAudit = true;
    await expect(createSelfHlsFinalizer(prisma).finalize(finalizeInput(video.id, job))).rejects.toThrow("injected audit insert failure");
    expect(await prisma.videoPlaybackRoute.count({ where: { videoId: video.id } })).toBe(0);
    expect(await prisma.videoAsset.count({ where: { videoId: video.id, provider: "SELF_HLS" } })).toBe(0);
  });

  it("reconciles a committed route when the transaction acknowledgement is lost", async () => {
    const { video, job } = await fixture("ack-lost");
    const originalActivate = VideoPlaybackRouteService.prototype.activateRoute;
    vi.spyOn(VideoPlaybackRouteService.prototype, "activateRoute").mockImplementation(async function (input, ctx) {
      await originalActivate.call(this, input, ctx);
      throw new Error("injected lost COMMIT acknowledgement");
    });
    await expect(createSelfHlsFinalizer(prisma).finalize(finalizeInput(video.id, job))).resolves.toMatchObject({ assetId: expect.any(String) });
    const [route, asset, audit] = await Promise.all([
      prisma.videoPlaybackRoute.findFirst({ where: { videoId: video.id, status: "ACTIVE" } }),
      prisma.videoAsset.findFirst({ where: { videoId: video.id, provider: "SELF_HLS" } }),
      prisma.auditLog.findFirst({ where: { action: "VIDEO_PLAYBACK_ROUTE_ACTIVATED", targetId: video.id } }),
    ]);
    expect(route?.assetId).toBe(asset?.id);
    expect(asset?.objectKey).toBe(hlsAttemptAssetKey(video.id, job.versionNumber, job.attemptId));
    expect(audit).not.toBeNull();
  });
});
