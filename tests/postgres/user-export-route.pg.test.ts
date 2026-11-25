import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma as appPrisma } from "@/lib/prisma";

const authState = vi.hoisted(() => ({ actor: { type: "guest" as "guest" | "user", userId: "" } }));
const rateLimitMock = vi.hoisted(() => vi.fn(async () => ({ success: true })));

vi.mock("@/lib/api/auth", () => ({ getActorFromAuth: vi.fn(async () => authState.actor) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));

import { GET as exportGet } from "@/app/api/user/export/route";

const prisma = new PrismaClient();
const RUN = `user-export-${Date.now().toString(36)}`;
let userId = "";
let otherUserId = "";
let ownCreatorId = "";
let otherCreatorId = "";
let ownVideoId = "";
let otherVideoId = "";

beforeAll(async () => {
  userId = `${RUN}-user`;
  otherUserId = `${RUN}-other`;
  await prisma.user.createMany({ data: [
    { id: userId, email: `${RUN}@example.test`, name: "Export owner" },
    { id: otherUserId, email: `${RUN}-other@example.test`, name: "Other account" },
  ] });
  const ownCreator = await prisma.creator.create({ data: { userId, slug: `${RUN}-own`, name: "Own creator" } });
  const otherCreator = await prisma.creator.create({ data: { userId: otherUserId, slug: `${RUN}-other`, name: "Other creator" } });
  ownCreatorId = ownCreator.id;
  otherCreatorId = otherCreator.id;
  const ownVideo = await prisma.video.create({ data: {
    creatorId: ownCreatorId, title: "Own video", slug: `${RUN}-own-video`, thumbnailUrl: "/own.jpg", tier: "PUBLIC",
  } });
  const otherVideo = await prisma.video.create({ data: {
    creatorId: otherCreatorId, title: "Other video", slug: `${RUN}-other-video`, thumbnailUrl: "/other.jpg", tier: "PUBLIC",
  } });
  ownVideoId = ownVideo.id;
  otherVideoId = otherVideo.id;

  await prisma.comment.createMany({ data: [
    { authorId: userId, videoId: ownVideoId, text: "own export comment" },
    { authorId: otherUserId, videoId: otherVideoId, text: "foreign export comment" },
  ] });
  await prisma.videoView.createMany({ data: [
    { userId, videoId: ownVideoId, ipHash: "own-network-hash" },
    { userId: otherUserId, videoId: otherVideoId, ipHash: "foreign-network-hash" },
  ] });
  await prisma.videoPlaybackSession.createMany({ data: [
    { userId, videoId: ownVideoId, accessTier: "PUBLIC", ipHash: "own-ip-hash", userAgentHash: "own-ua-hash", totalWatchMs: 23_000 },
    { userId: otherUserId, videoId: otherVideoId, accessTier: "PUBLIC", ipHash: "foreign-ip-hash", userAgentHash: "foreign-ua-hash", totalWatchMs: 88_000 },
  ] });
  await prisma.videoPlaybackEvent.createMany({ data: [
    { userId, videoId: ownVideoId, type: "PLAY", positionMs: 1200, metadata: { private: "excluded" }, errorMessage: "excluded" },
    { userId: otherUserId, videoId: otherVideoId, type: "PLAY", positionMs: 9400 },
  ] });
  await prisma.userAvatar.create({ data: { userId, mime: "image/png", data: Buffer.from([0x89, 0x50, 0x4e, 0x47]) } });
  await prisma.channelBanner.create({ data: { channelId: ownCreatorId, mime: "image/webp", data: Buffer.from("RIFFdataWEBP") } });
  await prisma.channelMember.create({ data: { userId, channelId: ownCreatorId, role: "OWNER", acceptedAt: new Date() } });
  await prisma.notificationPreference.create({ data: { userId, newVideoEmail: false } });
  await prisma.notification.create({ data: {
    userId, kind: "NEW_VIDEO", titlePl: "Own notification", titleEn: "Own notification", bodyPl: "Private message", bodyEn: "Private message",
  } });
  await prisma.patronGrant.create({ data: { userId, source: "STRIPE_TIP", paymentId: `${RUN}-payment`, reason: "must not export" } });
  await prisma.appSetting.create({ data: { key: `xp.premium_pass:${userId}`, value: "not a valid pass record" } });
});

afterAll(async () => {
  if (userId) await prisma.appSetting.deleteMany({ where: { key: `xp.premium_pass:${userId}` } });
  if (userId || otherUserId) await prisma.patronGrant.deleteMany({ where: { userId: { in: [userId, otherUserId].filter(Boolean) } } });
  if (ownVideoId || otherVideoId) await prisma.video.deleteMany({ where: { id: { in: [ownVideoId, otherVideoId].filter(Boolean) } } });
  if (ownCreatorId || otherCreatorId) await prisma.creator.deleteMany({ where: { id: { in: [ownCreatorId, otherCreatorId].filter(Boolean) } } });
  if (userId || otherUserId) await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId].filter(Boolean) } } });
  await prisma.$disconnect();
  await appPrisma.$disconnect();
});

describe("K27 self-service export route (PostgreSQL)", () => {
  it("returns only account-owned records from real PostgreSQL as a no-store JSON download", async () => {
    authState.actor = { type: "user", userId };
    const response = await exportGet(new NextRequest("https://www.pawelperfect.com/api/user/export"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toContain("pawelperfect-my-data-");
    const body = await response.json();
    expect(body).toMatchObject({ schemaVersion: 4, account: { id: userId } });
    expect(body.comments.map((row: { text: string }) => row.text)).toEqual(["own export comment"]);
    expect(body.videoViews).toHaveLength(1);
    expect(body.videoViews[0]).not.toHaveProperty("ipHash");
    expect(body.playbackSessions).toHaveLength(1);
    expect(body.playbackSessions[0]).not.toHaveProperty("ipHash");
    expect(body.playbackSessions[0]).not.toHaveProperty("userAgentHash");
    expect(body.playbackEvents).toHaveLength(1);
    expect(body.playbackEvents[0]).not.toHaveProperty("metadata");
    expect(body.playbackEvents[0]).not.toHaveProperty("errorMessage");
    expect(body.creatorProfiles.map((row: { id: string }) => row.id)).toEqual([ownCreatorId]);
    expect(body.mediaAttachments).toHaveLength(2);
    expect(body.channelMemberships).toHaveLength(1);
    expect(body.notificationPreferences).toMatchObject({ newVideoEmail: false });
    expect(body.notifications).toMatchObject([{ kind: "NEW_VIDEO", read: false }]);
    expect(body.patronGrants).toEqual([{ source: "STRIPE_TIP", createdAt: expect.any(String), revokedAt: null }]);
    expect(body.patronPass).toBeNull();
    expect(JSON.stringify(body)).not.toContain("foreign export comment");
    expect(JSON.stringify(body)).not.toContain("must not export");
    expect(JSON.stringify(body)).not.toContain("own-network-hash");
    expect(JSON.stringify(body)).not.toContain("own-ip-hash");
    expect(JSON.stringify(body)).not.toContain(`${RUN}-payment`);

    const repeated = await exportGet(new NextRequest("https://www.pawelperfect.com/api/user/export"));
    expect(repeated.status).toBe(200);
    expect((await repeated.json()).comments).toEqual(body.comments);
  });

  it("rejects guest access before invoking the rate limiter", async () => {
    authState.actor = { type: "guest", userId: "" };
    rateLimitMock.mockClear();
    const response = await exportGet(new NextRequest("https://www.pawelperfect.com/api/user/export"));

    expect(response.status).toBe(401);
    expect(rateLimitMock).not.toHaveBeenCalled();
  });
});
