/**
 * Video worker: long-running process that encodes uploaded originals into own HLS.
 *   npx tsx scripts/video-worker.ts            (container: see deploy/serwerek/docker-compose.yml, service "encoder")
 *
 * Pulls jobs from the Postgres queue (VideoEncodeJob), one at a time, so the 2-vCPU server stays
 * responsive. Never part of the Next.js request path. Runbook: docs/operations/VIDEO-PIPELINE.md.
 *
 * Env: DATABASE_URL, CLOUDFLARE_R2_ACCOUNT_ID / _ACCESS_KEY_ID / _SECRET_ACCESS_KEY,
 *      CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS, CLOUDFLARE_R2_BUCKET_HLS (default polutek-hls),
 *      CLOUDFLARE_R2_BUCKET_THUMBNAILS_PRIVATE (optional, poster -> thumbnail),
 *      VIDEO_WORKER_WORK_DIR (default /work), HLS_PRESET (default slow), HLS_NICE (default 10).
 */
import { randomUUID } from "node:crypto";
import { mkdir, statfs } from "node:fs/promises";
import os from "node:os";
import { prisma } from "@/lib/prisma";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { recordAuditEventSafe } from "@/lib/modules/audit";
import { EncodeJobError } from "@/lib/modules/video-pipeline/domain/encode-job.state";
import { EncodeJobRepository } from "@/lib/modules/video-pipeline/infrastructure/encode-job.repository";
import { HlsWriter, OriginalsReader, hlsBucketName, makeR2Client, readR2Credentials } from "@/lib/modules/video-pipeline/infrastructure/r2-storage";
import { createEncoder } from "@/lib/modules/video-pipeline/infrastructure/encoder.adapter";
import { resolveJobDurationLimit } from "@/lib/modules/video-pipeline/application/channel-limits";
import { createSelfHlsFinalizer } from "@/lib/modules/video-pipeline/application/finalize-self-hls";
import { runWorkerLoop } from "@/lib/modules/video-pipeline/application/worker-loop";
import { WORKER_HEARTBEAT_SETTING } from "@/lib/modules/video-pipeline/application/encode-queue.use-cases";

function log(message: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ t: new Date().toISOString(), component: "video-worker", message, ...extra }));
}

async function main() {
  const credentials = readR2Credentials();
  if (!credentials) throw new Error("R2 credentials are missing (CLOUDFLARE_R2_ACCOUNT_ID / _ACCESS_KEY_ID / _SECRET_ACCESS_KEY).");
  const workRoot = process.env.VIDEO_WORKER_WORK_DIR || "/work";
  await mkdir(workRoot, { recursive: true });

  const workerId = `${os.hostname()}-${randomUUID().slice(0, 8)}`;
  const client = makeR2Client(credentials);
  const originals = new OriginalsReader(client);
  const hls = new HlsWriter(client, hlsBucketName());
  const store = new EncodeJobRepository(prisma);
  const encoder = createEncoder();
  const finalizer = createSelfHlsFinalizer(prisma);
  const auditCtx = createAppContext({ prisma, actor: { type: "system", reason: "video_encode_worker" } });

  const shutdown = new AbortController();
  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.on(sig, () => {
      log("shutdown requested", { signal: sig });
      shutdown.abort();
    });
  }

  log("started", { workerId, workRoot, hlsBucket: hls.bucket });

  await runWorkerLoop({
    store,
    workerId,
    shutdown: shutdown.signal,
    now: () => new Date(),
    log,
    sleep: (ms, signal) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
      }),
    beat: async () => {
      const value = new Date().toISOString();
      await prisma.appSetting.upsert({ where: { key: WORKER_HEARTBEAT_SETTING }, create: { key: WORKER_HEARTBEAT_SETTING, value }, update: { value } });
    },
    portsFor: () => ({
      store,
      workerId,
      workRoot,
      shutdown: shutdown.signal,
      now: () => new Date(),
      log,
      encoder,
      finalizer,
      hls: {
        bucket: hls.bucket,
        putFile: (key, file, type) => hls.putFile(key, file, type),
        exists: (key) => hls.exists(key),
        countPrefix: (prefix) => hls.countPrefix(prefix),
        deletePrefix: (prefix) => hls.deletePrefix(prefix),
      },
      originals: {
        async loadOriginal(originalId) {
          const row = await prisma.videoOriginal.findUnique({ where: { id: originalId } });
          if (!row) return null;
          return { bucket: row.bucket, objectKey: row.objectKey, originalFileName: row.originalFileName, sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes) };
        },
        async download(ref, dest, opts) {
          const head = await originals.head(ref.bucket, ref.objectKey);
          if (!head.exists) throw new EncodeJobError("ORIGINAL_MISSING", "Oryginalu nie ma w R2.", true);
          return originals.download(ref.bucket, ref.objectKey, dest, opts);
        },
      },
      ensureDisk: async (required) => {
        const stats = await statfs(workRoot);
        const free = Number(stats.bavail) * Number(stats.bsize);
        if (free < required) {
          throw new EncodeJobError("DISK_FULL", `Za malo miejsca na dysku roboczym (wolne ${Math.round(free / 1e9)} GB, potrzeba ok. ${Math.round(required / 1e9)} GB).`, false);
        }
      },
      channelLimits: {
        // A job run by the worker is the system actor, but the limit protects the platform from the channel's own
        // uploads: resolved from the job's channel (staff-requested jobs and the main channel are exempt).
        maxVideoSeconds: (job) => resolveJobDurationLimit(createAppContext({ prisma, actor: { type: "system", reason: "video_encode_worker" } }), job),
      },
      audit: async (action, job, metadata) =>
        recordAuditEventSafe(auditCtx, { action, targetType: "Video", targetId: job.videoId, metadata: { jobId: job.id, ...metadata } as never }),
    }),
  });

  log("stopped");
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(JSON.stringify({ t: new Date().toISOString(), component: "video-worker", fatal: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
