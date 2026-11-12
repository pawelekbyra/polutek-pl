/** K17 reproduces a former worker returning after another attempt has taken over and finalized. */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSelfHlsFinalizer } from "@/lib/modules/video-pipeline/application/finalize-self-hls";
import { hlsAttemptAssetKey } from "@/lib/modules/video-pipeline/domain/keys";

const prisma = new PrismaClient();
const RUN = `k17-${Date.now().toString(36)}`;
const ATTEMPT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ATTEMPT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let userId = "";
let creatorId = "";
let videoId = "";
let originalId = "";

beforeAll(async () => {
  userId = `${RUN}-user`;
  const user = await prisma.user.create({ data: { id: userId, email: `${RUN}@example.test` } });
  const creator = await prisma.creator.create({ data: { userId: user.id, slug: `${RUN}-creator`, name: "K17 test" } });
  creatorId = creator.id;
  const video = await prisma.video.create({
    data: { creatorId, title: "K17 fencing test", slug: `${RUN}-video`, thumbnailUrl: "https://example.test/custom.jpg" },
  });
  videoId = video.id;
  const original = await prisma.videoOriginal.create({
    data: { videoId, bucket: "k17-test", objectKey: `originals/${videoId}/source.mp4`, version: 1, status: "READY" },
  });
  originalId = original.id;
});

afterAll(async () => {
  if (videoId) await prisma.video.deleteMany({ where: { id: videoId } });
  if (creatorId) await prisma.creator.deleteMany({ where: { id: creatorId } });
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("K17 stale encoder fencing (PostgreSQL)", () => {
  it("does not let attempt A activate or replace the route after B takes over and finalizes", async () => {
    const job = await prisma.videoEncodeJob.create({
      data: {
        videoId, originalId, versionNumber: 4, idempotencyKey: `${originalId}:k17`, status: "RUNNING",
        attemptCount: 2, attemptId: ATTEMPT_A, workerId: "worker-a", heartbeatAt: new Date(),
      },
    });
    const attemptBJob = await prisma.videoEncodeJob.update({
      where: { id: job.id }, data: { attemptId: ATTEMPT_B, workerId: "worker-b", heartbeatAt: new Date() },
    });
    const finalizer = createSelfHlsFinalizer(prisma);
    const input = (currentJob: typeof job, attemptId: string) => ({
      job: { ...currentJob, attemptId },
      assetKey: hlsAttemptAssetKey(videoId, currentJob.versionNumber, attemptId),
      hlsBucket: "k17-test-hls",
      posterPath: "/unused-poster.jpg",
      meta: { source: { durationSeconds: 30 } },
      totalBytes: 100,
    });

    const bResult = await finalizer.finalize(input(attemptBJob, ATTEMPT_B));
    await expect(finalizer.finalize(input(job, ATTEMPT_A))).rejects.toThrow();

    const [video, assets, persistedJob] = await Promise.all([
      prisma.video.findUniqueOrThrow({ where: { id: videoId }, include: { activePlaybackRoute: true } }),
      prisma.videoAsset.findMany({ where: { videoId, provider: "SELF_HLS" }, orderBy: { createdAt: "asc" } }),
      prisma.videoEncodeJob.findUniqueOrThrow({ where: { id: job.id } }),
    ]);
    expect(video.activePlaybackRoute?.assetId).toBe(bResult.assetId);
    expect(video.activePlaybackRoute?.assetId).not.toBe(assets.find((asset) => asset.objectKey.endsWith(ATTEMPT_A))?.id);
    expect(assets.map((asset) => asset.objectKey)).toEqual([hlsAttemptAssetKey(videoId, job.versionNumber, ATTEMPT_B)]);
    expect(persistedJob).toMatchObject({ status: "RUNNING", workerId: "worker-b", attemptId: ATTEMPT_B });
  });
});
