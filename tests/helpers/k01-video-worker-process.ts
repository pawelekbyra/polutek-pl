import { PrismaClient } from "@prisma/client";
import { S3Client } from "@aws-sdk/client-s3";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { recordAuditEventSafe } from "@/lib/modules/audit";
import { createSelfHlsFinalizer } from "@/lib/modules/video-pipeline/application/finalize-self-hls";
import { resolveJobDurationLimit } from "@/lib/modules/video-pipeline/application/channel-limits";
import { runWorkerLoop, abortableSleep } from "@/lib/modules/video-pipeline/application/worker-loop";
import { createEncoder } from "@/lib/modules/video-pipeline/infrastructure/encoder.adapter";
import { EncodeJobRepository } from "@/lib/modules/video-pipeline/infrastructure/encode-job.repository";
import { HlsWriter, OriginalsReader } from "@/lib/modules/video-pipeline/infrastructure/r2-storage";

async function main() {
  const endpoint = process.env.K01_S3_ENDPOINT;
  const originalBucket = process.env.K01_ORIGINAL_BUCKET;
  const hlsBucket = process.env.K01_HLS_BUCKET;
  const targetJobId = process.env.K01_JOB_ID;
  if (!endpoint || !originalBucket || !hlsBucket || !targetJobId) throw new Error("K01 local worker settings are required");

  const prisma = new PrismaClient();
  const client = new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: "k01-loopback-only", secretAccessKey: "k01-loopback-only" },
    maxAttempts: 1,
  });
  try {
    const workerId = `k01-worker-${process.pid}`;
    const eligible = await prisma.videoEncodeJob.findMany({
      where: { status: "QUEUED", cancelRequested: false, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (eligible.length !== 1 || eligible[0]?.id !== targetJobId) throw new Error("K01 isolated DB must contain only the target eligible job");
    const store = new EncodeJobRepository(prisma);
    const hls = new HlsWriter(client, hlsBucket);
    const originals = new OriginalsReader(client);
    const finalizer = createSelfHlsFinalizer(prisma);
    const auditCtx = createAppContext({ prisma, actor: { type: "system", reason: "k01_local_worker_acceptance" } });
    const shutdown = new AbortController();
    const result = await runWorkerLoop({
      store,
      workerId,
      shutdown: shutdown.signal,
      now: () => new Date(),
      sleep: async () => undefined,
      log: (message, extra) => process.stdout.write(`${JSON.stringify({ message, ...extra })}\n`),
      beat: async () => undefined,
      maxTurns: 1,
      portsFor: () => ({
        store,
        workerId,
        workRoot: process.env.K01_WORK_ROOT ?? "/tmp/k01-video-worker",
        shutdown: shutdown.signal,
        now: () => new Date(),
        log: (message, extra) => process.stdout.write(`${JSON.stringify({ message, ...extra })}\n`),
        encoder: createEncoder({ preset: "ultrafast", nice: 0 }),
        finalizer,
        hls: {
          bucket: hlsBucket,
          verifyOutput: (key) => hls.verifyOutput(key),
          putFile: (key, file, contentType, signal) => hls.putFile(key, file, contentType, signal),
          exists: (key) => hls.exists(key),
          countPrefix: (prefix) => hls.countPrefix(prefix),
          deletePrefix: (prefix) => hls.deletePrefix(prefix),
        },
        originals: {
          async loadOriginal(originalId) {
            const row = await prisma.videoOriginal.findUnique({ where: { id: originalId } });
            return row ? { bucket: row.bucket, objectKey: row.objectKey, originalFileName: row.originalFileName, sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes) } : null;
          },
          async download(ref, destPath, options) {
            const head = await originals.head(ref.bucket, ref.objectKey);
            if (!head.exists) throw new Error("K01 synthetic original is missing from loopback storage");
            return originals.download(ref.bucket, ref.objectKey, destPath, options);
          },
        },
        channelLimits: { maxVideoSeconds: (job) => resolveJobDurationLimit(auditCtx, job) },
        audit: (action, job, metadata) => recordAuditEventSafe(auditCtx, {
          action,
          targetType: "Video",
          targetId: job.videoId,
          metadata: { jobId: job.id, ...metadata } as never,
        }),
      }),
    });
    process.stdout.write(`K01_WORKER_RESULT=${JSON.stringify(result.processed)}\n`);
  } finally {
    client.destroy();
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
