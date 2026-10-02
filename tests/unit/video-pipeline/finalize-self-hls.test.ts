import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { PrismaClient, VideoEncodeJob } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { activateRoute, attemptPublish, syncThumb, putPrivate } = vi.hoisted(() => ({
  activateRoute: vi.fn(),
  attemptPublish: vi.fn(async (..._args: unknown[]) => undefined),
  syncThumb: vi.fn(async (..._args: unknown[]) => "promoted"),
  putPrivate: vi.fn(async (..._args: unknown[]) => ({ key: "k", storageUrl: "https://acc.r2.cloudflarestorage.com/priv/k.jpg" })),
}));

vi.mock("@/lib/modules/video", () => ({
  VideoPlaybackRouteService: class { activateRoute = activateRoute; },
  attemptPublishAfterAssetReady: attemptPublish,
  syncPublicThumbnailById: syncThumb,
}));
vi.mock("@/lib/modules/media", () => ({
  R2ThumbnailStorageClient: class {
    static isConfigured() { return true; }
    putPrivate = putPrivate;
  },
}));

import { createSelfHlsFinalizer } from "@/lib/modules/video-pipeline/application/finalize-self-hls";

const job = { id: "job-1", videoId: "v1", versionNumber: 3 } as unknown as VideoEncodeJob;
let dir: string;
let posterPath: string;

beforeEach(async () => {
  vi.clearAllMocks();
  activateRoute.mockResolvedValue({ id: "route-1" });
  dir = await mkdtemp(path.join(os.tmpdir(), "fin-"));
  posterPath = path.join(dir, "poster.jpg");
  await writeFile(posterPath, "jpg");
});
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

function prismaStub(video: Record<string, unknown>, existingAsset: { id: string } | null = null) {
  return {
    videoAsset: {
      findFirst: vi.fn(async () => existingAsset),
      create: vi.fn(async () => ({ id: "asset-new" })),
      delete: vi.fn(async () => ({})),
    },
    video: { findUnique: vi.fn(async () => video), update: vi.fn(async () => ({})) },
  } as unknown as PrismaClient & { videoAsset: { create: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }; video: { update: ReturnType<typeof vi.fn> } };
}

const input = (extra = {}) => ({ job, assetKey: "videos/v1/v/v3", hlsBucket: "polutek-hls", posterPath, meta: { source: { durationSeconds: 125 } }, totalBytes: 5000, ...extra });

describe("createSelfHlsFinalizer", () => {
  it("creates a READY SELF_HLS asset, moves the route, fills thumbnail+duration for a bare draft and asks for auto-publish", async () => {
    const prisma = prismaStub({ id: "v1", status: "DRAFT", thumbnailUrl: "/logo.png", duration: null });
    const res = await createSelfHlsFinalizer(prisma).finalize(input());
    expect(res).toEqual({ assetId: "asset-new" });
    expect(prisma.videoAsset.create.mock.calls[0][0].data).toMatchObject({ provider: "SELF_HLS", objectKey: "videos/v1/v/v3", bucket: "polutek-hls", processingState: "READY", isPrimary: false });
    expect(activateRoute).toHaveBeenCalledWith(expect.objectContaining({ videoId: "v1", assetId: "asset-new", activatedBy: "POLICY" }), expect.anything());
    expect(prisma.video.update.mock.calls[0][0].data).toEqual({ duration: "2:05", thumbnailUrl: "https://acc.r2.cloudflarestorage.com/priv/k.jpg" });
    expect(attemptPublish).toHaveBeenCalledWith("v1", expect.anything(), "SELF_HLS");
    expect(syncThumb).not.toHaveBeenCalled(); // draft: nothing public to sync
  });

  it("never overwrites a thumbnail the admin chose or an existing duration", async () => {
    const prisma = prismaStub({ id: "v1", status: "PUBLISHED", thumbnailUrl: "https://acc.r2.cloudflarestorage.com/priv/custom.jpg", duration: "9:99" });
    await createSelfHlsFinalizer(prisma).finalize(input());
    expect(putPrivate).not.toHaveBeenCalled();
    expect(prisma.video.update).not.toHaveBeenCalled();
  });

  it("syncs the public thumbnail copy when the video is already published", async () => {
    const prisma = prismaStub({ id: "v1", status: "PUBLISHED", thumbnailUrl: "", duration: "1:00" });
    await createSelfHlsFinalizer(prisma).finalize(input());
    expect(syncThumb).toHaveBeenCalledWith("v1", expect.anything());
  });

  it("reuses the asset of an earlier attempt instead of creating a duplicate", async () => {
    const prisma = prismaStub({ id: "v1", status: "DRAFT", thumbnailUrl: "x", duration: "1:00" }, { id: "asset-old" });
    expect(await createSelfHlsFinalizer(prisma).finalize(input())).toEqual({ assetId: "asset-old" });
    expect(prisma.videoAsset.create).not.toHaveBeenCalled();
  });

  it("removes the asset it just created when the route cannot be activated", async () => {
    const prisma = prismaStub({ id: "v1", status: "DRAFT", thumbnailUrl: "x", duration: "1:00" });
    activateRoute.mockRejectedValueOnce(new Error("cannot serve tier"));
    await expect(createSelfHlsFinalizer(prisma).finalize(input())).rejects.toThrow("cannot serve tier");
    expect(prisma.videoAsset.delete).toHaveBeenCalledWith({ where: { id: "asset-new" } });
    expect(attemptPublish).not.toHaveBeenCalled();
  });

  it("does not fail the job when the auto-publish step throws", async () => {
    const prisma = prismaStub({ id: "v1", status: "DRAFT", thumbnailUrl: "x", duration: "1:00" });
    attemptPublish.mockRejectedValueOnce(new Error("blocker"));
    await expect(createSelfHlsFinalizer(prisma).finalize(input())).resolves.toEqual({ assetId: "asset-new" });
  });
});
