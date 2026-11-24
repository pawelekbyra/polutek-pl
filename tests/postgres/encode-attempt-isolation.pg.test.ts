/** K16 verifies old claims are rejected and each real retry receives a fresh storage namespace. */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hlsAttemptAssetKey } from "@/lib/modules/video-pipeline/domain/keys";
import { EncodeJobRepository } from "@/lib/modules/video-pipeline/infrastructure/encode-job.repository";
import { STALE_HEARTBEAT_MS } from "@/lib/modules/video-pipeline/domain/encode-job.state";

const prisma = new PrismaClient();
const RUN = `k16-${Date.now().toString(36)}`;
let userId = "";
let creatorId = "";
let videoId = "";
let originalId = "";

beforeAll(async () => {
  userId = `${RUN}-user`;
  const user = await prisma.user.create({ data: { id: userId, email: `${RUN}@example.test` } });
  const creator = await prisma.creator.create({ data: { userId: user.id, slug: `${RUN}-creator`, name: "K16 test" } });
  creatorId = creator.id;
  const video = await prisma.video.create({ data: { creatorId, title: "K16 attempt test", slug: `${RUN}-video`, thumbnailUrl: "/logo.png" } });
  videoId = video.id;
  const original = await prisma.videoOriginal.create({
    data: { videoId, bucket: "k16-test", objectKey: `originals/${videoId}/source.mp4`, version: 1, status: "READY" },
  });
  originalId = original.id;
  await prisma.video.update({ where: { id: videoId }, data: { activeOriginalId: originalId } });
});

afterAll(async () => {
  if (videoId) await prisma.video.deleteMany({ where: { id: videoId } });
  if (creatorId) await prisma.creator.deleteMany({ where: { id: creatorId } });
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("K16 encode attempt isolation (PostgreSQL)", () => {
  it("rejects a legacy claim and issues a distinct attempt identity after retry", async () => {
    const job = await prisma.videoEncodeJob.create({
      data: { videoId, originalId, versionNumber: 1, idempotencyKey: `${originalId}:k16`, channelId: creatorId },
    });

    await expect(prisma.$executeRaw`
      UPDATE "VideoEncodeJob" SET "status" = 'RUNNING', "workerId" = 'legacy-worker' WHERE "id" = ${job.id}
    `).rejects.toThrow(/requires attemptId/);
    await expect(prisma.videoEncodeJob.findUniqueOrThrow({ where: { id: job.id } })).resolves.toMatchObject({ status: "QUEUED", attemptId: null });

    const repository = new EncodeJobRepository(prisma);
    const first = await repository.claimNext("k16-worker-a", new Date());
    expect(first).toMatchObject({ id: job.id, status: "RUNNING", attemptCount: 1 });
    expect(first?.attemptId).toMatch(/^[0-9a-f-]{36}$/i);
    const firstPrefix = hlsAttemptAssetKey(videoId, job.versionNumber, first?.attemptId);
    expect(await repository.release(job.id, "k16-worker-a", first!.attemptId)).toBe(true);

    const second = await repository.claimNext("k16-worker-b", new Date());
    expect(second).toMatchObject({ id: job.id, status: "RUNNING", attemptCount: 1 });
    expect(second?.attemptId).toMatch(/^[0-9a-f-]{36}$/i);
    const secondPrefix = hlsAttemptAssetKey(videoId, job.versionNumber, second?.attemptId);
    expect(secondPrefix).not.toBe(firstPrefix);
    expect(secondPrefix.startsWith(`${firstPrefix}/`)).toBe(false);

    expect(await repository.release(job.id, "k16-worker-b", second!.attemptId)).toBe(true);
    await prisma.videoEncodeJob.update({ where: { id: job.id }, data: { status: "CANCELLED", finishedAt: new Date() } });
    const legacy = await prisma.videoEncodeJob.create({
      data: {
        videoId, originalId, versionNumber: 2, idempotencyKey: `${originalId}:k16-legacy`, status: "RUNNING",
        attemptCount: 1, workerId: "legacy-in-flight", heartbeatAt: new Date(Date.now() - STALE_HEARTBEAT_MS - 1_000),
      },
    });
    // An old worker already running at migration time can still heartbeat until it is drained.
    await expect(prisma.videoEncodeJob.update({ where: { id: legacy.id }, data: { heartbeatAt: new Date() } })).resolves.toMatchObject({ status: "RUNNING", attemptId: null });
    await prisma.videoEncodeJob.update({ where: { id: legacy.id }, data: { heartbeatAt: new Date(Date.now() - STALE_HEARTBEAT_MS - 1_000) } });
    expect(await repository.requeueStale(new Date())).toMatchObject({ requeued: 1, failed: 0, cancelled: 0 });
    await prisma.videoEncodeJob.update({ where: { id: legacy.id }, data: { nextAttemptAt: new Date(Date.now() - 1_000) } });
    const recovered = await repository.claimNext("k16-restarted-worker", new Date());
    expect(recovered).toMatchObject({ id: legacy.id, status: "RUNNING" });
    expect(recovered?.attemptId).toMatch(/^[0-9a-f-]{36}$/i);
    await expect(prisma.video.findUniqueOrThrow({ where: { id: videoId }, select: { activeOriginalId: true } })).resolves.toEqual({ activeOriginalId: originalId });
  });
});
