/** K23-T1: publish over HTTP, SIGKILL the app after COMMIT before fan-out can claim, restart, recover by cron HTTP. */
import { createHmac, randomBytes } from "node:crypto";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const RUN = `k23-http-${Date.now().toString(36)}`;
const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_URL_UNPOOLED = process.env.DATABASE_URL_UNPOOLED || DATABASE_URL;
const authSecret = randomBytes(32).toString("base64url");
const cronSecret = randomBytes(32).toString("base64url");
const lockedBy = `k23-gate-${randomBytes(8).toString("hex")}`;
const PROCESS_START_TIMEOUT_MS = 90_000;
const PROCESS_STOP_TIMEOUT_MS = 10_000;
let ownerId = "";
let subscriberId = "";
let creatorId = "";
let videoId = "";
let assetId = "";
let triggerInstalled = false;
let sessionCookie = "";
const servers: ChildProcess[] = [];
const outputs = new Map<ChildProcess, string>();
const serverUrls = new Map<ChildProcess, string>();

function signedCookie(token: string): string {
  const signature = createHmac("sha256", authSecret).update(token).digest("base64");
  return `pp.session_token=${token}.${signature}`;
}

function safeOutput(server: ChildProcess): string {
  return (outputs.get(server) ?? "")
    .replaceAll(authSecret, "[auth-secret-redacted]")
    .replaceAll(cronSecret, "[cron-secret-redacted]")
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgresql://[credentials-redacted]@")
    .slice(-3_000);
}

async function findFreePort(): Promise<number> {
  const listener = net.createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Could not select a loopback port for K23 HTTP test");
  await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function startNext(instance: number): Promise<{ server: ChildProcess; url: string }> {
  const port = await findFreePort();
  const url = `http://127.0.0.1:${port}`;
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required for this PostgreSQL integration test");
  const databaseUrl = new URL(DATABASE_URL);
  databaseUrl.searchParams.set("application_name", `${RUN}-next-${instance}`);
  const runtimeDbUrl = databaseUrl.toString();
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    NODE_ENV: "development",
    DATABASE_URL: runtimeDbUrl,
    DATABASE_URL_UNPOOLED: DATABASE_URL_UNPOOLED,
    BETTER_AUTH_SECRET: authSecret,
    BETTER_AUTH_URL: url,
    NEXT_PUBLIC_APP_URL: url,
    CRON_SECRET: cronSecret,
    K23_HTTP_TEST_RUN: RUN,
    NEXT_TELEMETRY_DISABLED: "1",
    UPSTASH_REDIS_REST_URL: "",
    UPSTASH_REDIS_REST_TOKEN: "",
    KV_REST_API_URL: "",
    KV_REST_API_TOKEN: "",
  };
  const server = spawn(process.execPath, [
    path.join(process.cwd(), "node_modules/next/dist/bin/next"),
    "dev", "--hostname", "127.0.0.1", "--port", String(port),
  ], { cwd: process.cwd(), env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  servers.push(server);
  outputs.set(server, "");
  serverUrls.set(server, url);
  const append = (chunk: Buffer | string) => {
    outputs.set(server, `${outputs.get(server) ?? ""}${chunk.toString()}`.slice(-8_000));
  };
  server.stdout?.on("data", append);
  server.stderr?.on("data", append);

  const deadline = Date.now() + PROCESS_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Next instance ${instance} exited (${server.exitCode}).\n${safeOutput(server)}`);
    try {
      const response = await fetch(`${url}/api/cron/premiere-notifications`, { signal: AbortSignal.timeout(2_000) });
      if (response.status === 401) return { server, url };
    } catch {
      // Next may still be compiling/binding its loopback socket.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Next instance ${instance} did not become ready.\n${safeOutput(server)}`);
}

async function killProcessGroup(server: ChildProcess): Promise<void> {
  const pid = server.pid;
  if (!pid) return;
  const processRows = execFileSync("ps", ["-eo", "pid=,ppid="], { encoding: "utf8" })
    .trim()
    .split("\n")
    .map((row) => row.trim().split(/\s+/).map(Number))
    .filter(([processId, parentId]) => Number.isInteger(processId) && Number.isInteger(parentId));
  const descendants = new Set<number>();
  let frontier = [pid];
  while (frontier.length > 0) {
    const children = processRows.filter(([, parentId]) => frontier.includes(parentId)).map(([processId]) => processId);
    children.forEach((childPid) => descendants.add(childPid));
    frontier = children;
  }
  const taggedProcesses = processRows.map(([processId]) => processId).filter((processId) => {
    try { return readFileSync(`/proc/${processId}/environ`).includes(`K23_HTTP_TEST_RUN=${RUN}`); }
    catch { return false; }
  });
  for (const childPid of [...new Set([...descendants, ...taggedProcesses])].reverse()) {
    try { process.kill(childPid, "SIGKILL"); } catch { /* The child may already have exited. */ }
  }
  try { process.kill(-pid, "SIGKILL"); } catch { /* The process group may already have exited. */ }
  await new Promise<void>((resolve) => {
    if (server.exitCode !== null || server.signalCode !== null) return resolve();
    const timeout = setTimeout(() => resolve(), 5_000);
    server.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
  const url = serverUrls.get(server);
  if (!url) return;
  const deadline = Date.now() + PROCESS_STOP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await fetch(`${url}/api/cron/premiere-notifications`, { signal: AbortSignal.timeout(500) });
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch {
      return;
    }
  }
  throw new Error(`Next instance did not stop accepting requests after process-group SIGKILL: ${url}`);
}

beforeAll(async () => {
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required for this PostgreSQL integration test");
  ownerId = `${RUN}-owner`;
  subscriberId = `${RUN}-subscriber`;
  const now = new Date();
  await prisma.user.createMany({ data: [
    { id: ownerId, email: `${RUN}-owner@example.test`, name: "K23 HTTP owner" },
    { id: subscriberId, email: `${RUN}-subscriber@example.test`, name: "K23 HTTP subscriber" },
  ] });
  const creator = await prisma.creator.create({ data: { userId: ownerId, slug: RUN, name: "K23 HTTP channel", status: "ACTIVE" } });
  creatorId = creator.id;
  await prisma.channelMember.create({ data: { channelId: creatorId, userId: ownerId, role: "OWNER", acceptedAt: now } });
  await prisma.subscription.create({ data: { creatorId, userId: subscriberId, notify: true } });
  const video = await prisma.video.create({ data: {
    creatorId,
    title: "K23 HTTP crash recovery",
    slug: `${RUN}-video`,
    thumbnailUrl: "https://example.test/k23-http.jpg",
    duration: "0:30",
    tier: "PUBLIC",
  } });
  videoId = video.id;
  const asset = await prisma.videoAsset.create({ data: {
    videoId,
    provider: "SELF_HLS",
    objectKey: `videos/${videoId}/v/v1/attempts/k23-http-test`,
    bucket: "k23-test-hls",
    processingState: "READY",
    isPrimary: true,
  } });
  assetId = asset.id;
  const route = await prisma.videoPlaybackRoute.create({ data: { videoId, assetId, provider: "SELF_HLS", status: "ACTIVE" } });
  await prisma.video.update({ where: { id: videoId }, data: { activePlaybackRouteId: route.id } });
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({ data: {
    id: `${RUN}-session`, token, userId: ownerId, expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  } });

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION k23_test_gate_new_video_fanout() RETURNS trigger AS $$
    BEGIN
      IF NEW."kind" = 'NEW_VIDEO_FANOUT' THEN
        NEW."lockedBy" := '${lockedBy}';
        NEW."lockedUntil" := (now() AT TIME ZONE 'UTC') + interval '1 hour';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER k23_test_gate_new_video_fanout
    BEFORE INSERT ON "DurableJob"
    FOR EACH ROW EXECUTE FUNCTION k23_test_gate_new_video_fanout()
  `);
  triggerInstalled = true;
  // Keep the cookie fixture local to this test process and pass only the signed value to the browser request.
  sessionCookie = signedCookie(token);
});

afterAll(async () => {
  for (const server of [...servers].reverse()) await killProcessGroup(server);
  sessionCookie = "";
  if (triggerInstalled) {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS k23_test_gate_new_video_fanout ON "DurableJob"');
    await prisma.$executeRawUnsafe("DROP FUNCTION IF EXISTS k23_test_gate_new_video_fanout()");
  }
  if (videoId) await prisma.durableJob.deleteMany({ where: { kind: "NEW_VIDEO_FANOUT", dedupeKey: videoId } });
  if (videoId) await prisma.video.deleteMany({ where: { id: videoId } });
  if (assetId) await prisma.videoAsset.deleteMany({ where: { id: assetId } });
  if (creatorId) await prisma.creator.deleteMany({ where: { id: creatorId } });
  if (ownerId || subscriberId) await prisma.user.deleteMany({ where: { id: { in: [ownerId, subscriberId].filter(Boolean) } } });
  await prisma.$disconnect();
});

describe("K23 publication crash recovery (real Next HTTP + PostgreSQL)", () => {
  it("kills the publishing server after commit and recovers the announcement through cron HTTP after restart", async () => {
    const first = await startNext(1);
    const publish = await fetch(`${first.url}/api/studio/videos/${videoId}/publish`, {
      method: "POST",
      headers: {
        cookie: sessionCookie,
        origin: first.url,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: "publish" }),
      signal: AbortSignal.timeout(30_000),
    });
    const publishedBody = await publish.json() as { status?: string; error?: string };
    expect(publish.status, JSON.stringify(publishedBody)).toBe(200);
    expect(publishedBody.status).toBe("PUBLISHED");

    const intent = await prisma.durableJob.findUniqueOrThrow({
      where: { kind_dedupeKey: { kind: "NEW_VIDEO_FANOUT", dedupeKey: videoId } },
    });
    expect(intent).toMatchObject({ status: "PENDING", lockedBy, payload: { variant: "publish" } });
    expect(await prisma.video.findUniqueOrThrow({ where: { id: videoId } })).toMatchObject({ status: "PUBLISHED" });
    expect(await prisma.notification.count({ where: { videoId, userId: subscriberId, kind: "NEW_VIDEO" } })).toBe(0);

    // The injected future lease kept the first server's best-effort kick from consuming the durable intent.
    // Killing its whole process group now creates the actual post-COMMIT/pre-fan-out crash boundary.
    await killProcessGroup(first.server);
    expect(first.server.signalCode).toBe("SIGKILL");
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS k23_test_gate_new_video_fanout ON "DurableJob"');
    await prisma.$executeRawUnsafe("DROP FUNCTION IF EXISTS k23_test_gate_new_video_fanout()");
    triggerInstalled = false;
    await prisma.durableJob.update({ where: { id: intent.id }, data: { lockedBy: null, lockedUntil: null } });

    const restarted = await startNext(2);
    const cronHeaders = { authorization: `Bearer ${cronSecret}` };
    const recovered = await fetch(`${restarted.url}/api/cron/premiere-notifications`, { headers: cronHeaders, signal: AbortSignal.timeout(30_000) });
    expect(recovered.status).toBe(200);
    const recoveredBody = await recovered.json() as { fanOut?: { claimed?: number; done?: number; retried?: number; dead?: number } };
    expect(recoveredBody.fanOut).toMatchObject({ claimed: 1, done: 1, retried: 0, dead: 0 });
    expect(await prisma.durableJob.findUniqueOrThrow({ where: { id: intent.id } })).toMatchObject({ status: "DONE" });
    expect(await prisma.notification.count({ where: { videoId, userId: subscriberId, kind: "NEW_VIDEO" } })).toBe(1);

    const repeated = await fetch(`${restarted.url}/api/cron/premiere-notifications`, { headers: cronHeaders });
    expect(repeated.status).toBe(200);
    expect(await prisma.notification.count({ where: { videoId, userId: subscriberId, kind: "NEW_VIDEO" } })).toBe(1);
  }, 180_000);
});
