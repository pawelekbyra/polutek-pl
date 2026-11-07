/** K01 local worker acceptance: real PostgreSQL, AWS SDK, FFmpeg and finalizer with synthetic loopback object storage. */
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import net from "node:net";
import { createHmac, randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hlsAttemptAssetKey } from "@/lib/modules/video-pipeline/domain/keys";
import hlsEdgeWorker from "@/workers/hls-edge/worker.mjs";

const prisma = new PrismaClient();
const RUN = `k01-worker-${Date.now().toString(36)}`;
const AUTH_SECRET = randomBytes(32).toString("base64url");
const SESSION_TOKEN = randomBytes(32).toString("base64url");
const STRANGER_SESSION_TOKEN = randomBytes(32).toString("base64url");
const HLS_SECRET = randomBytes(32).toString("base64url");
const ORIGINAL_BUCKET = "k01-originals";
const HLS_BUCKET = "k01-hls";
const objects = new Map<string, Buffer>();
const multipartUploads = new Map<string, { bucket: string; key: string; parts: Map<number, Buffer> }>();
const objectRequests: string[] = [];
let userId = "";
let creatorId = "";
let videoId = "";
let strangerUserId = "";
let strangerCreatorId = "";
let strangerVideoId = "";
let originalId = "";
let endpoint = "";
let sourceDir = "";
let server: ReturnType<typeof createServer> | undefined;
let nextServer: ChildProcess | undefined;
let baseUrl = "";
let nextOutput = "";
const cachedResponses = new Map<string, Response>();
const pendingCacheWrites: Promise<unknown>[] = [];
const previousCaches = (globalThis as unknown as { caches?: unknown }).caches;

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

async function requestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function sendError(response: ServerResponse, status: number, code: string) {
  response.statusCode = status;
  response.setHeader("content-type", "application/xml");
  response.end(`<Error><Code>${code}</Code><Message>${code}</Message></Error>`);
}

async function findFreePort(): Promise<number> {
  const listener = net.createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a K01 HTTP port");
  await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

function sessionCookie(token: string) {
  const signature = createHmac("sha256", AUTH_SECRET).update(token).digest("base64");
  return `pp.session_token=${token}.${signature}`;
}

function ownerCookie() {
  return sessionCookie(SESSION_TOKEN);
}

function strangerCookie() {
  return sessionCookie(STRANGER_SESSION_TOKEN);
}

function appendNextOutput(chunk: Buffer | string) {
  nextOutput = `${nextOutput}${chunk.toString()}`.slice(-8_000)
    .replaceAll(AUTH_SECRET, "[auth-secret-redacted]")
    .replaceAll(SESSION_TOKEN, "[session-token-redacted]")
    .replaceAll(STRANGER_SESSION_TOKEN, "[stranger-session-token-redacted]");
}

async function startNextServer() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for K01 HTTP acceptance");
  const port = await findFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  const databaseUrl = new URL(process.env.DATABASE_URL);
  databaseUrl.searchParams.set("application_name", `${RUN}-next`);
  nextServer = spawn(process.execPath, [
    path.join(process.cwd(), "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port),
  ], {
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl.toString(),
      DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED || databaseUrl.toString(),
      BETTER_AUTH_SECRET: AUTH_SECRET,
      BETTER_AUTH_URL: baseUrl,
      NEXT_PUBLIC_APP_URL: baseUrl,
      HLS_TOKEN_SECRET: HLS_SECRET,
      HLS_DELIVERY_BASE_URL: "https://video.pawelperfect.com",
      NEXT_TELEMETRY_DISABLED: "1",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      KV_REST_API_URL: "",
      KV_REST_API_TOKEN: "",
      CLOUDFLARE_R2_ACCOUNT_ID: "k01-loopback",
      CLOUDFLARE_R2_ACCESS_KEY_ID: "k01-loopback-only",
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: "k01-loopback-only",
      CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS: ORIGINAL_BUCKET,
      VIDEO_WORKER_TEST_S3_ENDPOINT: endpoint,
      VIDEO_WORKER_TEST_RUNTIME: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  nextServer.stdout?.on("data", appendNextOutput);
  nextServer.stderr?.on("data", appendNextOutput);

  const deadline = Date.now() + 90_000;
  let lastStatus: number | undefined;
  while (Date.now() < deadline) {
    if (nextServer.exitCode !== null) throw new Error(`K01 Next server exited (${nextServer.exitCode}).\n${nextOutput}`);
    try {
      const response = await fetch(`${baseUrl}/api/studio/videos/${videoId}/pipeline`, { signal: AbortSignal.timeout(2_000) });
      lastStatus = response.status;
      if (lastStatus === 401) return;
    } catch {
      // Next can still be compiling/binding its loopback listener.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`K01 Next server did not become ready (last HTTP status: ${lastStatus ?? "none"}).\n${nextOutput}`);
}

function startObjectServer() {
  const app = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", endpoint || "http://127.0.0.1");
    objectRequests.push(`${request.method} ${url.pathname}${url.search}`);
    const parts = url.pathname.split("/").filter(Boolean);
    const bucket = decodeURIComponent(parts[0] ?? "");
    const key = decodeURIComponent(parts.slice(1).join("/"));
    const storageKey = `${bucket}/${key}`;
    if (!bucket) return sendError(response, 404, "NoSuchBucket");

    const uploadId = url.searchParams.get("uploadId");
    if (request.method === "POST" && url.searchParams.has("uploads")) {
      const id = randomBytes(12).toString("hex");
      multipartUploads.set(id, { bucket, key, parts: new Map() });
      response.statusCode = 200;
      response.setHeader("content-type", "application/xml");
      return response.end(`<InitiateMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Bucket>${xml(bucket)}</Bucket><Key>${xml(key)}</Key><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`);
    }
    if (uploadId && request.method === "PUT" && url.searchParams.has("partNumber")) {
      const upload = multipartUploads.get(uploadId);
      if (!upload || upload.bucket !== bucket || upload.key !== key) return sendError(response, 404, "NoSuchUpload");
      const partNumber = Number(url.searchParams.get("partNumber"));
      upload.parts.set(partNumber, await requestBody(request));
      response.statusCode = 200;
      response.setHeader("etag", '"k01-local"');
      return response.end();
    }
    if (uploadId && request.method === "GET") {
      const upload = multipartUploads.get(uploadId);
      if (!upload || upload.bucket !== bucket || upload.key !== key) return sendError(response, 404, "NoSuchUpload");
      const partsXml = [...upload.parts.entries()].sort(([a], [b]) => a - b)
        .map(([partNumber, body]) => `<Part><PartNumber>${partNumber}</PartNumber><ETag>"k01-local"</ETag><Size>${body.length}</Size></Part>`).join("");
      response.statusCode = 200;
      response.setHeader("content-type", "application/xml");
      return response.end(`<ListPartsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Bucket>${xml(bucket)}</Bucket><Key>${xml(key)}</Key><UploadId>${uploadId}</UploadId><IsTruncated>false</IsTruncated>${partsXml}</ListPartsResult>`);
    }
    if (uploadId && request.method === "POST") {
      const upload = multipartUploads.get(uploadId);
      if (!upload || upload.bucket !== bucket || upload.key !== key) return sendError(response, 404, "NoSuchUpload");
      const completed = [...upload.parts.entries()].sort(([a], [b]) => a - b).map(([, body]) => body);
      const body = Buffer.concat(completed);
      objects.set(storageKey, body);
      multipartUploads.delete(uploadId);
      response.statusCode = 200;
      response.setHeader("content-type", "application/xml");
      return response.end(`<CompleteMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Bucket>${xml(bucket)}</Bucket><Key>${xml(key)}</Key><ETag>"k01-complete"</ETag></CompleteMultipartUploadResult>`);
    }
    if (uploadId && request.method === "DELETE") {
      multipartUploads.delete(uploadId);
      response.statusCode = 204;
      return response.end();
    }

    if (request.method === "PUT") {
      const body = await requestBody(request);
      objects.set(storageKey, body);
      response.statusCode = 200;
      response.setHeader("etag", '"k01-local"');
      return response.end();
    }
    if (request.method === "HEAD") {
      const body = objects.get(storageKey);
      if (!body) return sendError(response, 404, "NotFound");
      response.statusCode = 200;
      response.setHeader("content-length", body.length);
      response.setHeader("etag", '"k01-local"');
      return response.end();
    }
    if (request.method === "GET" && url.searchParams.get("list-type") === "2") {
      const prefix = url.searchParams.get("prefix") ?? "";
      const entries = [...objects.entries()].filter(([id]) => id.startsWith(`${bucket}/`))
        .map(([id, body]) => [id.slice(bucket.length + 1), body] as const)
        .filter(([objectKey]) => objectKey.startsWith(prefix));
      response.statusCode = 200;
      response.setHeader("content-type", "application/xml");
      return response.end(`<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>${xml(bucket)}</Name><Prefix>${xml(prefix)}</Prefix><KeyCount>${entries.length}</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated>${entries.map(([objectKey, body]) => `<Contents><Key>${xml(objectKey)}</Key><LastModified>2026-11-07T00:00:00.000Z</LastModified><ETag>"k01-local"</ETag><Size>${body.length}</Size><StorageClass>STANDARD</StorageClass></Contents>`).join("")}</ListBucketResult>`);
    }
    if (request.method === "GET") {
      const body = objects.get(storageKey);
      if (!body) return sendError(response, 404, "NoSuchKey");
      response.statusCode = 200;
      response.setHeader("content-length", body.length);
      response.setHeader("content-type", "application/octet-stream");
      response.setHeader("etag", '"k01-local"');
      return response.end(body);
    }
    if (request.method === "POST" && url.searchParams.has("delete")) {
      const body = (await requestBody(request)).toString("utf8");
      const keys = [...body.matchAll(/<Key>([\s\S]*?)<\/Key>/g)].map((match) => match[1]!.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">"));
      for (const objectKey of keys) objects.delete(`${bucket}/${objectKey}`);
      response.statusCode = 200;
      response.setHeader("content-type", "application/xml");
      return response.end(`<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">${keys.map((objectKey) => `<Deleted><Key>${xml(objectKey)}</Key></Deleted>`).join("")}</DeleteResult>`);
    }
    if (request.method === "DELETE") {
      objects.delete(storageKey);
      response.statusCode = 204;
      return response.end();
    }
    return sendError(response, 400, "InvalidRequest");
  });
  return app;
}

async function runWorker(jobId: string): Promise<string> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for K01 worker acceptance");
  const eligible = await prisma.videoEncodeJob.findMany({
    where: { status: "QUEUED", cancelRequested: false, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] },
    select: { id: true },
  });
  if (eligible.length !== 1 || eligible[0]?.id !== jobId) throw new Error("K01 isolated DB must contain only the target eligible job");
  const url = new URL(databaseUrl);
  url.searchParams.set("application_name", `${RUN}-worker`);
  const connection = url.toString();
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    NODE_ENV: "test",
    DATABASE_URL: connection,
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED ? new URL(process.env.DATABASE_URL_UNPOOLED).toString() : connection,
    CLOUDFLARE_R2_ACCOUNT_ID: "k01-loopback",
    CLOUDFLARE_R2_ACCESS_KEY_ID: "k01-loopback-only",
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: "k01-loopback-only",
    CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS: ORIGINAL_BUCKET,
    CLOUDFLARE_R2_BUCKET_HLS: HLS_BUCKET,
    VIDEO_WORKER_TEST_S3_ENDPOINT: endpoint,
    VIDEO_WORKER_WORK_DIR: path.join(sourceDir, "worker-tmp"),
    HLS_PRESET: "ultrafast",
    HLS_NICE: "0",
  };
  const child = spawn(process.execPath, [
    path.join(process.cwd(), "node_modules/tsx/dist/cli.mjs"),
    path.join(process.cwd(), "scripts/video-worker.ts"),
  ], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer | string) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk: Buffer | string) => { stderr += chunk.toString(); });
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  const deadline = Date.now() + 120_000;
  try {
    while (Date.now() < deadline) {
      const persisted = await prisma.videoEncodeJob.findUniqueOrThrow({ where: { id: jobId }, select: { status: true } });
      if (persisted.status === "SUCCEEDED") {
        child.kill("SIGTERM");
        const result = await closed;
        if (result.code !== 0) throw new Error(`K01 worker exited ${result.code ?? result.signal}: ${stderr.slice(-3000)}\n${stdout.slice(-3000)}`);
        return stdout;
      }
      if (persisted.status === "FAILED" || persisted.status === "CANCELLED") {
        child.kill("SIGTERM");
        await closed;
        throw new Error(`K01 worker ended in ${persisted.status}: ${stderr.slice(-3000)}\n${stdout.slice(-3000)}`);
      }
      if (child.exitCode !== null || child.signalCode !== null) {
        const result = await closed;
        throw new Error(`K01 worker exited before job completion (${result.code ?? result.signal}): ${stderr.slice(-3000)}\n${stdout.slice(-3000)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`K01 worker timed out: ${stderr.slice(-3000)}\n${stdout.slice(-3000)}`);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await closed.catch(() => undefined);
    }
  }
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for K01 worker acceptance");
  sourceDir = await mkdtemp(path.join(os.tmpdir(), "k01-video-worker-"));
  const sourcePath = path.join(sourceDir, "source.mp4");
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24", "-t", "6", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", sourcePath], { timeout: 30_000 });

  server = startObjectServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  userId = `${RUN}-user`;
  const user = await prisma.user.create({ data: { id: userId, email: `${RUN}@example.test` } });
  const creator = await prisma.creator.create({ data: { userId: user.id, slug: `${RUN}-creator`, name: "K01 local worker" } });
  creatorId = creator.id;
  const video = await prisma.video.create({ data: { creatorId, title: "K01 synthetic video", slug: `${RUN}-video`, thumbnailUrl: "https://example.test/cover.jpg" } });
  videoId = video.id;
  strangerUserId = `${RUN}-stranger`;
  const stranger = await prisma.user.create({ data: { id: strangerUserId, email: `${RUN}-stranger@example.test` } });
  const strangerCreator = await prisma.creator.create({ data: { userId: stranger.id, slug: `${RUN}-stranger-creator`, name: "K35 foreign channel" } });
  strangerCreatorId = strangerCreator.id;
  const strangerVideo = await prisma.video.create({ data: { creatorId: strangerCreatorId, title: "K35 foreign video", slug: `${RUN}-stranger-video`, thumbnailUrl: "https://example.test/cover.jpg" } });
  strangerVideoId = strangerVideo.id;
  await prisma.session.create({ data: {
    id: `${RUN}-session`, token: SESSION_TOKEN, userId, expiresAt: new Date(Date.now() + 5 * 60_000),
  } });
  await prisma.session.create({ data: {
    id: `${RUN}-stranger-session`, token: STRANGER_SESSION_TOKEN, userId: strangerUserId, expiresAt: new Date(Date.now() + 5 * 60_000),
  } });
  await startNextServer();
}, 150_000);

afterAll(async () => {
  if (nextServer && nextServer.exitCode === null) {
    nextServer.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => { nextServer?.kill("SIGKILL"); resolve(); }, 5_000);
      nextServer?.once("exit", () => { clearTimeout(timeout); resolve(); });
    });
  }
  if (videoId) await prisma.video.deleteMany({ where: { id: videoId } });
  if (strangerVideoId) await prisma.video.deleteMany({ where: { id: strangerVideoId } });
  if (creatorId) await prisma.creator.deleteMany({ where: { id: creatorId } });
  if (strangerCreatorId) await prisma.creator.deleteMany({ where: { id: strangerCreatorId } });
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  if (strangerUserId) await prisma.user.deleteMany({ where: { id: strangerUserId } });
  await prisma.$disconnect();
  if (server) {
    server.closeAllConnections();
    server.close();
    await once(server, "close");
  }
  objects.clear();
  multipartUploads.clear();
  objectRequests.length = 0;
  (globalThis as unknown as { caches?: unknown }).caches = previousCaches;
  cachedResponses.clear();
  if (sourceDir) await rm(sourceDir, { recursive: true, force: true });
});

describe("K01 local worker and short synthetic video (PostgreSQL + FFmpeg + AWS SDK loopback)", () => {
  it("claims, encodes, uploads, verifies, finalizes and activates one complete HLS graph", async () => {
    const guestPipeline = await fetch(`${baseUrl}/api/studio/videos/${videoId}/pipeline`);
    expect(guestPipeline.status).toBe(401);

    const sourceBytes = await import("node:fs/promises").then(({ readFile }) => readFile(path.join(sourceDir, "source.mp4")));
    const crossChannelRequests = await Promise.all([
      fetch(`${baseUrl}/api/studio/videos/${strangerVideoId}/pipeline`, { headers: { cookie: ownerCookie() } }),
      fetch(`${baseUrl}/api/studio/videos/${videoId}/pipeline`, { headers: { cookie: strangerCookie() } }),
      fetch(`${baseUrl}/api/studio/videos/${strangerVideoId}/upload`, {
        method: "POST", headers: { cookie: ownerCookie(), "content-type": "application/json" },
        body: JSON.stringify({ fileName: "source.mp4", fileSize: sourceBytes.length, contentType: "video/mp4" }),
      }),
      fetch(`${baseUrl}/api/studio/videos/${videoId}/upload`, {
        method: "POST", headers: { cookie: strangerCookie(), "content-type": "application/json" },
        body: JSON.stringify({ fileName: "source.mp4", fileSize: sourceBytes.length, contentType: "video/mp4" }),
      }),
    ]);
    for (const response of crossChannelRequests) expect(response.status).toBe(404);
    expect(await prisma.videoOriginal.count({ where: { videoId: { in: [videoId, strangerVideoId] } } })).toBe(0);
    expect(objectRequests).toHaveLength(0);

    const uploadResponse = await fetch(`${baseUrl}/api/studio/videos/${videoId}/upload`, {
      method: "POST", headers: { cookie: ownerCookie(), "content-type": "application/json" },
      body: JSON.stringify({ fileName: "source.mp4", fileSize: sourceBytes.length, contentType: "video/mp4" }),
    });
    const uploadText = await uploadResponse.text();
    expect(uploadResponse.status, `${uploadText}\nS3 requests: ${objectRequests.join(" | ")}\n${nextOutput}`).toBe(200);
    const upload = JSON.parse(uploadText) as { originalId: string; partCount: number; partSize: number };
    originalId = upload.originalId;
    const foreignParts = await fetch(`${baseUrl}/api/studio/videos/${videoId}/upload/parts`, {
      method: "POST", headers: { cookie: strangerCookie(), "content-type": "application/json" },
      body: JSON.stringify({ originalId, partNumbers: [1] }),
    });
    expect(foreignParts.status).toBe(404);
    expect(await prisma.videoOriginal.findUniqueOrThrow({ where: { id: originalId }, select: { status: true } })).toMatchObject({ status: "UPLOADING" });
    const partsResponse = await fetch(`${baseUrl}/api/studio/videos/${videoId}/upload/parts`, {
      method: "POST", headers: { cookie: ownerCookie(), "content-type": "application/json" },
      body: JSON.stringify({ originalId, partNumbers: Array.from({ length: upload.partCount }, (_, index) => index + 1) }),
    });
    const partsText = await partsResponse.text();
    expect(partsResponse.status, `${partsText}\n${nextOutput}`).toBe(200);
    const signed = JSON.parse(partsText) as { urls: Array<{ partNumber: number; url: string }> };
    const completedParts: Array<{ partNumber: number; etag: string }> = [];
    for (const part of signed.urls) {
      const start = (part.partNumber - 1) * upload.partSize;
      const put = await fetch(part.url, { method: "PUT", body: sourceBytes.subarray(start, start + upload.partSize) });
      expect(put.status).toBe(200);
      completedParts.push({ partNumber: part.partNumber, etag: put.headers.get("etag") ?? '"k01-local"' });
    }
    const completeResponse = await fetch(`${baseUrl}/api/studio/videos/${videoId}/upload/complete`, {
      method: "POST", headers: { cookie: ownerCookie(), "content-type": "application/json" },
      body: JSON.stringify({ originalId, parts: completedParts }),
    });
    const completeText = await completeResponse.text();
    expect(completeResponse.status, `${completeText}\n${nextOutput}`).toBe(200);
    expect(objectRequests.some((entry) => entry.startsWith("POST ") && entry.includes("uploads"))).toBe(true);
    expect(objectRequests.some((entry) => entry.startsWith("PUT ") && entry.includes("partNumber"))).toBe(true);
    expect(objectRequests.some((entry) => entry.startsWith("POST ") && entry.includes("uploadId"))).toBe(true);
    const job = await prisma.videoEncodeJob.findFirstOrThrow({ where: { videoId, originalId } });
    const output = await runWorker(job.id);
    expect(output).toContain('"message":"started"');
    expect(output).toContain('"message":"stopped"');
    const [persistedJob, result, routes, assets] = await Promise.all([
      prisma.videoEncodeJob.findUniqueOrThrow({ where: { id: job.id } }),
      prisma.video.findUniqueOrThrow({ where: { id: videoId }, include: { activePlaybackRoute: { include: { asset: true } } } }),
      prisma.videoPlaybackRoute.findMany({ where: { videoId, status: "ACTIVE" } }),
      prisma.videoAsset.findMany({ where: { videoId, provider: "SELF_HLS", processingState: "READY" } }),
    ]);
    expect(persistedJob).toMatchObject({ status: "SUCCEEDED", stage: "DONE", progressPercent: 100 });
    expect(result.activePlaybackRoute?.asset.videoId).toBe(videoId);
    expect(result.activePlaybackRoute?.asset.objectKey).toBe(hlsAttemptAssetKey(videoId, 1, persistedJob.attemptId));
    expect(routes).toHaveLength(1);
    expect(assets).toHaveLength(1);
    const prefix = `${HLS_BUCKET}/${result.activePlaybackRoute!.asset.objectKey}/`;
    const stored = [...objects.keys()].filter((key) => key.startsWith(prefix));
    expect(stored.some((key) => key.endsWith("/master.m3u8"))).toBe(true);
    expect(stored.some((key) => /\/seg_\d+\.m4s$/.test(key))).toBe(true);
    expect(stored.some((key) => key.endsWith("/index.m3u8"))).toBe(true);
    expect(stored.some((key) => key.endsWith("/poster.jpg"))).toBe(true);

    const pipelineResponse = await fetch(`${baseUrl}/api/studio/videos/${videoId}/pipeline`, {
      headers: { cookie: ownerCookie() },
      cache: "no-store",
    });
    const pipelineText = await pipelineResponse.text();
    expect(pipelineResponse.status, `${pipelineText}\n${nextOutput}`).toBe(200);
    const pipeline = JSON.parse(pipelineText) as { job: { status: string; progressPercent: number }; assets: Array<{ versionNumber: number; isActive: boolean }> };
    expect(pipeline).toMatchObject({ job: { status: "SUCCEEDED", progressPercent: 100 }, assets: [{ versionNumber: 1, isActive: true }] });
    expect(pipelineText).not.toContain(ORIGINAL_BUCKET);
    expect(pipelineText).not.toContain(HLS_BUCKET);
    expect(pipelineText).not.toContain("objectKey");

    const guestPlaybackResponse = await fetch(`${baseUrl}/api/media-source/${videoId}`);
    const guestPlaybackText = await guestPlaybackResponse.text();
    expect(guestPlaybackResponse.status).toBe(403);
    expect(guestPlaybackText).not.toContain("playbackUrl");
    const ownerPlaybackResponse = await fetch(`${baseUrl}/api/media-source/${videoId}`, {
      headers: { cookie: ownerCookie() },
      cache: "no-store",
    });
    const ownerPlaybackText = await ownerPlaybackResponse.text();
    expect(ownerPlaybackResponse.status, `${ownerPlaybackText}\n${nextOutput}`).toBe(200);
    const playback = JSON.parse(ownerPlaybackText) as { status: string; access: { allowed: boolean }; source: { provider: string; playbackUrl: string } };
    expect(playback).toMatchObject({ status: "READY", access: { allowed: true }, source: { provider: "SELF_HLS" } });
    expect(playback.source.playbackUrl).toContain(videoId);
    expect(ownerPlaybackText).not.toContain(ORIGINAL_BUCKET);
    expect(ownerPlaybackText).not.toContain(HLS_BUCKET);
    expect(ownerPlaybackText).not.toContain("objectKey");

    (globalThis as unknown as { caches: unknown }).caches = {
      default: {
        async match(request: Request) {
          return cachedResponses.get(new URL(request.url).pathname)?.clone();
        },
        async put(request: Request, response: Response) {
          cachedResponses.set(new URL(request.url).pathname, response.clone());
        },
      },
    };
    const edgeEnv = {
      HLS_TOKEN_SECRET: HLS_SECRET,
      ALLOWED_ORIGINS: "",
      HLS: {
        async get(key: string) {
          const body = objects.get(`${HLS_BUCKET}/${key}`);
          return body ? { body, httpEtag: '"k01-edge"', size: body.length } : null;
        },
        async head(key: string) {
          const body = objects.get(`${HLS_BUCKET}/${key}`);
          return body ? { httpEtag: '"k01-edge"', size: body.length } : null;
        },
      },
    };
    const edgeContext = { waitUntil(promise: Promise<unknown>) { pendingCacheWrites.push(promise); } };
    const masterResponse = await hlsEdgeWorker.fetch(new Request(playback.source.playbackUrl), edgeEnv, edgeContext);
    expect(masterResponse.status).toBe(200);
    const master = await masterResponse.text();
    expect(master).toContain("#EXTM3U");
    const variantPath = master.split(/\r?\n/).find((line) => line.endsWith("/index.m3u8"));
    expect(variantPath).toBeTruthy();
    const variantResponse = await hlsEdgeWorker.fetch(new Request(new URL(variantPath!, playback.source.playbackUrl)), edgeEnv, edgeContext);
    expect(variantResponse.status).toBe(200);
    const variant = await variantResponse.text();
    expect(variant).toContain("#EXTM3U");
    const segmentPath = variant.split(/\r?\n/).find((line) => /\.m4s$/.test(line));
    expect(segmentPath).toBeTruthy();
    const segmentResponse = await hlsEdgeWorker.fetch(new Request(new URL(segmentPath!, new URL(variantPath!, playback.source.playbackUrl))), edgeEnv, edgeContext);
    expect(segmentResponse.status).toBe(200);
    const segment = new Uint8Array(await segmentResponse.arrayBuffer());
    expect(segment.length).toBeGreaterThan(0);
    await Promise.all(pendingCacheWrites);
  }, 150_000);
});
