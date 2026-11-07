/** K17 lock-order regression: stale worker A waits on activation while a real DB transaction takes over as B. */
import { spawn } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
const PROCESS_TIMEOUT_MS = 20_000;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function waitUntilStaleProcessWaitsForJobLock(): Promise<boolean> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const [row] = await prisma.$queryRaw<Array<{ waiting: bigint }>>`
      SELECT COUNT(*) AS waiting
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND application_name = ${`${RUN}-attempt-a`}
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

function runWorkerProcess(mode: "stale" | "current", jobId: string, applicationName: string): Promise<string> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for K17 worker-process test");
  const url = new URL(databaseUrl);
  url.searchParams.set("application_name", applicationName);
  const connection = url.toString();
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    NODE_ENV: "test",
    DATABASE_URL: connection,
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED
      ? new URL(process.env.DATABASE_URL_UNPOOLED).toString()
      : connection,
    K17_JOB_ID: jobId,
    K17_MODE: mode,
  };
  const child = spawn(process.execPath, [
    path.join(process.cwd(), "node_modules/tsx/dist/cli.mjs"),
    path.join(process.cwd(), "tests/helpers/k17-finalize-self-hls-process.ts"),
  ], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      fn();
    };
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new Error(`K17 ${mode} worker process timed out for job ${jobId}`)));
    }, PROCESS_TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer | string) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer | string) => { stderr += chunk.toString(); });
    child.once("error", (error) => finish(() => reject(error)));
    child.once("close", (code) => {
      if (code !== 0) return finish(() => reject(new Error(`K17 ${mode} worker failed (${code}): ${stderr.slice(-1200)}`)));
      finish(() => resolve(stdout));
    });
  });
}

beforeAll(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for this PostgreSQL integration test");
  const makeNamedUrl = (applicationName: string) => {
    const url = new URL(databaseUrl);
    url.searchParams.set("application_name", applicationName);
    return url.toString();
  };
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
  await Promise.all([prisma.$disconnect(), takeoverClient?.$disconnect()]);
});

describe("K17 stale worker takeover race (separate processes and PostgreSQL sessions)", () => {
  it("makes process A wait at B's job-row lock, then rejects A while process B alone activates", async () => {
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

    const staleProcess = runWorkerProcess("stale", attemptAJob.id, `${RUN}-attempt-a`);
    let observedBlockedStaleWorker = false;
    try {
      observedBlockedStaleWorker = await waitUntilStaleProcessWaitsForJobLock();
    } finally {
      commitTakeover.resolve();
    }
    const ownedByB = await takeover;
    if (!observedBlockedStaleWorker) {
      await Promise.allSettled([staleProcess]);
      throw new Error("Worker process A was not observed waiting on B's PostgreSQL job-row lock");
    }

    await expect(staleProcess).resolves.toContain("K17_STALE_ATTEMPT_REJECTED");
    const currentOutput = await runWorkerProcess("current", ownedByB.id, `${RUN}-attempt-b`);
    const bAssetId = /K17_FINALIZED=([^\r\n]+)/.exec(currentOutput)?.[1];
    expect(bAssetId).toBeTruthy();
    const [video, assets, persistedJob] = await Promise.all([
      prisma.video.findUniqueOrThrow({ where: { id: videoId }, include: { activePlaybackRoute: true } }),
      prisma.videoAsset.findMany({ where: { videoId, provider: "SELF_HLS" } }),
      prisma.videoEncodeJob.findUniqueOrThrow({ where: { id: attemptAJob.id } }),
    ]);
    expect(video.activePlaybackRoute?.assetId).toBe(bAssetId);
    expect(assets.map(({ objectKey }) => objectKey)).toEqual([hlsAttemptAssetKey(videoId, attemptAJob.versionNumber, ATTEMPT_B)]);
    expect(persistedJob).toMatchObject({ status: "RUNNING", workerId: "worker-b", attemptId: ATTEMPT_B });
  }, 30_000);
});
