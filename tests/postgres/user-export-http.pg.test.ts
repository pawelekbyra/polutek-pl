import { createHmac, randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const RUN = `user-export-http-${Date.now().toString(36)}`;
const secret = randomBytes(32).toString("base64url");
const token = randomBytes(32).toString("base64url");
const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_URL_UNPOOLED = process.env.DATABASE_URL_UNPOOLED || DATABASE_URL;
const STARTUP_TIMEOUT_MS = 90_000;
let userId = "";
let otherUserId = "";
let creatorId = "";
let memberCreatorId = "";
let videoId = "";
let commentId = "";
let broadcastId = "";
let server: ChildProcess | undefined;
let serverOutput = "";
let baseUrl = "";

function appendServerOutput(chunk: Buffer | string) {
  serverOutput = `${serverOutput}${chunk.toString()}`.slice(-8_000);
}

async function findFreePort(): Promise<number> {
  const listener = net.createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a local test port");
  await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

function sessionCookie(): string {
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  return `pp.session_token=${token}.${signature}`;
}

async function waitForNext(): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let lastStatus: number | undefined;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) {
      throw new Error(`Next dev server exited (${server.exitCode}).\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/user/export`, { signal: AbortSignal.timeout(2_000) });
      lastStatus = response.status;
      if (response.status === 401) return;
    } catch {
      // The dev server may not yet have bound its loopback socket.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Next dev server did not become ready (last HTTP status: ${lastStatus ?? "none"}).\n${serverOutput}`);
}

beforeAll(async () => {
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required for this PostgreSQL integration test");
  userId = `${RUN}-user`;
  otherUserId = `${RUN}-other`;
  await prisma.user.createMany({ data: [
    { id: userId, email: `${RUN}@example.test`, name: "HTTP export owner" },
    { id: otherUserId, email: `${RUN}-other@example.test`, name: "HTTP export other" },
  ] });
  const creator = await prisma.creator.create({ data: { userId, slug: `${RUN}-channel`, name: "HTTP export channel" } });
  creatorId = creator.id;
  const memberCreator = await prisma.creator.create({ data: { userId: otherUserId, slug: `${RUN}-member-channel`, name: "HTTP export member channel" } });
  memberCreatorId = memberCreator.id;
  const video = await prisma.video.create({ data: {
    creatorId, title: "HTTP export video", slug: `${RUN}-video`, thumbnailUrl: "/test.jpg", tier: "PUBLIC",
  } });
  videoId = video.id;
  const ownComment = await prisma.comment.create({ data: { authorId: userId, videoId, text: "http export own marker" } });
  commentId = ownComment.id;
  await prisma.comment.create({ data: { authorId: otherUserId, videoId, text: "http export foreign marker" } });
  await prisma.channelMember.createMany({ data: [
    { channelId: creatorId, userId, role: "OWNER", acceptedAt: new Date("2026-11-01T00:00:00Z") },
    { channelId: memberCreatorId, userId, role: "EDITOR", acceptedAt: new Date("2026-11-02T00:00:00Z") },
  ] });
  await prisma.videoLike.create({ data: { userId, videoId } });
  await prisma.videoDislike.create({ data: { userId: otherUserId, videoId } });
  await prisma.commentReaction.create({ data: { userId, commentId, type: "LIKE" } });
  await prisma.subscription.create({ data: { userId, creatorId: memberCreatorId } });
  await prisma.emailPreference.createMany({ data: [
    { userId, email: `${RUN}@example.test`, marketingEmails: true },
    { userId: otherUserId, email: `${RUN}-other@example.test`, marketingEmails: false },
  ] });
  const broadcast = await prisma.broadcastEmail.create({ data: {
    subjectPl: "Synthetic export campaign", htmlPl: "synthetic-only", subjectEn: "Synthetic export campaign",
    htmlEn: "synthetic-only", createdById: userId,
  } });
  broadcastId = broadcast.id;
  await prisma.broadcastEmailRecipient.create({ data: {
    broadcastEmailId: broadcastId, userId, email: `${RUN}@example.test`, language: "pl", status: "DELIVERED",
    resendEmailId: `${RUN}-provider-secret`, error: "private provider error",
  } });
  await prisma.emailEvent.create({ data: {
    id: `${RUN}-email-event`, type: "delivered", userId, email: `${RUN}@example.test`,
    providerEventId: `${RUN}-provider-event-secret`, payload: { secret: "email-event-payload-secret" },
  } });
  await prisma.payment.createMany({ data: [
    { id: `${RUN}-own-payment`, userId, amountMinor: 1200, currency: "PLN", metadata: { secret: "payment-metadata-secret" } },
    { id: `${RUN}-foreign-payment`, userId: otherUserId, amountMinor: 9900, currency: "PLN" },
  ] });
  await prisma.videoProgress.create({ data: { userId, videoId, positionSeconds: 42, durationSeconds: 120 } });
  await prisma.videoFavorite.create({ data: { userId, videoId } });
  await prisma.videoView.create({ data: { userId, videoId, ipHash: "view-ip-secret" } });
  const playbackSessionId = `${RUN}-playback-session-id-secret`;
  await prisma.videoPlaybackSession.create({ data: {
    id: playbackSessionId, userId, videoId, accessTier: "PUBLIC", ipHash: "session-ip-secret", userAgentHash: "session-ua-secret",
    totalWatchMs: 12000, errorMessage: "private playback message",
  } });
  await prisma.videoPlaybackEvent.create({ data: {
    userId, videoId, type: "PLAY", sessionId: playbackSessionId, metadata: { secret: "playback-metadata-secret" },
    errorMessage: "private playback event message",
  } });
  await prisma.userAvatar.create({ data: { userId, mime: "image/png", data: Buffer.from([0x89, 0x50, 0x4e, 0x47]) } });
  await prisma.channelBanner.create({ data: { channelId: creatorId, mime: "image/webp", data: Buffer.from("RIFFdataWEBP") } });
  await prisma.notificationPreference.create({ data: { userId, newVideoEmail: false } });
  await prisma.notification.create({ data: {
    userId, kind: "NEW_VIDEO", titlePl: "Own notification", titleEn: "Own notification",
    bodyPl: "private body must not export", bodyEn: "private body must not export", params: { secret: "notification-params-secret" },
  } });
  await prisma.patronGrant.create({ data: { userId, source: "STRIPE_TIP", paymentId: `${RUN}-grant-payment`, reason: "grant-reason-secret" } });
  await prisma.appSetting.create({ data: {
    key: `xp.premium_pass:${userId}`,
    value: JSON.stringify({
      v: 3, provider: "DEMO", ref: "pass-reference-secret", productId: "ACCESS_30D", priceMinor: 500,
      totalMinor: 500, currency: "PLN", method: "blik", paymentIds: [`${RUN}-pass-payment-secret`],
      lifetime: false, lifetimePaymentId: null, grantedAt: "2026-11-01T00:00:00.000Z",
      expiresAt: "2026-12-01T00:00:00.000Z", consents: { termsVersion: "draft", waiverAt: "2026-11-01T00:00:00.000Z" },
    }),
  } });
  await prisma.session.create({ data: {
    id: `${RUN}-session`, token, userId, expiresAt: new Date(Date.now() + 60_000),
  } });

  const port = await findFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  const childEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    NODE_ENV: "development",
    DATABASE_URL,
    DATABASE_URL_UNPOOLED,
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: baseUrl,
    NEXT_TELEMETRY_DISABLED: "1",
    UPSTASH_REDIS_REST_URL: "",
    UPSTASH_REDIS_REST_TOKEN: "",
    KV_REST_API_URL: "",
    KV_REST_API_TOKEN: "",
  };
  server = spawn(process.execPath, [path.join(process.cwd(), "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: process.cwd(),
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", appendServerOutput);
  server.stderr?.on("data", appendServerOutput);
  await waitForNext();
}, 120_000);

afterAll(async () => {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        server?.kill("SIGKILL");
        resolve();
      }, 5_000);
      server?.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
  if (userId) {
    await prisma.appSetting.deleteMany({ where: { key: `xp.premium_pass:${userId}` } });
    await prisma.patronGrant.deleteMany({ where: { userId } });
    await prisma.emailEvent.deleteMany({ where: { id: `${RUN}-email-event` } });
    await prisma.emailPreference.deleteMany({ where: { userId: { in: [userId, otherUserId].filter(Boolean) } } });
    await prisma.payment.deleteMany({ where: { id: { in: [`${RUN}-own-payment`, `${RUN}-foreign-payment`] } } });
    await prisma.broadcastEmail.deleteMany({ where: { id: broadcastId } });
  }
  if (videoId) await prisma.video.deleteMany({ where: { id: videoId } });
  if (creatorId || memberCreatorId) await prisma.creator.deleteMany({ where: { id: { in: [creatorId, memberCreatorId].filter(Boolean) } } });
  if (userId || otherUserId) await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId].filter(Boolean) } } });
  await prisma.$disconnect();
});

describe("K27 export route (real local Next HTTP + Better Auth + PostgreSQL)", () => {
  it("exports only the signed-in owner's records and rejects guest or revoked sessions", async () => {
    const guest = await fetch(`${baseUrl}/api/user/export`);
    expect(guest.status).toBe(401);

    const authorized = await fetch(`${baseUrl}/api/user/export`, { headers: { cookie: sessionCookie() } });
    expect(authorized.status).toBe(200);
    expect(authorized.headers.get("cache-control")).toBe("no-store");
    expect(authorized.headers.get("content-disposition")).toMatch(/^attachment; filename="pawelperfect-my-data-/);
    const body = await authorized.json() as {
      schemaVersion: number;
      exportedAt: string;
      account: { id: string };
      comments: Array<{ text: string }>;
      videoReactions: Array<{ videoId: string; type: string }>;
      commentReactions: Array<{ commentId: string; type: string }>;
      subscriptions: Array<{ creatorId: string }>;
      emailPreferences: Array<{ marketingEmails: boolean }>;
      broadcastEmailRecipients: Array<{ language: string; status: string }>;
      emailEvents: Array<{ type: string; status: string }>;
      payments: Array<{ id: string; amountMinor: number; currency: string }>;
      videoProgress: Array<{ videoId: string; positionSeconds: number }>;
      videoFavorites: Array<{ videoId: string }>;
      videoViews: Array<{ videoId: string }>;
      playbackSessions: Array<{ videoId: string; accessTier: string; totalWatchMs: number }>;
      playbackEvents: Array<{ videoId: string; type: string }>;
      creatorProfiles: Array<{ id: string }>;
      channelMemberships: Array<{ channelId: string; role: string }>;
      notificationPreferences: { newVideoEmail: boolean };
      notifications: Array<{ kind: string; read: boolean }>;
      patronGrants: Array<{ source: string }>;
      patronPass: { provider: string; productId: string; totalMinor: number };
      mediaAttachments: Array<{ type: string; ownerId: string }>;
    };
    expect(body.schemaVersion).toBe(4);
    expect(body.account.id).toBe(userId);
    expect(body.comments.map(({ text }) => text)).toEqual(["http export own marker"]);
    expect(body.videoReactions).toEqual([{ videoId, type: "like", createdAt: expect.any(String) }]);
    expect(body.commentReactions).toMatchObject([{ commentId, type: "LIKE" }]);
    expect(body.subscriptions).toMatchObject([{ creatorId: memberCreatorId }]);
    expect(body.emailPreferences).toMatchObject([{ marketingEmails: true }]);
    expect(body.broadcastEmailRecipients).toMatchObject([{ language: "pl", status: "DELIVERED" }]);
    expect(body.emailEvents).toMatchObject([{ type: "delivered", status: "PROCESSED" }]);
    expect(body.payments).toMatchObject([{ id: `${RUN}-own-payment`, amountMinor: 1200, currency: "PLN" }]);
    expect(body.videoProgress).toMatchObject([{ videoId, positionSeconds: 42 }]);
    expect(body.videoFavorites).toMatchObject([{ videoId }]);
    expect(body.videoViews).toMatchObject([{ videoId }]);
    expect(body.playbackSessions).toMatchObject([{ videoId, accessTier: "PUBLIC", totalWatchMs: 12000 }]);
    expect(body.playbackEvents).toMatchObject([{ videoId, type: "PLAY" }]);
    expect(body.creatorProfiles.map(({ id }) => id)).toEqual([creatorId]);
    expect(body.channelMemberships).toHaveLength(2);
    expect(body.channelMemberships).toEqual(expect.arrayContaining([
      expect.objectContaining({ channelId: creatorId, role: "OWNER" }),
      expect.objectContaining({ channelId: memberCreatorId, role: "EDITOR" }),
    ]));
    expect(body.notificationPreferences).toMatchObject({ newVideoEmail: false });
    expect(body.notifications).toMatchObject([{ kind: "NEW_VIDEO", read: false }]);
    expect(body.patronGrants).toMatchObject([{ source: "STRIPE_TIP" }]);
    expect(body.patronPass).toMatchObject({ provider: "DEMO", productId: "ACCESS_30D", totalMinor: 500 });
    expect(body.mediaAttachments).toEqual([
      expect.objectContaining({ type: "avatar", ownerId: userId }),
      expect.objectContaining({ type: "channel_banner", ownerId: creatorId }),
    ]);
    const serialized = JSON.stringify(body);
    for (const marker of [
      "http export foreign marker", "foreign-payment", "provider-secret", "provider-event-secret", "email-event-payload-secret",
      "payment-metadata-secret", "view-ip-secret", "session-ip-secret", "session-ua-secret", "session-id-secret",
      "playback-metadata-secret", "private playback message", "private playback event message", "private body must not export",
      "notification-params-secret", "grant-reason-secret", "grant-payment", "pass-reference-secret", "pass-payment-secret",
    ]) expect(serialized).not.toContain(marker);
    const repeated = await fetch(`${baseUrl}/api/user/export`, { headers: { cookie: sessionCookie() } });
    expect(repeated.status).toBe(200);
    const repeatedBody = await repeated.json() as typeof body;
    expect({ ...repeatedBody, exportedAt: body.exportedAt }).toEqual(body);

    await prisma.session.deleteMany({ where: { token } });
    const revoked = await fetch(`${baseUrl}/api/user/export`, { headers: { cookie: sessionCookie() } });
    expect(revoked.status).toBe(401);
  }, 120_000);
});
