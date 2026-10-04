import type { PrismaClient, VideoEncodeJob } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { EncodeJobError, STALE_HEARTBEAT_MS } from "@/lib/modules/video-pipeline/domain/encode-job.state";
import { EncodeJobRepository } from "@/lib/modules/video-pipeline/infrastructure/encode-job.repository";

function job(overrides: Partial<VideoEncodeJob> = {}): VideoEncodeJob {
  return {
    id: "j1", videoId: "v1", originalId: "o1", versionNumber: 1, idempotencyKey: "o1:1", status: "QUEUED", stage: "QUEUED",
    progressPercent: 0, etaSeconds: null, attemptCount: 0, maxAttempts: 3, cancelRequested: false, failureCode: null,
    failureReason: null, nextAttemptAt: null, workerId: null, heartbeatAt: null, startedAt: null, finishedAt: null,
    requestedById: null, assetId: null, sourceInfo: null, result: null, createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
}

function enqueueDb(opts: { active?: VideoEncodeJob | null; generation?: number; maxJobVersion?: number | null; assetKeys?: string[] }) {
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => job({ ...(data as Partial<VideoEncodeJob>) }));
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    videoEncodeJob: {
      findFirst: vi.fn(async () => opts.active ?? null),
      count: vi.fn(async () => (opts.generation ?? 1) - 1),
      aggregate: vi.fn(async () => ({ _max: { versionNumber: opts.maxJobVersion ?? null } })),
      create,
    },
    videoAsset: { findMany: vi.fn(async () => (opts.assetKeys ?? []).map((objectKey) => ({ objectKey }))) },
  };
  const db = { $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) } as unknown as PrismaClient;
  return { db, create, tx };
}

describe("EncodeJobRepository.enqueue", () => {
  it("creates generation 1 / version 1 for a fresh video and serialises on an advisory lock", async () => {
    const { db, create, tx } = enqueueDb({});
    const res = await new EncodeJobRepository(db).enqueue({ videoId: "v1", originalId: "o1", requestedById: "admin" });
    expect(res.created).toBe(true);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({ videoId: "v1", originalId: "o1", versionNumber: 1, idempotencyKey: "o1:1", requestedById: "admin" });
  });

  it("is idempotent for the same original while a job is active", async () => {
    const active = job({ status: "RUNNING", originalId: "o1" });
    const { db, create } = enqueueDb({ active });
    const res = await new EncodeJobRepository(db).enqueue({ videoId: "v1", originalId: "o1", requestedById: null });
    expect(res).toEqual({ job: active, created: false });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a second concurrent encode of a different original", async () => {
    const { db } = enqueueDb({ active: job({ status: "QUEUED", originalId: "other" }) });
    await expect(new EncodeJobRepository(db).enqueue({ videoId: "v1", originalId: "o1", requestedById: null })).rejects.toBeInstanceOf(EncodeJobError);
  });

  it("re-encode takes the next generation and never reuses an HLS version (also from the pilot's asset without a job)", async () => {
    const { db, create } = enqueueDb({ generation: 2, maxJobVersion: 1, assetKeys: ["videos/v1/v/v1", "videos/v1/v/v4"] });
    await new EncodeJobRepository(db).enqueue({ videoId: "v1", originalId: "o1", requestedById: null });
    expect(create.mock.calls[0][0].data).toMatchObject({ versionNumber: 5, idempotencyKey: "o1:2" });
  });
});

describe("EncodeJobRepository.requeueStale", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  const stale = new Date(now.getTime() - STALE_HEARTBEAT_MS - 1000);

  function dbWith(rows: VideoEncodeJob[]) {
    const updateMany = vi.fn(async (_args: { where: unknown; data: Record<string, unknown> }) => ({ count: 1 }));
    const db = { videoEncodeJob: { findMany: vi.fn(async () => rows), updateMany } } as unknown as PrismaClient;
    return { db, updateMany };
  }

  it("requeues an abandoned job that still has attempts left", async () => {
    const { db, updateMany } = dbWith([job({ status: "RUNNING", attemptCount: 1, heartbeatAt: stale, workerId: "dead" })]);
    expect(await new EncodeJobRepository(db).requeueStale(now)).toEqual({ requeued: 1, failed: 0, cancelled: 0 });
    expect(updateMany.mock.calls[0][0]).toMatchObject({ where: { id: "j1", status: "RUNNING", heartbeatAt: stale }, data: { status: "QUEUED", failureCode: "WORKER_LOST", workerId: null } });
  });

  it("fails a job whose attempts are used up", async () => {
    const { db, updateMany } = dbWith([job({ status: "RUNNING", attemptCount: 3, heartbeatAt: stale })]);
    expect(await new EncodeJobRepository(db).requeueStale(now)).toEqual({ requeued: 0, failed: 1, cancelled: 0 });
    expect(updateMany.mock.calls[0][0].data).toMatchObject({ status: "FAILED", failureCode: "WORKER_LOST" });
  });

  it("completes a pending cancel instead of requeueing", async () => {
    const { db, updateMany } = dbWith([job({ status: "RUNNING", cancelRequested: true, heartbeatAt: stale })]);
    expect(await new EncodeJobRepository(db).requeueStale(now)).toEqual({ requeued: 0, failed: 0, cancelled: 1 });
    expect(updateMany.mock.calls[0][0].data).toMatchObject({ status: "CANCELLED" });
  });
});

describe("EncodeJobRepository.requestCancel", () => {
  it("cancels a queued job at once and flags a running one for the worker", async () => {
    const findFirst = vi.fn();
    const updateMany = vi.fn(async (_args: { where: unknown; data: Record<string, unknown> }) => ({ count: 1 }));
    const db = { videoEncodeJob: { findFirst, updateMany } } as unknown as PrismaClient;
    const repo = new EncodeJobRepository(db);

    findFirst.mockResolvedValueOnce(job({ status: "QUEUED" }));
    expect(await repo.requestCancel("j1", "v1")).toBe("cancelled");

    findFirst.mockResolvedValueOnce(job({ status: "RUNNING" }));
    expect(await repo.requestCancel("j1", "v1")).toBe("requested");
    expect(updateMany).toHaveBeenLastCalledWith({ where: { id: "j1", status: "RUNNING" }, data: { cancelRequested: true } });

    findFirst.mockResolvedValueOnce(job({ status: "SUCCEEDED" }));
    expect(await repo.requestCancel("j1", "v1")).toBe("terminal");
    findFirst.mockResolvedValueOnce(null);
    expect(await repo.requestCancel("j1", "v1")).toBe("not_found");
  });
});
