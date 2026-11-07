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

function runWorker(jobId: string): Promise<string> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for K01 worker acceptance");
  const url = new URL(databaseUrl);
  url.searchParams.set("application_name", `${RUN}-worker`);
  const connection = url.toString();
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    NODE_ENV: "test",
    DATABASE_URL: connection,
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED ? new URL(process.env.DATABASE_URL_UNPOOLED).toString() : connection,
    K01_JOB_ID: jobId,
    K01_S3_ENDPOINT: endpoint,
    K01_ORIGINAL_BUCKET: ORIGINAL_BUCKET,
    K01_HLS_BUCKET: HLS_BUCKET,
    K01_WORK_ROOT: path.join(sourceDir, "worker-tmp"),
  };
  const child = spawn(process.execPath, [
    path.join(process.cwd(), "node_modules/tsx/dist/cli.mjs"),
    path.join(process.cwd(), "tests/helpers/k01-video-worker-process.ts"),
  ], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => child.kill("SIGKILL"), 120_000);
    child.stdout.on("data", (chunk: Buffer | string) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer | string) => { stderr += chunk.toString(); });
    child.once("error", (error) => { clearTimeout(timeout); reject(error); });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(`K01 worker process failed (${code}): ${stderr.slice(-3000)}\n${stdout.slice(-3000)}`));
      resolve(stdout);
    });
  });
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
    expect(output).toContain('K01_WORKER_RESULT=["succeeded"]');
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
