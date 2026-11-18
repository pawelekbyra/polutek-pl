#!/usr/bin/env node
/* Synthetic baseline for app-side own-data export and route-equivalent JSON.stringify.
 * No database, project env, API server, production data or external service is used. */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const self = fileURLToPath(import.meta.url);
const sizes = [0, 10_000, 50_000, 100_000];
const MiB = 1024 * 1024;

function sampleRows(count, make) {
  return Array.from({ length: count }, (_, i) => make(i));
}

async function runSample(count) {
  const { ExportOwnDataUseCase } = await import(path.join(root, "lib/modules/users/application/export-own-data.use-case.ts"));
  const timestamp = (i) => new Date(Date.UTC(2026, 0, 1) + i * 1000);
  const comments = sampleRows(count, (i) => ({ id: `comment-${i}`, videoId: `video-${i % 1000}`, parentId: null,
    text: `Synthetic comment ${i}: ${"x".repeat(180)}`, imageUrl: null, status: "VISIBLE", createdAt: timestamp(i), editedAt: null, deletedAt: null }));
  const views = sampleRows(count, (i) => ({ videoId: `video-${i % 1000}`, createdAt: timestamp(i) }));
  const sessions = sampleRows(count, (i) => ({ videoId: `video-${i % 1000}`, sourceKind: "HLS", provider: "SELF_HLS",
    accessTier: "PUBLIC", startedAt: timestamp(i), firstPlayAt: timestamp(i + 1), lastHeartbeatAt: timestamp(i + 2),
    totalWatchMs: 30_000, maxProgressMs: 15_000, durationMs: 120_000, countedAsView: true, isAdminPreview: false,
    errorCode: null, createdAt: timestamp(i), updatedAt: timestamp(i + 2) }));
  const events = sampleRows(count, (i) => ({ videoId: `video-${i % 1000}`, type: "PLAY", positionMs: 1500,
    durationMs: 120_000, bufferedMs: 4000, volume: 0.5, muted: false, fullscreen: true, errorCode: null,
    provider: "SELF_HLS", sourceKind: "HLS", createdAt: timestamp(i) }));
  const empty = () => ({ findMany: async () => [] });
  const rows = (value) => ({ findMany: async () => value });
  const prisma = {
    user: { findUnique: async () => ({ id: "synthetic-owner", email: "owner@example.test" }) },
    comment: rows(comments), videoLike: empty(), videoDislike: empty(), commentReaction: empty(), subscription: empty(),
    emailPreference: empty(), broadcastEmailRecipient: empty(), emailEvent: empty(), payment: empty(), videoProgress: empty(),
    videoFavorite: empty(), videoView: rows(views), videoPlaybackSession: rows(sessions), videoPlaybackEvent: rows(events),
    creator: { findMany: async () => [] }, channelMember: empty(), notificationPreference: { findUnique: async () => null },
    notification: empty(), patronGrant: empty(), appSetting: { findUnique: async () => null },
    userAvatar: { findUnique: async () => null }, channelBanner: empty(),
  };
  const ctx = { prisma, now: () => new Date("2026-11-07T00:00:00.000Z") };
  const before = process.memoryUsage();
  const start = process.hrtime.bigint();
  const data = await ExportOwnDataUseCase.execute(ctx, "synthetic-owner");
  const json = JSON.stringify(data, null, 2);
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  const after = process.memoryUsage();
  const maxRssBytes = process.resourceUsage().maxRSS * 1024;
  const included = data.comments.length + data.videoViews.length + data.playbackSessions.length + data.playbackEvents.length;
  if (included !== count * 4 || data.comments.length !== count || data.videoViews.length !== count ||
      data.playbackSessions.length !== count || data.playbackEvents.length !== count) {
    throw new Error(`row completeness mismatch for ${count}: got ${included}`);
  }
  return {
    rows_per_large_category: count,
    exported_large_category_rows: included,
    exported_categories: ["comments", "videoViews", "playbackSessions", "playbackEvents"],
    json_bytes: Buffer.byteLength(json),
    elapsed_ms: Number(elapsedMs.toFixed(2)),
    before_heap_bytes: before.heapUsed,
    after_heap_bytes: after.heapUsed,
    before_rss_bytes: before.rss,
    after_rss_bytes: after.rss,
    process_max_rss_bytes: maxRssBytes,
    max_rss_delta_bytes: Math.max(0, maxRssBytes - before.rss),
  };
}

async function main() {
  const rowsEnv = process.env.K37_ROWS;
  if (rowsEnv !== undefined) {
    console.log(JSON.stringify(await runSample(Number(rowsEnv))));
    return;
  }

  const samples = [];
  for (const rows of sizes) {
    const child = spawnSync(process.execPath, ["--import", "tsx", self], {
      cwd: root,
      env: { ...process.env, K37_ROWS: String(rows) },
      encoding: "utf8",
      maxBuffer: 2 * MiB,
      timeout: 180_000,
    });
    if (child.status !== 0) throw new Error(`sample ${rows} failed: ${child.stderr || child.stdout}`);
    samples.push(JSON.parse(child.stdout.trim()));
  }

  const relative = path.relative(root, self).split(path.sep).join("/");
  const report = {
    recorded_at_utc: new Date().toISOString(),
    code_sha: spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim(),
    tool_sha256: createHash("sha256").update(readFileSync(self)).digest("hex"),
    source_sha256: createHash("sha256").update(readFileSync(path.join(root, "lib/modules/users/application/export-own-data.use-case.ts"))).digest("hex"),
    tool: relative,
    method: "Four separate Node processes call the real ExportOwnDataUseCase with synthetic in-memory Prisma delegates, then serialize exactly as the route does. Each large category is populated with the listed row count.",
    environment: { node: process.version, database: false, http: false, production_data: false, external_services: false },
    samples,
    limitations: [
      "Synthetic delegates return prebuilt arrays; this excludes PostgreSQL query/network costs and is not a production user profile.",
      "Peak RSS is a process high-water mark, not an isolated per-request allocator measurement or deployment-container ceiling.",
      "This is a baseline for export materialization and pretty JSON serialization, not an approved threshold or a test of concurrent exports, timeout, snapshot consistency, download-token lifecycle or cleanup.",
      "The 100,000-row case is a stress sample, not a recommendation or an agreed customer profile."
    ]
  };
  const evidence = path.join(path.dirname(self), "../evidence/k37-export-memory-baseline-2026-11-07.json");
  writeFileSync(evidence, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify({ evidence: path.relative(root, evidence), samples: samples.length,
    largest_json_bytes: samples.at(-1).json_bytes,
    largest_max_rss_bytes: samples.at(-1).process_max_rss_bytes }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
