/** K20 proves the publication state check against PostgreSQL, including a status change at the transaction boundary. */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/modules/video/application/sync-public-thumbnail.service", () => ({
  syncPublicThumbnail: vi.fn().mockResolvedValue("skipped"),
}));
vi.mock("@/lib/modules/video/application/announce-published-video", () => ({
  announcePublishedVideo: vi.fn().mockResolvedValue(undefined),
  enqueuePublishedVideoAnnouncement: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/modules/video/application/ready-visibility", () => ({
  clearReadyVisibility: vi.fn().mockResolvedValue(undefined),
}));

import { createAppContext } from "@/lib/modules/shared/app-context";
import { publishAdminVideo } from "@/lib/modules/video/application/publish-admin-video.use-case";

const prisma = new PrismaClient();
const RUN = `k20-publish-race-${Date.now().toString(36)}`;
let userId = "";
let creatorId = "";
let videoId = "";
let assetId = "";

beforeAll(async () => {
  const user = await prisma.user.create({ data: { id: `${RUN}-user`, email: `${RUN}@example.test` } });
  userId = user.id;
  const creator = await prisma.creator.create({
    data: { userId, slug: RUN, name: "K20 publish race", status: "ACTIVE" },
  });
  creatorId = creator.id;
  const video = await prisma.video.create({
    data: {
      creatorId,
      title: "K20 publication race",
      slug: `${RUN}-video`,
      thumbnailUrl: "https://example.test/k20.jpg",
      duration: "0:30",
      tier: "PUBLIC",
    },
  });
  videoId = video.id;
  const asset = await prisma.videoAsset.create({
    data: {
      videoId,
      provider: "SELF_HLS",
      objectKey: `videos/${videoId}/v/v1`,
      bucket: "k20-test-hls",
      processingState: "READY",
      isPrimary: true,
    },
  });
  assetId = asset.id;
  const route = await prisma.videoPlaybackRoute.create({
    data: { videoId, assetId, provider: "SELF_HLS", status: "ACTIVE" },
  });
  await prisma.video.update({ where: { id: videoId }, data: { activePlaybackRouteId: route.id } });
});

afterAll(async () => {
  if (videoId) await prisma.video.deleteMany({ where: { id: videoId } });
  if (assetId) await prisma.videoAsset.deleteMany({ where: { id: assetId } });
  if (creatorId) await prisma.creator.deleteMany({ where: { id: creatorId } });
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("K20 publication channel-state fence (PostgreSQL)", () => {
  it("refuses a channel suspended after preflight and before the publication transaction", async () => {
    let changedStatusAtBoundary = false;
    const prismaAtBoundary = new Proxy(prisma, {
      get(target, property, receiver) {
        if (property === "$transaction") {
          return async (callback: (tx: any) => Promise<any>) => {
            await target.creator.update({ where: { id: creatorId }, data: { status: "SUSPENDED" } });
            changedStatusAtBoundary = true;
            return target.$transaction(callback);
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const ctx = createAppContext({
      prisma: prismaAtBoundary,
      actor: { type: "system", reason: "k20_postgres_race_test" },
      channelId: creatorId,
    });

    const result = await publishAdminVideo(videoId, ctx);

    expect(changedStatusAtBoundary).toBe(true);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CHANNEL_NOT_APPROVED");
    expect((await prisma.video.findUniqueOrThrow({ where: { id: videoId } })).status).toBe("DRAFT");
  });
});
