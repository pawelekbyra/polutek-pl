/** K17 lock-order regression: stale worker A waits on activation while a real DB transaction takes over as B. */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSelfHlsFinalizer } from "@/lib/modules/video-pipeline/application/finalize-self-hls";
import { hlsAttemptAssetKey } from "@/lib/modules/video-pipeline/domain/keys";

const prisma = new PrismaClient();
const RUN = `k17-race-${Date.now().toString(36)}`;
const ATTEMPT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ATTEMPT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let userId = "";
let creatorId = "";
let videoId = "";
let originalId = "";
let takeoverClient: PrismaClient | undefined;
let staleWorkerClient: PrismaClient | undefined;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function waitUntilStaleActivationWaitsForJobLock(): Promise<boolean> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const [row] = await prisma.$queryRaw<Array<{ waiting: bigint }>>`
      SELECT COUNT(*) AS waiting
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND state = 'active'
        AND wait_event_type = 'Lock'
        AND query LIKE '%FROM "VideoEncodeJob"%'
        AND query LIKE '%FOR UPDATE%'
    `;
    if (Number(row?.waiting ?? 0) > 0) return true;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return false;
}

beforeAll(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for this PostgreSQL integration test");
  const makeNamedUrl = (applicationName: string) => {
    const url = new URL(databaseUrl);
    url.searchParams.set("application_name", applicationName);
    return url.toString();
  };
  staleWorkerClient = new PrismaClient({ datasources: { db: { url: makeNamedUrl(`${RUN}-a`) } } });
  takeoverClient = new PrismaClient({ datasources: { db: { url: makeNamedUrl(`${RUN}-b`) } } });

  userId = `${RUN}-user`;
  await prisma.user.create({ data: { id: userId, email: `${RUN}@example.test` } });
  const creator = await prisma.creator.create({ data: { userId, slug: `${RUN}-creator`, name: "K17 race" } });
  creatorId = creator.id;
  const video = await prisma.video.create({
    data: { creatorId, title: "K17 race", slug: `${RUN}-video`, thumbnailUrl: "https://example.test/custom.jpg" },
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
  await Promise.all([prisma.$disconnect(), takeoverClient?.$disconnect(), staleWorkerClient?.$disconnect()]);
});

describe("K17 stale worker takeover race (two PostgreSQL sessions)", () => {
  it("makes A wait at the real job row lock, commits B's takeover, and prevents A from activating", async () => {
    const attemptAJob = await prisma.videoEncodeJob.create({
      data: {
        videoId, originalId, versionNumber: 4, idempotencyKey: `${originalId}:k17-race`, status: "RUNNING",
        attemptCount: 2, attemptId: ATTEMPT_A, workerId: "worker-a", heartbeatAt: new Date(), channelId: creatorId,
      },
    });
    const enteredTakeover = deferred();
    const commitTakeover = deferred();
    const takeover = takeoverClient!.$transaction(async (tx) => {
      const ownedByB = await tx.videoEncodeJob.update({
        where: { id: attemptAJob.id }, data: { attemptId: ATTEMPT_B, workerId: "worker-b", heartbeatAt: new Date() },
      });
      enteredTakeover.resolve();
      await commitTakeover.promise;
      return ownedByB;
    }, { timeout: 15_000 });
    await enteredTakeover.promise;

    const makeInput = (job: typeof attemptAJob, attemptId: string) => ({
      job: { ...job, attemptId, workerId: attemptId === ATTEMPT_A ? "worker-a" : "worker-b" },
      assetKey: hlsAttemptAssetKey(videoId, job.versionNumber, attemptId),
      hlsBucket: "k17-test-hls",
      posterPath: "/unused-poster.jpg",
      meta: { source: { durationSeconds: 30 } },
      totalBytes: 100,
    });
    const staleActivation = createSelfHlsFinalizer(staleWorkerClient!).finalize(makeInput(attemptAJob, ATTEMPT_A));
    let observedBlockedStaleWorker = false;
    try {
      observedBlockedStaleWorker = await waitUntilStaleActivationWaitsForJobLock();
    } finally {
      commitTakeover.resolve();
    }
    const ownedByB = await takeover;
    if (!observedBlockedStaleWorker) {
      await Promise.allSettled([staleActivation]);
      throw new Error("Stale worker A was not observed waiting on B's PostgreSQL job-row lock");
    }

    await expect(staleActivation).rejects.toThrow();
    const bResult = await createSelfHlsFinalizer(takeoverClient!).finalize(makeInput(ownedByB, ATTEMPT_B));
    const [video, assets, persistedJob] = await Promise.all([
      prisma.video.findUniqueOrThrow({ where: { id: videoId }, include: { activePlaybackRoute: true } }),
      prisma.videoAsset.findMany({ where: { videoId, provider: "SELF_HLS" } }),
      prisma.videoEncodeJob.findUniqueOrThrow({ where: { id: attemptAJob.id } }),
    ]);
    expect(video.activePlaybackRoute?.assetId).toBe(bResult.assetId);
    expect(assets.map(({ objectKey }) => objectKey)).toEqual([hlsAttemptAssetKey(videoId, attemptAJob.versionNumber, ATTEMPT_B)]);
    expect(persistedJob).toMatchObject({ status: "RUNNING", workerId: "worker-b", attemptId: ATTEMPT_B });
  }, 30_000);
});
