import { beforeEach, describe, expect, it, vi } from "vitest";

const { audit } = vi.hoisted(() => ({ audit: vi.fn(async (..._a: unknown[]) => undefined) }));
vi.mock("@/lib/modules/audit", () => ({ recordAuditEvent: audit }));

import { ROUTELESS_ASSET_BATCH, ROUTELESS_ASSET_GRACE_MS, sweepRoutelessReadyAssets } from "@/lib/modules/video-pipeline/application/routeless-asset-sweep.use-case";
import { VIDEO_ASSET_CLEANUP_KIND } from "@/lib/modules/video-pipeline/application/output-cleanup.use-cases";

const NOW = Date.parse("2026-11-20T12:00:00Z");
const A1 = { id: "a1", videoId: "v1", objectKey: "videos/v1/v/v2/attempts/0b1c2d3e-0000-4000-8000-000000000001" };

function setup(over: { candidates?: Array<{ id: string; videoId: string; objectKey: string }>; recheck?: unknown; locked?: unknown[]; reserved?: number; txFails?: boolean } = {}) {
  const tx = {
    $queryRaw: vi.fn(async () => over.locked ?? [{ id: "v1" }]),
    videoAsset: {
      findFirst: vi.fn(async () => (over.recheck === undefined ? { id: "a1", objectKey: A1.objectKey } : over.recheck)),
      updateMany: vi.fn(async () => ({ count: over.reserved ?? 1 })),
    },
    durableJob: { createMany: vi.fn(async () => ({ count: 1 })), updateMany: vi.fn(async () => ({ count: 0 })) },
  };
  const prisma = { videoAsset: { findMany: vi.fn(async () => over.candidates ?? [A1]) } };
  const writeTransaction = vi.fn(async (fn: (t: unknown) => Promise<unknown>) => {
    if (over.txFails) throw new Error("db down");
    return fn(tx);
  });
  const ctx = { prisma, db: { writeTransaction }, actor: { type: "system", reason: "test" }, now: () => new Date(NOW) } as never;
  return { ctx, prisma, tx, writeTransaction };
}
const deps = { now: () => NOW, r2Configured: true };

beforeEach(() => vi.clearAllMocks());

describe("sweepRoutelessReadyAssets", () => {
  it("looks only for READY SELF_HLS assets older than the grace period, never routed, with no queued/running encode", async () => {
    const { ctx, prisma } = setup({ candidates: [] });
    const res = await sweepRoutelessReadyAssets({}, ctx, deps);
    expect(res).toMatchObject({ ok: true, data: { found: 0, queued: 0 } });
    const args = (prisma.videoAsset.findMany.mock.calls[0] as unknown as [{ where: Record<string, unknown>; take: number }])[0];
    expect(args.where).toMatchObject({
      provider: "SELF_HLS",
      processingState: "READY",
      cleanupPendingAt: null,
      playbackRoutes: { none: {} },
      video: { encodeJobs: { none: { status: { in: ["QUEUED", "RUNNING"] } } } },
    });
    expect((args.where.createdAt as { lt: Date }).lt.getTime()).toBe(NOW - ROUTELESS_ASSET_GRACE_MS);
    expect(args.take).toBe(ROUTELESS_ASSET_BATCH);
  });

  it("reserves a candidate and enqueues the regular cleanup job without deleting anything itself", async () => {
    const { ctx, tx } = setup();
    const res = await sweepRoutelessReadyAssets({}, ctx, deps);
    expect(res).toMatchObject({ ok: true, data: { found: 1, queued: 1, skipped: 0, failed: 0, keys: [A1.objectKey] } });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.videoAsset.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "a1", processingState: "READY", cleanupPendingAt: null }),
      data: expect.objectContaining({ processingState: "PROCESSING", cleanupPendingAt: expect.any(Date), isPrimary: false }),
    }));
    expect(tx.durableJob.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ kind: VIDEO_ASSET_CLEANUP_KIND, dedupeKey: "a1", payload: { videoId: "v1", assetId: "a1", objectKey: A1.objectKey } })],
    }));
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "VIDEO_SELF_HLS_ROUTELESS_ASSET_CLEANUP_QUEUED", targetId: "v1" }), tx);
  });

  it("dry run lists candidates and writes nothing", async () => {
    const { ctx, writeTransaction } = setup();
    const res = await sweepRoutelessReadyAssets({ dryRun: true }, ctx, { now: () => NOW });
    expect(res).toMatchObject({ ok: true, data: { found: 1, queued: 0, keys: [A1.objectKey] } });
    expect(writeTransaction).not.toHaveBeenCalled();
  });

  it("skips a candidate that got a route / encode job / other state before the row lock (re-check under lock)", async () => {
    const { ctx, tx } = setup({ recheck: null });
    const res = await sweepRoutelessReadyAssets({}, ctx, deps);
    expect(res).toMatchObject({ ok: true, data: { found: 1, queued: 0, skipped: 1 } });
    expect(tx.videoAsset.updateMany).not.toHaveBeenCalled();
    expect(tx.durableJob.createMany).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("skips when the reservation compare-and-set loses, or the video is gone", async () => {
    const lost = setup({ reserved: 0 });
    expect(await sweepRoutelessReadyAssets({}, lost.ctx, deps)).toMatchObject({ ok: true, data: { queued: 0, skipped: 1 } });
    expect(lost.tx.durableJob.createMany).not.toHaveBeenCalled();
    const gone = setup({ locked: [] });
    expect(await sweepRoutelessReadyAssets({}, gone.ctx, deps)).toMatchObject({ ok: true, data: { queued: 0, skipped: 1 } });
    expect(gone.tx.videoAsset.updateMany).not.toHaveBeenCalled();
  });

  it("leaves an asset with a foreign or malformed key alone", async () => {
    const { ctx, writeTransaction } = setup({ candidates: [{ id: "a9", videoId: "v1", objectKey: "videos/OTHER/v/v1" }, { id: "a8", videoId: "v1", objectKey: "videos/v1/v/v1/../../x" }] });
    const res = await sweepRoutelessReadyAssets({}, ctx, deps);
    expect(res).toMatchObject({ ok: true, data: { found: 2, queued: 0, skipped: 2 } });
    expect(writeTransaction).not.toHaveBeenCalled();
  });

  it("refuses every actor but the system", async () => {
    const { ctx, prisma } = setup();
    const admin = { ...(ctx as object), actor: { type: "admin", userId: "adm" } } as never;
    expect(await sweepRoutelessReadyAssets({}, admin, deps)).toMatchObject({ ok: false, error: { code: "FORBIDDEN", statusCode: 403 } });
    expect(prisma.videoAsset.findMany).not.toHaveBeenCalled();
  });

  it("refuses to reserve anything when R2 is not configured (the job could not finish)", async () => {
    const { ctx, writeTransaction } = setup();
    expect(await sweepRoutelessReadyAssets({}, ctx, { now: () => NOW, r2Configured: false })).toMatchObject({ ok: false, error: { code: "R2_NOT_CONFIGURED" } });
    expect(writeTransaction).not.toHaveBeenCalled();
  });

  it("reports an error when every reservation failed, and continues past one failure otherwise", async () => {
    const allFail = setup({ txFails: true });
    expect(await sweepRoutelessReadyAssets({}, allFail.ctx, deps)).toMatchObject({ ok: false, error: { code: "ROUTELESS_SWEEP_FAILED" } });

    const second = { id: "a2", videoId: "v1", objectKey: "videos/v1/v/v3" };
    const mixed = setup({ candidates: [A1, second], recheck: { id: "a2", objectKey: second.objectKey } });
    let n = 0;
    mixed.writeTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => {
      n += 1;
      if (n === 1) throw new Error("deadlock");
      return fn(mixed.tx);
    });
    expect(await sweepRoutelessReadyAssets({}, mixed.ctx, deps)).toMatchObject({ ok: true, data: { found: 2, queued: 1, failed: 1 } });
  });
});
