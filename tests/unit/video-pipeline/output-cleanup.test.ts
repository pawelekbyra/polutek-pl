import { beforeEach, describe, expect, it, vi } from "vitest";

const { audit } = vi.hoisted(() => ({ audit: vi.fn(async (..._a: unknown[]) => undefined) }));
vi.mock("@/lib/modules/channel", () => ({ MainChannelService: { getRequired: async () => ({ id: "chan" }) } }));
vi.mock("@/lib/modules/audit", () => ({ recordAuditEvent: audit }));

import { createVideoAssetCleanupHandler, deleteSelfHlsAsset, purgeVideoStorage, purgeVideoStorageStrict, snapshotVideoStorageInTx, VIDEO_ASSET_CLEANUP_KIND } from "@/lib/modules/video-pipeline/application/output-cleanup.use-cases";

function ctx(over: { status?: string; active?: boolean; asset?: unknown } = {}) {
  const asset = over.asset === undefined ? { id: "a1", objectKey: "videos/v1/v/v2", processingState: "READY" } : over.asset;
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: "v1" }]),
    video: {
      findFirst: vi.fn(async () => ({ id: "v1", status: over.status ?? "DRAFT", activePlaybackRouteId: over.active ? "r1" : null })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    videoAsset: {
      findFirst: vi.fn(async () => asset),
      updateMany: vi.fn(async () => ({ count: 1 })),
      findMany: vi.fn(async () => []),
      delete: vi.fn(async () => ({})),
    },
    videoPlaybackRoute: {
      findFirst: vi.fn(async () => (over.active ? { id: "r1" } : null)),
      update: vi.fn(async () => ({})),
    },
    durableJob: { createMany: vi.fn(async () => ({ count: 1 })), updateMany: vi.fn(async () => ({ count: 0 })) },
  };
  const prisma = {
    ...tx,
  };
  return { prisma, tx, c: { prisma, db: { writeTransaction: (fn: (value: unknown) => Promise<unknown>) => fn(tx) }, actor: { type: "admin", userId: "adm" }, now: () => new Date() } as never };
}

beforeEach(() => vi.clearAllMocks());

describe("deleteSelfHlsAsset", () => {
  it("reserves cleanup and enqueues durable work without deleting objects in the request", async () => {
    const { c, prisma, tx } = ctx();
    const hls = { deletePrefix: vi.fn(async () => 12) };
    expect(await deleteSelfHlsAsset({ videoId: "v1", assetId: "a1" }, c, { hls })).toMatchObject({ ok: true, data: { queued: true } });
    expect(hls.deletePrefix).not.toHaveBeenCalled();
    expect(prisma.videoAsset.delete).not.toHaveBeenCalled();
    expect(tx.videoAsset.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ processingState: "PROCESSING", cleanupPendingAt: expect.any(Date), isPrimary: false }) }));
    expect(tx.durableJob.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ kind: VIDEO_ASSET_CLEANUP_KIND, dedupeKey: "a1" })] }));
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "VIDEO_SELF_HLS_ASSET_DELETION_QUEUED" }), tx);
  });

  it("refuses the version that plays a published video", async () => {
    const { c, prisma } = ctx({ status: "PUBLISHED", active: true });
    const hls = { deletePrefix: vi.fn() };
    expect(await deleteSelfHlsAsset({ videoId: "v1", assetId: "a1" }, c, { hls })).toMatchObject({ ok: false, error: { code: "ASSET_IN_USE" } });
    expect(hls.deletePrefix).not.toHaveBeenCalled();
    expect(prisma.videoAsset.delete).not.toHaveBeenCalled();
  });

  it("detaches an active DRAFT route in the reservation transaction", async () => {
    const { c, tx } = ctx({ active: true, status: "DRAFT" });
    const hls = { deletePrefix: vi.fn() };
    expect(await deleteSelfHlsAsset({ videoId: "v1", assetId: "a1" }, c, { hls })).toMatchObject({ ok: true, data: { queued: true } });
    expect(tx.videoPlaybackRoute.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "r1" }, data: expect.objectContaining({ status: "DISABLED" }) }));
    expect(tx.video.updateMany).toHaveBeenCalledWith({ where: { id: "v1", activePlaybackRouteId: "r1" }, data: { activePlaybackRouteId: null } });
  });

  it("refuses a key that does not match the video, and 404s unknown assets", async () => {
    const hls = { deletePrefix: vi.fn() };
    expect(await deleteSelfHlsAsset({ videoId: "v1", assetId: "a1" }, ctx({ asset: { id: "a1", objectKey: "videos/OTHER/v/v2" } }).c, { hls })).toMatchObject({ ok: false, error: { code: "ASSET_KEY_INVALID" } });
    expect(await deleteSelfHlsAsset({ videoId: "v1", assetId: "a1" }, ctx({ asset: null }).c, { hls })).toMatchObject({ ok: false, error: { code: "ASSET_NOT_FOUND" } });
    expect(hls.deletePrefix).not.toHaveBeenCalled();
  });
});

describe("createVideoAssetCleanupHandler", () => {
  it("removes the reserved prefix and finalizes the asset only after storage confirms deletion", async () => {
    const tx = {
      videoAsset: {
        findFirst: vi.fn(async () => ({ id: "a1", processingState: "PROCESSING", cleanupPendingAt: new Date() })),
        delete: vi.fn(async () => ({})),
      },
    };
    const db = { $transaction: vi.fn(async (fn: (value: unknown) => Promise<unknown>) => fn(tx)) };
    const hls = { deletePrefix: vi.fn(async () => 5) };
    const handler = createVideoAssetCleanupHandler({ db: db as never, hls });
    const result = await handler({
      job: { id: "j1", kind: VIDEO_ASSET_CLEANUP_KIND, dedupeKey: "a1", payload: { videoId: "v1", assetId: "a1", objectKey: "videos/v1/v/v2" }, cursor: null, attempts: 0, token: "lease" },
      shouldYield: () => false,
      checkpoint: async () => undefined,
    });
    expect(result).toBe("done");
    expect(hls.deletePrefix).toHaveBeenCalledWith("videos/v1/v/v2/");
    expect(tx.videoAsset.delete).toHaveBeenCalledWith({ where: { id: "a1" } });
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "VIDEO_SELF_HLS_ASSET_DELETED" }), tx);
  });

  it("keeps the reservation when storage deletion fails so the durable job can retry", async () => {
    const tx = { videoAsset: { findFirst: vi.fn(), delete: vi.fn() } };
    const db = { $transaction: vi.fn(async (fn: (value: unknown) => Promise<unknown>) => fn(tx)) };
    const hls = { deletePrefix: vi.fn(async () => { throw new Error("partial DeleteObjects failure"); }) };
    const handler = createVideoAssetCleanupHandler({ db: db as never, hls });
    await expect(handler({
      job: { id: "j1", kind: VIDEO_ASSET_CLEANUP_KIND, dedupeKey: "a1", payload: { videoId: "v1", assetId: "a1", objectKey: "videos/v1/v/v2" }, cursor: null, attempts: 0, token: "lease" },
      shouldYield: () => false,
      checkpoint: async () => undefined,
    })).rejects.toThrow("partial DeleteObjects failure");
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.videoAsset.delete).not.toHaveBeenCalled();
  });
});

describe("purgeVideoStorage", () => {
  it("deletes own outputs and originals of that video only, and never throws", async () => {
    const hls = { deletePrefix: vi.fn(async () => 5) };
    const originals = { deleteObject: vi.fn(async () => undefined), abort: vi.fn(async () => undefined) };
    const res = await purgeVideoStorage(
      "v1",
      { assetKeys: ["videos/v1/v/v1", "videos/other/v/v1"], originals: [{ objectKey: "originals/v1/1.mp4", uploadId: null, status: "READY" }, { objectKey: "originals/x/2.mp4", uploadId: null, status: "READY" }, { objectKey: "originals/v1/3.mp4", uploadId: "u", status: "UPLOADING" }] },
      { hls, originals },
    );
    expect(hls.deletePrefix).toHaveBeenCalledTimes(1);
    expect(hls.deletePrefix).toHaveBeenCalledWith("videos/v1/v/v1/");
    expect(originals.deleteObject).toHaveBeenCalledTimes(2);
    expect(originals.abort).toHaveBeenCalledWith("originals/v1/3.mp4", "u");
    expect(res).toEqual({ hlsObjects: 5, originals: 2 });
    const boom = { deletePrefix: vi.fn(async () => { throw new Error("r2"); }) };
    await expect(purgeVideoStorage("v1", { assetKeys: ["videos/v1/v/v1"], originals: [] }, { hls: boom, originals: null })).resolves.toEqual({ hlsObjects: 0, originals: 0 });
  });
});

describe("snapshotVideoStorageInTx", () => {
  it("locks the video row first, then lists its own HLS assets and originals", async () => {
    const calls: string[] = [];
    const tx = {
      $executeRaw: vi.fn(async () => { calls.push("lock"); return 1; }),
      videoAsset: { findMany: vi.fn(async () => { calls.push("assets"); return [{ objectKey: "videos/v1/v/v1" }]; }) },
      videoOriginal: { findMany: vi.fn(async () => { calls.push("originals"); return [{ objectKey: "originals/v1/1.mp4", uploadId: null, status: "READY" }]; }) },
    };
    const snapshot = await snapshotVideoStorageInTx(tx as never, "v1");
    expect(calls[0]).toBe("lock");
    expect(snapshot).toEqual({ assetKeys: ["videos/v1/v/v1"], originals: [{ objectKey: "originals/v1/1.mp4", uploadId: null, status: "READY" }] });
  });
});

describe("purgeVideoStorageStrict", () => {
  const snapshot = { assetKeys: ["videos/v1/v/v1", "videos/other/v/v1"], originals: [{ objectKey: "originals/v1/1.mp4", uploadId: null, status: "READY" }, { objectKey: "originals/x/2.mp4", uploadId: null, status: "READY" }] };

  it("removes exactly what purgeVideoStorage removes (this video only) and reports counts", async () => {
    const hls = { deletePrefix: vi.fn(async () => 5) };
    const originals = { deleteObject: vi.fn(async () => undefined), abort: vi.fn(async () => undefined) };
    expect(await purgeVideoStorageStrict("v1", snapshot, { hls, originals })).toEqual({ hlsObjects: 5, originals: 1 });
    expect(hls.deletePrefix).toHaveBeenCalledTimes(1);
    expect(originals.deleteObject).toHaveBeenCalledWith("originals/v1/1.mp4");
  });

  it("throws when R2 refuses, after trying every object, so the durable job retries (the old best-effort purge swallowed this)", async () => {
    const hls = { deletePrefix: vi.fn(async () => { throw new Error("r2 503"); }) };
    const originals = { deleteObject: vi.fn(async () => undefined), abort: vi.fn(async () => undefined) };
    await expect(purgeVideoStorageStrict("v1", snapshot, { hls, originals })).rejects.toThrow(/incomplete.*r2 503/);
    expect(originals.deleteObject).toHaveBeenCalledTimes(1); // the other objects are still removed
  });

  it("throws when storage is not configured but the manifest is not empty; an empty manifest needs no storage", async () => {
    await expect(purgeVideoStorageStrict("v1", snapshot, { hls: null, originals: null })).rejects.toThrow(/not configured/);
    await expect(purgeVideoStorageStrict("v1", { assetKeys: [], originals: [] }, { hls: null, originals: null })).resolves.toEqual({ hlsObjects: 0, originals: 0 });
  });

  it("is safe to repeat: a second run over the same manifest calls the same idempotent deletes", async () => {
    const hls = { deletePrefix: vi.fn(async () => 0) };
    const originals = { deleteObject: vi.fn(async () => undefined), abort: vi.fn(async () => undefined) };
    await purgeVideoStorageStrict("v1", snapshot, { hls, originals });
    await purgeVideoStorageStrict("v1", snapshot, { hls, originals });
    expect(hls.deletePrefix).toHaveBeenCalledTimes(2);
    expect(hls.deletePrefix).toHaveBeenNthCalledWith(1, "videos/v1/v/v1/");
    expect(hls.deletePrefix).toHaveBeenNthCalledWith(2, "videos/v1/v/v1/");
  });
});
