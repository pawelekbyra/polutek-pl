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
let videoId = "";
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
  const video = await prisma.video.create({ data: {
    creatorId, title: "HTTP export video", slug: `${RUN}-video`, thumbnailUrl: "/test.jpg", tier: "PUBLIC",
  } });
  videoId = video.id;
  await prisma.comment.createMany({ data: [
    { authorId: userId, videoId, text: "http export own marker" },
    { authorId: otherUserId, videoId, text: "http export foreign marker" },
  ] });
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
  if (videoId) await prisma.video.deleteMany({ where: { id: videoId } });
  if (creatorId) await prisma.creator.deleteMany({ where: { id: creatorId } });
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
      account: { id: string };
      comments: Array<{ text: string }>;
    };
    expect(body.schemaVersion).toBe(4);
    expect(body.account.id).toBe(userId);
    expect(body.comments.map(({ text }) => text)).toEqual(["http export own marker"]);

    await prisma.session.deleteMany({ where: { token } });
    const revoked = await fetch(`${baseUrl}/api/user/export`, { headers: { cookie: sessionCookie() } });
    expect(revoked.status).toBe(401);
  }, 120_000);
});
