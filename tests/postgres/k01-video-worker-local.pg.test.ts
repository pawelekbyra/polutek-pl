/** K01 local worker acceptance: real PostgreSQL, AWS SDK, FFmpeg and finalizer with synthetic loopback object storage. */
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hlsAttemptAssetKey } from "@/lib/modules/video-pipeline/domain/keys";

const prisma = new PrismaClient();
const RUN = `k01-worker-${Date.now().toString(36)}`;
const ORIGINAL_BUCKET = "k01-originals";
const HLS_BUCKET = "k01-hls";
const objects = new Map<string, Buffer>();
let userId = "";
let creatorId = "";
let videoId = "";
let originalId = "";
let sourceKey = "";
let endpoint = "";
let sourceDir = "";
let server: ReturnType<typeof createServer> | undefined;
let client: S3Client | undefined;

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

function startObjectServer() {
  const app = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", endpoint || "http://127.0.0.1");
    const parts = url.pathname.split("/").filter(Boolean);
    const bucket = decodeURIComponent(parts[0] ?? "");
    const key = decodeURIComponent(parts.slice(1).join("/"));
    const storageKey = `${bucket}/${key}`;
    if (!bucket) return sendError(response, 404, "NoSuchBucket");

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
  client = new S3Client({ region: "auto", endpoint, forcePathStyle: true, credentials: { accessKeyId: "k01-loopback-only", secretAccessKey: "k01-loopback-only" }, maxAttempts: 1 });

  userId = `${RUN}-user`;
  const user = await prisma.user.create({ data: { id: userId, email: `${RUN}@example.test` } });
  const creator = await prisma.creator.create({ data: { userId: user.id, slug: `${RUN}-creator`, name: "K01 local worker" } });
  creatorId = creator.id;
  const video = await prisma.video.create({ data: { creatorId, title: "K01 synthetic video", slug: `${RUN}-video`, thumbnailUrl: "https://example.test/cover.jpg" } });
  videoId = video.id;
  sourceKey = `originals/${video.id}/source.mp4`;
  const sourceBytes = await import("node:fs/promises").then(({ readFile }) => readFile(sourcePath));
  await client.send(new PutObjectCommand({ Bucket: ORIGINAL_BUCKET, Key: sourceKey, Body: sourceBytes, ContentLength: sourceBytes.length, ContentType: "video/mp4" }));
  const original = await prisma.videoOriginal.create({ data: { videoId: video.id, bucket: ORIGINAL_BUCKET, objectKey: sourceKey, version: 1, status: "READY", sizeBytes: sourceBytes.length } });
  originalId = original.id;
  await prisma.videoEncodeJob.create({ data: {
    videoId: video.id,
    originalId: original.id,
    versionNumber: 1,
    idempotencyKey: `${original.id}:k01-worker-test`,
    status: "QUEUED",
    attemptCount: 0,
    channelId: creator.id,
  } });
});

afterAll(async () => {
  if (videoId) await prisma.video.deleteMany({ where: { id: videoId } });
  if (creatorId) await prisma.creator.deleteMany({ where: { id: creatorId } });
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  await Promise.all([prisma.$disconnect(), client?.destroy()]);
  if (server) {
    server.closeAllConnections();
    server.close();
    await once(server, "close");
  }
  objects.clear();
  if (sourceDir) await rm(sourceDir, { recursive: true, force: true });
});

describe("K01 local worker and short synthetic video (PostgreSQL + FFmpeg + AWS SDK loopback)", () => {
  it("claims, encodes, uploads, verifies, finalizes and activates one complete HLS graph", async () => {
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
  }, 150_000);
});
