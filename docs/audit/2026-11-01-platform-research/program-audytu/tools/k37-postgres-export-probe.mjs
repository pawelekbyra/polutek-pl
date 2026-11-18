#!/usr/bin/env node
/* Synthetic PostgreSQL baseline for the real own-data export query and route-equivalent JSON.
 * Starts one disposable loopback Postgres with tmpfs storage; never reads app env files or connects to an existing service.
 */
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, statfsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const self = fileURLToPath(import.meta.url);
const toolRelative = path.relative(root, self).split(path.sep).join("/");
const categoryRows = 50_000;
const batchSize = 5_000;
const container = `k37-export-${randomBytes(5).toString("hex")}`;
const runId = process.env.K37_RUN_ID || randomBytes(5).toString("hex");
const userId = `k37-${runId}-user`;
const creatorId = `k37-${runId}-creator`;
const videoId = `k37-${runId}-video`;
const database = "k37_export";
const dbPassword = randomBytes(24).toString("base64url");
const scratch = path.join(root, "docs/audit/2026-11-01-platform-research/program-audytu/evidence/k37-postgres-export-2026-11-08");
const evidencePath = path.join(scratch, "result.json");
const MiB = 1024 * 1024;
const childEnv = (url) => ({
  PATH: process.env.PATH,
  NODE_ENV: "test",
  CI: "true",
  APP_ENV: "development",
  DATABASE_URL: url,
  DATABASE_URL_UNPOOLED: url,
  K37_MODE: "seed",
  K37_RUN_ID: runId,
  K37_USER_ID: userId,
  K37_CREATOR_ID: creatorId,
  K37_VIDEO_ID: videoId,
  K37_ROWS: String(categoryRows),
});

function run(args, { env, timeout = 180_000, maxBuffer = 8 * MiB } = {}) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: root,
    env,
    encoding: "utf8",
    timeout,
    maxBuffer,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${args[0]} failed (${result.status}): ${(result.stderr || result.stdout || "").slice(-4000)}`);
  return result.stdout.trim();
}

function docker(...args) {
  return run(["docker", ...args], { timeout: 120_000 });
}

function child(mode, url) {
  return JSON.parse(run([process.execPath, "--import", "tsx", self, mode], {
    env: { ...childEnv(url), K37_MODE: mode },
    timeout: 300_000,
    maxBuffer: 2 * MiB,
  }));
}

async function seedDatabase() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.test`, name: "Synthetic K37 owner" } });
    await prisma.creator.create({ data: { id: creatorId, userId, slug: `${creatorId}-slug`, name: "Synthetic K37 creator" } });
    await prisma.video.create({ data: {
      id: videoId, creatorId, slug: `${videoId}-slug`, title: "Synthetic K37 video", thumbnailUrl: "synthetic-only",
    } });

    const timestamp = new Date("2026-01-01T00:00:00.000Z");
    for (let offset = 0; offset < categoryRows; offset += batchSize) {
      const count = Math.min(batchSize, categoryRows - offset);
      await prisma.comment.createMany({ data: Array.from({ length: count }, (_, index) => ({
        authorId: userId, videoId, text: `Synthetic comment ${offset + index}: ${"x".repeat(180)}`, createdAt: timestamp,
      })) });
      await prisma.videoView.createMany({ data: Array.from({ length: count }, () => ({ userId, videoId, ipHash: "synthetic-hash" })) });
      await prisma.videoPlaybackSession.createMany({ data: Array.from({ length: count }, () => ({
        userId, videoId, sourceKind: "HLS", provider: "SELF_HLS", accessTier: "PUBLIC", startedAt: timestamp,
        firstPlayAt: timestamp, lastHeartbeatAt: timestamp, totalWatchMs: 30_000, maxProgressMs: 15_000,
        durationMs: 120_000, countedAsView: true,
      })) });
      await prisma.videoPlaybackEvent.createMany({ data: Array.from({ length: count }, () => ({
        userId, videoId, type: "PLAY", positionMs: 1_500, durationMs: 120_000, bufferedMs: 4_000,
        volume: 0.5, muted: false, fullscreen: true, provider: "SELF_HLS", sourceKind: "HLS", createdAt: timestamp,
      })) });
    }

    const counts = {
      comments: await prisma.comment.count({ where: { authorId: userId } }),
      videoViews: await prisma.videoView.count({ where: { userId } }),
      playbackSessions: await prisma.videoPlaybackSession.count({ where: { userId } }),
      playbackEvents: await prisma.videoPlaybackEvent.count({ where: { userId } }),
    };
    if (Object.values(counts).some((count) => count !== categoryRows)) throw new Error(`seed counts mismatch: ${JSON.stringify(counts)}`);
    console.log(JSON.stringify({ seeded_rows_per_category: categoryRows, counts }));
  } finally {
    await prisma.$disconnect();
  }
}

async function measureExport() {
  const { PrismaClient } = await import("@prisma/client");
  const { ExportOwnDataUseCase } = await import(path.join(root, "lib/modules/users/application/export-own-data.use-case.ts"));
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    const before = process.memoryUsage();
    const start = process.hrtime.bigint();
    const data = await ExportOwnDataUseCase.execute({ prisma, now: () => new Date("2026-11-07T00:00:00.000Z") }, userId);
    const json = JSON.stringify(data, null, 2);
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const after = process.memoryUsage();
    const maxRssBytes = process.resourceUsage().maxRSS * 1024;
    const counts = {
      comments: data.comments.length,
      videoViews: data.videoViews.length,
      playbackSessions: data.playbackSessions.length,
      playbackEvents: data.playbackEvents.length,
    };
    if (Object.values(counts).some((count) => count !== categoryRows)) throw new Error(`export row counts mismatch: ${JSON.stringify(counts)}`);
    console.log(JSON.stringify({
      rows_per_large_category: categoryRows,
      exported_large_category_rows: Object.values(counts).reduce((sum, count) => sum + count, 0),
      exported_categories: Object.keys(counts),
      counts,
      json_bytes: Buffer.byteLength(json),
      elapsed_ms: Number(elapsedMs.toFixed(2)),
      before_heap_bytes: before.heapUsed,
      after_heap_bytes: after.heapUsed,
      before_rss_bytes: before.rss,
      after_rss_bytes: after.rss,
      process_max_rss_bytes: maxRssBytes,
      max_rss_delta_bytes: Math.max(0, maxRssBytes - before.rss),
    }));
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanupDatabase() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    await prisma.video.deleteMany({ where: { id: videoId } });
    await prisma.creator.deleteMany({ where: { id: creatorId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    const remaining = await prisma.user.count({ where: { id: userId } });
    if (remaining !== 0) throw new Error("synthetic owner remains after cleanup");
    console.log(JSON.stringify({ synthetic_owner_rows_after_cleanup: remaining }));
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode === "seed") return seedDatabase();
  if (mode === "measure") return measureExport();
  if (mode === "cleanup") return cleanupDatabase();

  const scratchStats = statfsSync("/dev/shm");
  const scratchFree = scratchStats.bavail * scratchStats.bsize;
  if (scratchFree < 2 * 1024 ** 3) throw new Error("/dev/shm needs at least 2 GiB free for this disposable database");
  const image = docker("image", "inspect", "postgres:17", "--format", "{{.Id}}\t{{.RepoDigests}}");
  const [imageId, repoDigests] = image.split("\t");
  const startedAt = new Date().toISOString();
  let containerStarted = false;
  let result;
  let seed;
  let cleanup;
  const commands = [];
  let url;

  try {
    docker("run", "--detach", "--name", container,
      "--publish", "127.0.0.1::5432",
      "--tmpfs", "/var/lib/postgresql/data:rw,size=1536m",
      "--tmpfs", "/tmp/k37:rw,size=512m",
      "--env", `POSTGRES_PASSWORD=${dbPassword}`,
      "--env", `POSTGRES_DB=${database}`, "postgres:17");
    containerStarted = true;
    const port = docker("port", container, "5432/tcp").split(/\s+/).at(-1).split(":").at(-1);
    url = `postgresql://postgres:${dbPassword}@127.0.0.1:${port}/${database}?schema=public`;

    let ready = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const probe = spawnSync("docker", ["exec", container, "psql", "-XAt", "-U", "postgres", "-d", database, "-c", "SELECT 1"], {
        cwd: root, encoding: "utf8", timeout: 15_000,
      });
      if (probe.status === 0 && probe.stdout.trim() === "1") { ready = true; break; }
      const running = spawnSync("docker", ["inspect", container, "--format", "{{.State.Running}}"], { cwd: root, encoding: "utf8", timeout: 15_000 });
      if (running.status !== 0 || running.stdout.trim() !== "true") throw new Error("disposable PostgreSQL exited during startup");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error("disposable PostgreSQL did not become query-ready");

    const env = childEnv(url);
    const migrate = run(["npx", "prisma", "migrate", "deploy"], { env, timeout: 600_000 });
    commands.push({ command: "npx prisma migrate deploy", exit_code: 0 });
    const migrationNames = run(["find", "prisma/migrations", "-mindepth", "2", "-maxdepth", "2", "-name", "migration.sql", "-printf", "%h\\n"], { timeout: 30_000 }).split("\n").filter(Boolean);
    const applied = spawnSync("docker", ["exec", container, "psql", "-XAt", "-U", "postgres", "-d", database, "-c", "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL"], { cwd: root, encoding: "utf8", timeout: 30_000 });
    if (applied.status !== 0 || Number(applied.stdout.trim()) !== migrationNames.length) throw new Error(`migration inventory mismatch: expected ${migrationNames.length}, applied ${applied.stdout.trim()}`);
    commands[0].migrations_applied = Number(applied.stdout.trim());

    seed = child("seed", url);
    result = child("measure", url);
    cleanup = child("cleanup", url);
    commands.push({ command: "synthetic seed / verify / cleanup", exit_code: 0 });
  } finally {
    if (containerStarted) docker("rm", "--force", container);
  }

  const evidence = {
    recorded_at_utc: new Date().toISOString(),
    code_sha: run(["git", "rev-parse", "HEAD"], { timeout: 30_000 }),
    tool: toolRelative,
    tool_sha256: createHash("sha256").update(readFileSync(self)).digest("hex"),
    source_sha256: createHash("sha256").update(readFileSync(path.join(root, "lib/modules/users/application/export-own-data.use-case.ts"))).digest("hex"),
    prior_baseline: "k37-export-memory-baseline-2026-11-07.json",
    method: "Seed the four large categories into one disposable PostgreSQL, then in a fresh Node process run the real ExportOwnDataUseCase and the route's exact pretty JSON serialization; report query+serialization elapsed time and process memory.",
    environment: {
      node: process.version,
      postgres_image: "postgres:17",
      postgres_image_id: imageId,
      postgres_repo_digests: repoDigests,
      migrations_applied: commands[0].migrations_applied,
      database: "synthetic disposable PostgreSQL; 127.0.0.1 only",
      pgdata_and_scratch: "container tmpfs",
      rows_per_large_category: categoryRows,
      http: false,
      production_data: false,
      external_services: false,
      container_removed: true,
    },
    provisioning_started_at_utc: startedAt,
    seed,
    result,
    cleanup,
    commands,
    limitations: [
      "The four large tables are synthetic and share one synthetic video; this is not a production data distribution or approved capacity threshold.",
      "The measurement excludes Next HTTP, authentication/rate limiting, network transfer, concurrency, and database backup/restore costs.",
      "Peak RSS is a process high-water mark for one request in a fresh Node process, not the container memory ceiling or concurrent-request limit.",
      "No application or external service was contacted; the disposable database and all rows were removed with its container.",
    ],
  };
  mkdirSync(scratch, { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ evidence: path.relative(root, evidencePath), rows: result.exported_large_category_rows,
    json_bytes: result.json_bytes, elapsed_ms: result.elapsed_ms, process_max_rss_bytes: result.process_max_rss_bytes }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "K37 probe failed"); process.exitCode = 1; });
