/** K10-T1/T2: hidden-premiere redaction and legal preview behavior over real local Next HTTP. */
import { createHmac, randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const RUN = `k10-http-${Date.now().toString(36)}`;
const secret = randomBytes(32).toString("base64url");
const hlsSecret = randomBytes(32).toString("base64url");
const ownerToken = randomBytes(32).toString("base64url");
const otherToken = randomBytes(32).toString("base64url");
const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_URL_UNPOOLED = process.env.DATABASE_URL_UNPOOLED || DATABASE_URL;
const hiddenTitle = `${RUN} hidden title`;
const hiddenPoster = `https://example.test/${RUN}-hidden.jpg`;
const hiddenDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
let ownerId = "";
let otherId = "";
let creatorId = "";
let hiddenVideoId = "";
let upcomingVideoId = "";
let draftVideoId = "";
let server: ChildProcess | undefined;
let serverOutput = "";
let baseUrl = "";

function appendServerOutput(chunk: Buffer | string) {
  serverOutput = `${serverOutput}${chunk.toString()}`.slice(-8_000)
    .replaceAll(secret, "[auth-secret-redacted]")
    .replaceAll(ownerToken, "[owner-token-redacted]")
    .replaceAll(otherToken, "[other-token-redacted]");
}

async function findFreePort(): Promise<number> {
  const listener = net.createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a local K10 HTTP port");
  await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

function sessionCookie(token: string): string {
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  return `pp.session_token=${token}.${signature}`;
}

async function waitForNext(): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) {
      throw new Error(`K10 Next dev server exited (${server.exitCode}).\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/media-source/${hiddenVideoId}`, { signal: AbortSignal.timeout(2_000) });
      if (response.status === 403) return;
    } catch {
      // Next may still be compiling and binding its loopback socket.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`K10 Next dev server did not become ready.\n${serverOutput}`);
}

async function getPlan(videoId: string, cookie?: string) {
  const response = await fetch(`${baseUrl}/api/media-source/${videoId}`, {
    headers: cookie ? { cookie } : {},
    signal: AbortSignal.timeout(15_000),
  });
  return { response, body: await response.text() };
}

beforeAll(async () => {
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required for this PostgreSQL integration test");
  ownerId = `${RUN}-owner`;
  otherId = `${RUN}-other`;
  await prisma.user.createMany({ data: [
    { id: ownerId, email: `${RUN}-owner@example.test`, name: "K10 channel owner" },
    { id: otherId, email: `${RUN}-other@example.test`, name: "K10 unrelated user" },
  ] });
  const creator = await prisma.creator.create({ data: {
    userId: ownerId, slug: `${RUN}-channel`, name: "K10 HTTP channel", status: "ACTIVE",
  } });
  creatorId = creator.id;

  const hidden = await prisma.video.create({ data: {
    creatorId, title: hiddenTitle, slug: `${RUN}-removed`, thumbnailUrl: hiddenPoster,
    tier: "PUBLIC", status: "PUBLISHED", publishedAt: new Date(), premiereAt: hiddenDate,
    moderationStatus: "REMOVED", subtitleUrlPl: "/secret-caption.vtt",
  } });
  hiddenVideoId = hidden.id;
  const upcoming = await prisma.video.create({ data: {
    creatorId, title: `${RUN} legal premiere`, slug: `${RUN}-upcoming`, thumbnailUrl: `/${RUN}-upcoming.jpg`,
    tier: "PUBLIC", status: "PUBLISHED", publishedAt: new Date(), premiereAt: hiddenDate,
  } });
  upcomingVideoId = upcoming.id;
  const draft = await prisma.video.create({ data: {
    creatorId, title: `${RUN} owner draft preview`, slug: `${RUN}-draft`, thumbnailUrl: `/${RUN}-draft.jpg`,
    tier: "PUBLIC", status: "DRAFT",
  } });
  draftVideoId = draft.id;
  await prisma.videoAsset.createMany({ data: [hiddenVideoId, upcomingVideoId, draftVideoId].map((videoId) => ({
    videoId,
    provider: "SELF_HLS" as const,
    objectKey: `videos/${videoId}/v/v1`,
    bucket: "k10-synthetic-hls",
    processingState: "READY" as const,
    isPrimary: true,
  })) });
  await prisma.session.createMany({ data: [
    { id: `${RUN}-owner-session`, token: ownerToken, userId: ownerId, expiresAt: new Date(Date.now() + 60_000) },
    { id: `${RUN}-other-session`, token: otherToken, userId: otherId, expiresAt: new Date(Date.now() + 60_000) },
  ] });

  const port = await findFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  const databaseUrl = new URL(DATABASE_URL);
  databaseUrl.searchParams.set("application_name", `${RUN}-next`);
  const childEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    NODE_ENV: "development",
    DATABASE_URL: databaseUrl.toString(),
    DATABASE_URL_UNPOOLED,
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: baseUrl,
    NEXT_PUBLIC_APP_URL: baseUrl,
    HLS_TOKEN_SECRET: hlsSecret,
    HLS_DELIVERY_BASE_URL: "https://video.pawelperfect.com",
    NEXT_TELEMETRY_DISABLED: "1",
    UPSTASH_REDIS_REST_URL: "",
    UPSTASH_REDIS_REST_TOKEN: "",
    KV_REST_API_URL: "",
    KV_REST_API_TOKEN: "",
  };
  server = spawn(process.execPath, [path.join(process.cwd(), "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: process.cwd(), env: childEnv, stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", appendServerOutput);
  server.stderr?.on("data", appendServerOutput);
  await waitForNext();
}, 120_000);

afterAll(async () => {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => { server?.kill("SIGKILL"); resolve(); }, 5_000);
      server?.once("exit", () => { clearTimeout(timeout); resolve(); });
    });
  }
  for (const id of [hiddenVideoId, upcomingVideoId, draftVideoId].filter(Boolean)) {
    await prisma.video.deleteMany({ where: { id } });
  }
  if (creatorId) await prisma.creator.deleteMany({ where: { id: creatorId } });
  if (ownerId || otherId) await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId].filter(Boolean) } } });
  await prisma.$disconnect();
});

describe("K10 hidden premiere (real local Next HTTP, Better Auth and PostgreSQL)", () => {
  it("hides removed video metadata from guests and unrelated users who know its ID", async () => {
    for (const cookie of [undefined, sessionCookie(otherToken)]) {
      const { response, body } = await getPlan(hiddenVideoId, cookie);
      expect(response.status).toBe(403);
      expect(body).not.toContain(hiddenTitle);
      expect(body).not.toContain(hiddenPoster);
      expect(body).not.toContain(hiddenDate.toISOString());
      expect(body).not.toContain("secret-caption");
      expect(body).not.toContain("playbackUrl");
      const plan = JSON.parse(body) as { status: string; access: { allowed: boolean; reason: string }; tracking: { playbackSessionId: string } };
      expect(plan).toMatchObject({ status: "UNAVAILABLE", access: { allowed: false, reason: "VIDEO_NOT_FOUND" }, tracking: { playbackSessionId: "" } });
    }
  }, 30_000);

  it("preserves an authorized owner draft preview and the public upcoming premiere gate", async () => {
    const ownerPreview = await getPlan(draftVideoId, sessionCookie(ownerToken));
    expect(ownerPreview.response.status).toBe(200);
    expect(ownerPreview.body).toContain(`${RUN} owner draft preview`);
    const previewPlan = JSON.parse(ownerPreview.body) as { status: string; access: { allowed: boolean }; source?: { provider: string; playbackUrl: string } };
    expect(previewPlan).toMatchObject({ status: "READY", access: { allowed: true }, source: { provider: "SELF_HLS" } });
    expect(previewPlan.source?.playbackUrl).toContain(`/h/`);
    expect(previewPlan.source?.playbackUrl).toContain(draftVideoId);

    const guestPremiere = await getPlan(upcomingVideoId);
    expect(guestPremiere.response.status).toBe(403);
    expect(guestPremiere.body).toContain(`${RUN} legal premiere`);
    expect(guestPremiere.body).not.toContain("playbackUrl");
    expect(JSON.parse(guestPremiere.body)).toMatchObject({ status: "LOGIN_REQUIRED", tracking: { playbackSessionId: "" } });

    const signedInPremiere = await getPlan(upcomingVideoId, sessionCookie(otherToken));
    expect(signedInPremiere.response.status).toBe(403);
    expect(JSON.parse(signedInPremiere.body)).toMatchObject({ status: "COMING_SOON", canPlay: false, access: { allowed: false } });
    expect(signedInPremiere.body).toContain(hiddenDate.toISOString());
    expect(signedInPremiere.body).not.toContain("playbackUrl");
    expect(JSON.parse(signedInPremiere.body).tracking.playbackSessionId).toBe("");
    expect(signedInPremiere.body).not.toContain("/h/");
  }, 30_000);
});
