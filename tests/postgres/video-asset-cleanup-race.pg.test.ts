/** K19 route activation and HLS asset cleanup reservation on real PostgreSQL rows. */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { DurableJobRepository } from "@/lib/modules/shared/durable-job.repository";

const mocks = vi.hoisted(() => ({ creatorId: "" }));
vi.mock("@/lib/modules/channel", () => ({
  MainChannelService: { getRequired: async () => ({ id: mocks.creatorId, userId: "k19-system", status: "ACTIVE" }) },
}));

import { VideoPlaybackRouteService } from "@/lib/modules/video/application/video-playback-route.service";
import {
  createVideoAssetCleanupHandler,
  deleteSelfHlsAsset,
  VIDEO_ASSET_CLEANUP_KIND,
} from "@/lib/modules/video-pipeline/application/output-cleanup.use-cases";
import { hlsAssetKey } from "@/lib/modules/video-pipeline/domain/keys";
import { runDurableJobs } from "@/lib/modules/shared/durable-job";

const prisma = new PrismaClient();
const RUN = `k19-${Date.now().toString(36)}`;
let userId = "";
let creatorId = "";
const videoIds: string[] = [];
const assetIds: string[] = [];

beforeAll(async () => {
  userId = `${RUN}-user`;
  const user = await prisma.user.create({ data: { id: userId, email: `${RUN}@example.test` } });
  const creator = await prisma.creator.create({ data: { userId: user.id, slug: `${RUN}-creator`, name: "K19 test" } });
  creatorId = creator.id;
  mocks.creatorId = creator.id;
});

afterAll(async () => {
  if (videoIds.length) await prisma.video.deleteMany({ where: { id: { in: videoIds } } });
  if (assetIds.length) await prisma.durableJob.deleteMany({ where: { kind: VIDEO_ASSET_CLEANUP_KIND, dedupeKey: { in: assetIds } } });
  if (creatorId) await prisma.creator.deleteMany({ where: { id: creatorId } });
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

async function fixture(suffix: string, status: "DRAFT" | "PUBLISHED" | "UNLISTED" = "DRAFT") {
  const video = await prisma.video.create({
    data: {
      creatorId,
      title: "K19 cleanup race",
      slug: `${RUN}-${suffix}`,
      thumbnailUrl: "https://example.test/cover.jpg",
      status,
      ...(status === "PUBLISHED" || status === "UNLISTED" ? { publishedAt: new Date() } : {}),
    },
  });
  videoIds.push(video.id);
  const asset = await prisma.videoAsset.create({
    data: {
      videoId: video.id,
      provider: "SELF_HLS",
      objectKey: hlsAssetKey(video.id, 1),
      bucket: "k19-test-hls",
      mimeType: "application/x-mpegURL",
      processingState: "READY",
      isPrimary: false,
    },
  });
  assetIds.push(asset.id);
  return { video, asset };
}

const ctx = () => createAppContext({ prisma, actor: { type: "system", reason: "K19 integration test" } });

describe("K19 video asset cleanup reservation (PostgreSQL)", () => {
  it("cleanup reservation wins the shared video lock and prevents later route activation", async () => {
    const { video, asset } = await fixture("cleanup-first");
    const hls = { deletePrefix: vi.fn(async () => 4) };

    await expect(deleteSelfHlsAsset({ videoId: video.id, assetId: asset.id }, ctx(), { hls })).resolves.toMatchObject({ ok: true, data: { queued: true } });
    await expect(new VideoPlaybackRouteService().activateRoute({ videoId: video.id, assetId: asset.id, activatedBy: "ADMIN" }, ctx())).rejects.toMatchObject({ code: "VIDEO_ASSET_CLEANUP_PENDING" });

    const [reserved, route, job] = await Promise.all([
      prisma.videoAsset.findUniqueOrThrow({ where: { id: asset.id } }),
      prisma.videoPlaybackRoute.findFirst({ where: { videoId: video.id, status: "ACTIVE" } }),
      prisma.durableJob.findFirst({ where: { kind: VIDEO_ASSET_CLEANUP_KIND, dedupeKey: asset.id } }),
    ]);
    expect(reserved.cleanupPendingAt).toBeInstanceOf(Date);
    expect(route).toBeNull();
    expect(job?.status).toBe("PENDING");
    expect(hls.deletePrefix).not.toHaveBeenCalled();
    await expect(prisma.$transaction(async (tx) => tx.videoPlaybackRoute.create({
      data: { videoId: video.id, assetId: asset.id, provider: "SELF_HLS", status: "ACTIVE", activatedBy: "ADMIN" },
    }))).rejects.toThrow(/reserved for cleanup/); // legacy clients are fenced by the database trigger too
    // Keep this scenario focused; the next test drives its own job through the durable runner.
    await prisma.durableJob.deleteMany({ where: { kind: VIDEO_ASSET_CLEANUP_KIND, dedupeKey: asset.id } });
  });

  it.each(["PUBLISHED", "UNLISTED"] as const)("an active %s asset is protected when cleanup follows activation", async (status) => {
    const { video, asset } = await fixture(`active-${status.toLowerCase()}`, status);
    const hls = { deletePrefix: vi.fn(async () => 2) };
    await new VideoPlaybackRouteService().activateRoute({ videoId: video.id, assetId: asset.id, activatedBy: "ADMIN" }, ctx());

    await expect(deleteSelfHlsAsset({ videoId: video.id, assetId: asset.id }, ctx(), { hls })).resolves.toMatchObject({ ok: false, error: { code: "ASSET_IN_USE" } });
    const [persistedVideo, persistedAsset, route, job] = await Promise.all([
      prisma.video.findUniqueOrThrow({ where: { id: video.id } }),
      prisma.videoAsset.findUniqueOrThrow({ where: { id: asset.id } }),
      prisma.videoPlaybackRoute.findFirst({ where: { videoId: video.id, status: "ACTIVE" } }),
      prisma.durableJob.findFirst({ where: { kind: VIDEO_ASSET_CLEANUP_KIND, dedupeKey: asset.id } }),
    ]);
    expect(persistedVideo.activePlaybackRouteId).toBe(route?.id);
    expect(route?.assetId).toBe(asset.id);
    expect(persistedAsset.processingState).toBe("READY");
    expect(job).toBeNull();
    expect(hls.deletePrefix).not.toHaveBeenCalled();
  });

  it("detaches an active DRAFT route and completes crash-safe storage cleanup with a retry after partial deletion", async () => {
    const { video, asset } = await fixture("draft-retry");
    await new VideoPlaybackRouteService().activateRoute({ videoId: video.id, assetId: asset.id, activatedBy: "ADMIN" }, ctx());
    await expect(deleteSelfHlsAsset({ videoId: video.id, assetId: asset.id }, ctx(), { hls: { deletePrefix: vi.fn() } })).resolves.toMatchObject({ ok: true, data: { queued: true } });

    const [reservedVideo, disabledRoute, reservedAsset] = await Promise.all([
      prisma.video.findUniqueOrThrow({ where: { id: video.id } }),
      prisma.videoPlaybackRoute.findFirst({ where: { videoId: video.id } }),
      prisma.videoAsset.findUniqueOrThrow({ where: { id: asset.id } }),
    ]);
    expect(reservedVideo.activePlaybackRouteId).toBeNull();
    expect(disabledRoute?.status).toBe("DISABLED");
    expect(reservedAsset.cleanupPendingAt).toBeInstanceOf(Date);

    let deleteCalls = 0;
    const hls = { deletePrefix: vi.fn(async () => {
      deleteCalls += 1;
      if (deleteCalls === 1) throw new Error("injected partial DeleteObjects failure");
      return 3;
    }) };
    const handler = createVideoAssetCleanupHandler({ db: prisma, hls });
    const store = new DurableJobRepository(prisma);
    const handlers = { [VIDEO_ASSET_CLEANUP_KIND]: handler };
    const failedRun = await runDurableJobs({ store, handlers, maxJobs: 1 });
    expect(failedRun.retried).toBe(1);
    expect(await prisma.videoAsset.findUnique({ where: { id: asset.id } })).toMatchObject({ cleanupPendingAt: expect.any(Date) });

    await prisma.durableJob.updateMany({ where: { kind: VIDEO_ASSET_CLEANUP_KIND, dedupeKey: asset.id }, data: { runAfter: new Date(0) } });
    const recoveredRun = await runDurableJobs({ store, handlers, maxJobs: 1 });
    expect(recoveredRun.done).toBe(1);
    expect(await prisma.videoAsset.findUnique({ where: { id: asset.id } })).toBeNull();
    expect(await prisma.videoPlaybackRoute.findFirst({ where: { videoId: video.id, status: "ACTIVE" } })).toBeNull();
    expect(await prisma.durableJob.findFirst({ where: { kind: VIDEO_ASSET_CLEANUP_KIND, dedupeKey: asset.id } })).toMatchObject({ status: "DONE", attempts: 1 });
    expect(hls.deletePrefix).toHaveBeenCalledTimes(2);
  });
});
