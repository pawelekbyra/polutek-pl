import { beforeEach, describe, expect, it, vi } from "vitest";

const { audit } = vi.hoisted(() => ({ audit: vi.fn(async (..._a: unknown[]) => undefined) }));
vi.mock("@/lib/modules/channel", () => ({ MainChannelService: { getRequired: async () => ({ id: "chan" }) } }));
vi.mock("@/lib/modules/audit", () => ({ recordAuditEvent: audit }));

import { deleteSelfHlsAsset, purgeVideoStorage, purgeVideoStorageStrict, snapshotVideoStorageInTx } from "@/lib/modules/video-pipeline/application/output-cleanup.use-cases";

function ctx(over: { status?: string; active?: boolean; asset?: unknown } = {}) {
  const asset = over.asset === undefined ? { id: "a1", objectKey: "videos/v1/v/v2" } : over.asset;
  const prisma = {
    video: { findFirst: vi.fn(async () => ({ id: "v1", title: "t", status: over.status ?? "DRAFT", activeOriginalId: null })), updateMany: vi.fn(async () => ({})) },
    videoAsset: { findFirst: vi.fn(async () => asset), delete: vi.fn(async () => ({})) },
    videoPlaybackRoute: { findFirst: vi.fn(async () => (over.active ? { id: "r1" } : null)) },
  };
  return { prisma, c: { prisma, actor: { type: "admin", userId: "adm" }, now: () => new Date() } as never };
}

beforeEach(() => vi.clearAllMocks());

describe("deleteSelfHlsAsset", () => {
  it("removes the R2 prefix and the asset row", async () => {
    const { c, prisma } = ctx();
    const hls = { deletePrefix: vi.fn(async () => 12) };
    expect(await deleteSelfHlsAsset({ videoId: "v1", assetId: "a1" }, c, { hls })).toMatchObject({ ok: true, data: { removedObjects: 12 } });
    expect(hls.deletePrefix).toHaveBeenCalledWith("videos/v1/v/v2/");
    expect(prisma.videoAsset.delete).toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "VIDEO_SELF_HLS_ASSET_DELETED" }));
  });

  it("refuses the version that plays a published video", async () => {
    const { c, prisma } = ctx({ status: "PUBLISHED", active: true });
    const hls = { deletePrefix: vi.fn() };
    expect(await deleteSelfHlsAsset({ videoId: "v1", assetId: "a1" }, c, { hls })).toMatchObject({ ok: false, error: { code: "ASSET_IN_USE" } });
    expect(hls.deletePrefix).not.toHaveBeenCalled();
    expect(prisma.videoAsset.delete).not.toHaveBeenCalled();
  });

  it("refuses a key that does not match the video, and 404s unknown assets", async () => {
    const hls = { deletePrefix: vi.fn() };
    expect(await deleteSelfHlsAsset({ videoId: "v1", assetId: "a1" }, ctx({ asset: { id: "a1", objectKey: "videos/OTHER/v/v2" } }).c, { hls })).toMatchObject({ ok: false, error: { code: "ASSET_KEY_INVALID" } });
    expect(await deleteSelfHlsAsset({ videoId: "v1", assetId: "a1" }, ctx({ asset: null }).c, { hls })).toMatchObject({ ok: false, error: { code: "ASSET_NOT_FOUND" } });
    expect(hls.deletePrefix).not.toHaveBeenCalled();
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
