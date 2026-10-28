import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
const pipeline = vi.hoisted(() => ({
  snapshotVideoStorageInTx: vi.fn(async () => ({ assetKeys: ["videos/v1/v/v1"], originals: [{ objectKey: "originals/v1/1.mp4", uploadId: null, status: "READY" }] })),
  purgeVideoStorageStrict: vi.fn(async () => ({ hlsObjects: 1, originals: 1 })),
}));
vi.mock("@/lib/modules/video-pipeline", () => pipeline);
vi.mock("@/lib/modules/media", async () => ({ ...(await vi.importActual<object>("@/lib/modules/media/domain/protected-caption")), R2ThumbnailStorageClient: { isPublicServingConfigured: () => true }, R2CaptionStorageClient: { isConfigured: () => true } }));

import { createStorageCleanupHandler, enqueueStorageCleanupInTx } from "@/lib/modules/admin-content/application/storage-cleanup-job";
import { runDurableJobs } from "@/lib/modules/shared/durable-job";
import { createMemoryJobStore } from "../modules/shared/memory-job-store";

const MANIFEST = {
  videoId: "v1",
  snapshot: { assetKeys: ["videos/v1/v/v1"], originals: [{ objectKey: "originals/v1/1.mp4", uploadId: null, status: "READY" }] },
  publicKeys: ["videos/v1/subtitles/h.vtt"],
};

async function setup(deps: Parameters<typeof createStorageCleanupHandler>[0], payload: unknown = MANIFEST) {
  const store = createMemoryJobStore();
  await store.enqueue({ kind: "STORAGE_CLEANUP", dedupeKey: "v1", payload });
  const run = () => runDurableJobs({ store, handlers: { STORAGE_CLEANUP: createStorageCleanupHandler(deps) }, now: () => store.clock.now });
  return { store, run };
}

describe("enqueueStorageCleanupInTx", () => {
  const makeTx = () => ({ durableJob: { createMany: vi.fn(async () => ({ count: 1 })), updateMany: vi.fn() } });

  it("writes the manifest as a STORAGE_CLEANUP job through the delete transaction (same commit as the delete)", async () => {
    const tx = makeTx();
    await enqueueStorageCleanupInTx(tx as never, "v1", ["videos/v1/subtitles/h.vtt"]);
    expect(pipeline.snapshotVideoStorageInTx).toHaveBeenCalledWith(tx, "v1");
    const row = (tx.durableJob.createMany.mock.calls[0] as any)[0].data[0];
    expect(row).toMatchObject({ kind: "STORAGE_CLEANUP", dedupeKey: "v1", payload: MANIFEST });
  });

  it("enqueues nothing for a video that owns nothing in R2", async () => {
    pipeline.snapshotVideoStorageInTx.mockResolvedValueOnce({ assetKeys: [], originals: [] });
    const tx = makeTx();
    await enqueueStorageCleanupInTx(tx as never, "v1", []);
    expect(tx.durableJob.createMany).not.toHaveBeenCalled();
  });

  it("a failing snapshot propagates, so the delete transaction rolls back and the video is not deleted without a manifest", async () => {
    pipeline.snapshotVideoStorageInTx.mockRejectedValueOnce(new Error("db"));
    await expect(enqueueStorageCleanupInTx(makeTx() as never, "v1", [])).rejects.toThrow("db");
  });
});

describe("storage clean-up job", () => {
  it("removes HLS, originals and our subtitle files from the manifest, then finishes", async () => {
    const deletePublic = vi.fn(async () => undefined);
    const purge = vi.fn(async () => ({ hlsObjects: 1, originals: 1 }));
    const { store, run } = await setup({ purge, publicStorage: { isConfigured: () => true, deletePublic } });
    expect(await run()).toMatchObject({ done: 1 });
    expect(purge).toHaveBeenCalledWith("v1", MANIFEST.snapshot);
    expect(deletePublic).toHaveBeenCalledWith("videos/v1/subtitles/h.vtt");
    expect(store.jobs[0].status).toBe("DONE");
  });

  it("keeps the job and retries with backoff while R2 refuses; finishes once R2 recovers (nothing is forgotten)", async () => {
    const purge = vi.fn().mockRejectedValueOnce(new Error("r2 503")).mockResolvedValue({ hlsObjects: 1, originals: 1 });
    const { store, run } = await setup({ purge, publicStorage: { isConfigured: () => true, deletePublic: async () => undefined } });
    expect(await run()).toMatchObject({ retried: 1, done: 0 });
    expect(store.jobs[0]).toMatchObject({ status: "PENDING", attempts: 1, lastError: "r2 503" });
    expect((await run()).claimed).toBe(0); // backoff not over
    store.clock.now = store.jobs[0].runAfter;
    expect(await run()).toMatchObject({ done: 1 });
    expect(purge).toHaveBeenCalledTimes(2);
  });

  it("a failed subtitle delete also fails the run, and the repeat is idempotent", async () => {
    const deletePublic = vi.fn().mockRejectedValueOnce(new Error("nope")).mockResolvedValue(undefined);
    const { store, run } = await setup({ purge: async () => ({ hlsObjects: 0, originals: 0 }), publicStorage: { isConfigured: () => true, deletePublic } });
    expect(await run()).toMatchObject({ retried: 1 });
    store.clock.now = store.jobs[0].runAfter;
    expect(await run()).toMatchObject({ done: 1 });
  });

  it("fails (and retries) when public storage is not configured but there are subtitle files to remove", async () => {
    const { store, run } = await setup({ purge: async () => ({ hlsObjects: 0, originals: 0 }), publicStorage: { isConfigured: () => false, deletePublic: vi.fn() } });
    expect(await run()).toMatchObject({ retried: 1 });
    expect(store.jobs[0].lastError).toMatch(/not configured/);
  });

  it("never deletes a public key outside /subtitles/", async () => {
    const deletePublic = vi.fn(async () => undefined);
    const { run } = await setup(
      { purge: async () => ({ hlsObjects: 0, originals: 0 }), publicStorage: { isConfigured: () => true, deletePublic } },
      { ...MANIFEST, publicKeys: ["videos/v1/thumb.jpg", "videos/v1/subtitles/h.vtt"] },
    );
    await run();
    expect(deletePublic).toHaveBeenCalledTimes(1);
    expect(deletePublic).toHaveBeenCalledWith("videos/v1/subtitles/h.vtt");
  });

  it("an unreadable manifest is an error, not a silent success", async () => {
    const { store, run } = await setup({ purge: vi.fn() }, { nonsense: true });
    expect(await run()).toMatchObject({ retried: 1 });
    expect(store.jobs[0].lastError).toMatch(/Invalid storage clean-up manifest/);
  });

  describe("private caption files", () => {
    const VID = "c52f0407-b0e8-4b5c-b6d3-a9f152653002";
    const KEY = `videos/${VID}/captions/pl-${"a".repeat(64)}.vtt`;
    const manifest = { videoId: VID, snapshot: { assetKeys: [], originals: [] }, publicKeys: [], captionKeys: [KEY] };

    it("deletes the private caption keys of the manifest (and only keys of this video's caption folder)", async () => {
      const deleteCaption = vi.fn(async () => undefined);
      const { store, run } = await setup(
        { purge: async () => ({ hlsObjects: 0, originals: 0 }), captionStorage: { isConfigured: () => true, deleteCaption } },
        { ...manifest, captionKeys: [KEY, `videos/${VID}/v/v1/master.m3u8`, `videos/other-video-id/captions/pl-${"a".repeat(64)}.vtt`] },
      );
      expect(await run()).toMatchObject({ done: 1 });
      expect(deleteCaption).toHaveBeenCalledTimes(1);
      expect(deleteCaption).toHaveBeenCalledWith(VID, KEY);
      expect(store.jobs[0].status).toBe("DONE");
    });

    it("retries while the private store refuses, and fails when it is not configured", async () => {
      const deleteCaption = vi.fn().mockRejectedValueOnce(new Error("503")).mockResolvedValue(undefined);
      const { store, run } = await setup({ purge: async () => ({ hlsObjects: 0, originals: 0 }), captionStorage: { isConfigured: () => true, deleteCaption } }, manifest);
      expect(await run()).toMatchObject({ retried: 1 });
      store.clock.now = store.jobs[0].runAfter;
      expect(await run()).toMatchObject({ done: 1 });

      const off = await setup({ purge: async () => ({ hlsObjects: 0, originals: 0 }), captionStorage: { isConfigured: () => false, deleteCaption: vi.fn() } }, manifest);
      expect(await off.run()).toMatchObject({ retried: 1 });
      expect(off.store.jobs[0].lastError).toMatch(/not configured/);
    });

    it("a manifest written before captions became private still works", async () => {
      const { run } = await setup({ purge: async () => ({ hlsObjects: 0, originals: 0 }), publicStorage: { isConfigured: () => true, deletePublic: async () => undefined } });
      expect(await run()).toMatchObject({ done: 1 });
    });

    it("enqueues a manifest that has only caption keys", async () => {
      pipeline.snapshotVideoStorageInTx.mockResolvedValueOnce({ assetKeys: [], originals: [] });
      const tx = { durableJob: { createMany: vi.fn(async () => ({ count: 1 })), updateMany: vi.fn() } };
      await enqueueStorageCleanupInTx(tx as never, VID, [], [KEY]);
      const row = (tx.durableJob.createMany.mock.calls[0] as any)[0].data[0];
      expect(row.payload).toMatchObject({ videoId: VID, publicKeys: [], captionKeys: [KEY] });
    });
  });
});
