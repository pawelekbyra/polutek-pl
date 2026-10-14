import { Prisma, PrismaClient, VideoEncodeJob } from "@prisma/client";
import {
  ACTIVE_ENCODE_STATUSES,
  DEFAULT_MAX_ATTEMPTS,
  EncodeJobError,
  EncodeStage,
  FailureVerdict,
  STALE_HEARTBEAT_MS,
  decideAfterFailure,
  parseVersionNumber,
} from "../domain/encode-job.state";

/** Everything the worker needs from the queue (a fake implements this in tests). */
export interface EncodeJobStore {
  requeueStale(now: Date): Promise<{ requeued: number; failed: number; cancelled: number }>;
  claimNext(workerId: string, now: Date): Promise<VideoEncodeJob | null>;
  /** Heartbeat + progress in one write. `owned` is false when the job was taken away from this worker. */
  reportProgress(
    jobId: string,
    workerId: string,
    patch: { stage?: EncodeStage; progressPercent?: number; etaSeconds?: number | null; sourceInfo?: Prisma.InputJsonValue },
  ): Promise<{ owned: boolean; cancelRequested: boolean }>;
  markSucceeded(jobId: string, workerId: string, data: { assetId: string; result: Prisma.InputJsonValue }): Promise<boolean>;
  markFailedOrRetry(jobId: string, workerId: string, verdict: FailureVerdict, now: Date): Promise<boolean>;
  markCancelled(jobId: string, workerId: string): Promise<boolean>;
  /** Graceful shutdown: back to QUEUED without consuming the attempt that was just claimed. */
  release(jobId: string, workerId: string): Promise<boolean>;
}

/** Same advisory-lock key for every claim: with one worker per server this serialises "one encode at a time". */
const CLAIM_ADVISORY_LOCK = 947201;

export class EncodeJobRepository implements EncodeJobStore {
  constructor(private readonly db: PrismaClient) {}

  // ---------- worker side ----------

  /**
   * Atomically picks the next due QUEUED job (channels take turns, then oldest first) and marks it RUNNING.
   * `FOR UPDATE SKIP LOCKED` makes concurrent claimers skip each other's row instead of waiting;
   * the NOT EXISTS clause + advisory lock keep it to ONE running encode (CPX22 has 2 vCPU).
   * Times are computed in the database (UTC) so a skewed worker clock cannot confuse the queue.
   */
  async claimNext(workerId: string, _now: Date): Promise<VideoEncodeJob | null> {
    const staleSeconds = STALE_HEARTBEAT_MS / 1000;
    const rows = await this.db.$queryRaw<Array<{ id: string }>>`
      UPDATE "VideoEncodeJob" AS j
      SET "status" = 'RUNNING',
          "stage" = 'DOWNLOADING',
          "progressPercent" = 0,
          "etaSeconds" = NULL,
          "attemptCount" = j."attemptCount" + 1,
          "workerId" = ${workerId},
          "heartbeatAt" = (now() AT TIME ZONE 'UTC'),
          "startedAt" = COALESCE(j."startedAt", (now() AT TIME ZONE 'UTC')),
          "nextAttemptAt" = NULL,
          "failureCode" = NULL,
          "failureReason" = NULL,
          "updatedAt" = (now() AT TIME ZONE 'UTC')
      WHERE j."id" = (
        SELECT c."id" FROM "VideoEncodeJob" AS c
        WHERE c."status" = 'QUEUED'
          AND c."cancelRequested" = false
          AND (c."nextAttemptAt" IS NULL OR c."nextAttemptAt" <= (now() AT TIME ZONE 'UTC'))
          AND pg_try_advisory_xact_lock(${CLAIM_ADVISORY_LOCK})
          AND NOT EXISTS (
            SELECT 1 FROM "VideoEncodeJob" AS r
            WHERE r."status" = 'RUNNING'
              AND r."heartbeatAt" > ((now() AT TIME ZONE 'UTC') - make_interval(secs => ${staleSeconds}::double precision))
          )
        -- Fair between channels: the channel that least recently got the encoder goes first (never started =
        -- first); inside a channel the oldest job goes first. One creator queueing ten videos cannot starve
        -- another creator's single upload.
        ORDER BY (
          SELECT max(s."startedAt") FROM "VideoEncodeJob" AS s
          WHERE s."channelId" IS NOT DISTINCT FROM c."channelId" AND s."startedAt" IS NOT NULL
        ) ASC NULLS FIRST,
        c."createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING j."id"
    `;
    if (rows.length === 0) return null;
    return this.db.videoEncodeJob.findUnique({ where: { id: rows[0].id } });
  }

  async reportProgress(
    jobId: string,
    workerId: string,
    patch: { stage?: EncodeStage; progressPercent?: number; etaSeconds?: number | null; sourceInfo?: Prisma.InputJsonValue },
  ) {
    const result = await this.db.videoEncodeJob.updateMany({
      where: { id: jobId, workerId, status: "RUNNING" },
      data: {
        heartbeatAt: new Date(),
        ...(patch.stage ? { stage: patch.stage } : {}),
        ...(patch.progressPercent !== undefined ? { progressPercent: patch.progressPercent } : {}),
        ...(patch.etaSeconds !== undefined ? { etaSeconds: patch.etaSeconds } : {}),
        ...(patch.sourceInfo !== undefined ? { sourceInfo: patch.sourceInfo } : {}),
      },
    });
    if (result.count === 0) return { owned: false, cancelRequested: false };
    const row = await this.db.videoEncodeJob.findUnique({ where: { id: jobId }, select: { cancelRequested: true } });
    return { owned: true, cancelRequested: row?.cancelRequested ?? false };
  }

  async markSucceeded(jobId: string, workerId: string, data: { assetId: string; result: Prisma.InputJsonValue }) {
    const res = await this.db.videoEncodeJob.updateMany({
      where: { id: jobId, workerId, status: "RUNNING" },
      data: {
        status: "SUCCEEDED",
        stage: "DONE",
        progressPercent: 100,
        etaSeconds: 0,
        assetId: data.assetId,
        result: data.result,
        finishedAt: new Date(),
        failureCode: null,
        failureReason: null,
      },
    });
    return res.count === 1;
  }

  async markFailedOrRetry(jobId: string, workerId: string, verdict: FailureVerdict, now: Date) {
    const base = { failureCode: verdict.code, failureReason: verdict.message, etaSeconds: null, workerId: null };
    const res = await this.db.videoEncodeJob.updateMany({
      where: { id: jobId, workerId, status: "RUNNING" },
      data:
        verdict.next === "FAILED"
          ? { ...base, status: "FAILED", finishedAt: now }
          : { ...base, status: "QUEUED", stage: "QUEUED", progressPercent: 0, nextAttemptAt: new Date(now.getTime() + verdict.delayMs) },
    });
    return res.count === 1;
  }

  async release(jobId: string, workerId: string) {
    const job = await this.db.videoEncodeJob.findFirst({ where: { id: jobId, workerId, status: "RUNNING" }, select: { attemptCount: true } });
    if (!job) return false;
    const res = await this.db.videoEncodeJob.updateMany({
      where: { id: jobId, workerId, status: "RUNNING" },
      data: { status: "QUEUED", stage: "QUEUED", progressPercent: 0, etaSeconds: null, workerId: null, nextAttemptAt: null, attemptCount: Math.max(0, job.attemptCount - 1) },
    });
    return res.count === 1;
  }

  async markCancelled(jobId: string, workerId: string) {
    const res = await this.db.videoEncodeJob.updateMany({
      where: { id: jobId, workerId, status: "RUNNING" },
      data: { status: "CANCELLED", stage: "QUEUED", etaSeconds: null, workerId: null, finishedAt: new Date() },
    });
    return res.count === 1;
  }

  /**
   * RUNNING jobs whose worker stopped heartbeating (crash, restart, OOM kill) go back to QUEUED,
   * or to FAILED when the attempts are used up, or to CANCELLED when a cancel was pending.
   * Safe to call on every worker loop turn; each job is changed with a compare-and-set on its
   * heartbeat so a worker that is just resuming wins over this sweep.
   */
  async requeueStale(now: Date) {
    const cutoff = new Date(now.getTime() - STALE_HEARTBEAT_MS);
    const stale = await this.db.videoEncodeJob.findMany({
      where: { status: "RUNNING", OR: [{ heartbeatAt: null }, { heartbeatAt: { lt: cutoff } }] },
    });
    let requeued = 0;
    let failed = 0;
    let cancelled = 0;
    for (const job of stale) {
      const guard = { id: job.id, status: "RUNNING" as const, heartbeatAt: job.heartbeatAt };
      if (job.cancelRequested) {
        const r = await this.db.videoEncodeJob.updateMany({
          where: guard,
          data: { status: "CANCELLED", stage: "QUEUED", workerId: null, etaSeconds: null, finishedAt: now },
        });
        cancelled += r.count;
        continue;
      }
      const verdict = decideAfterFailure(job, { code: "WORKER_LOST", message: "Worker przestal odpowiadac (restart albo awaria).", permanent: false });
      const r = await this.db.videoEncodeJob.updateMany({
        where: guard,
        data:
          verdict.next === "FAILED"
            ? { status: "FAILED", failureCode: verdict.code, failureReason: verdict.message, workerId: null, etaSeconds: null, finishedAt: now }
            : {
                status: "QUEUED",
                stage: "QUEUED",
                progressPercent: 0,
                failureCode: verdict.code,
                failureReason: verdict.message,
                workerId: null,
                etaSeconds: null,
                nextAttemptAt: new Date(now.getTime() + Math.min(verdict.delayMs, 60_000)),
              },
      });
      if (verdict.next === "FAILED") failed += r.count;
      else requeued += r.count;
    }
    return { requeued, failed, cancelled };
  }

  // ---------- app side (admin routes / use cases) ----------

  /**
   * Creates a job for an uploaded original. Idempotent per original: when a QUEUED/RUNNING job
   * for the same original exists it is returned (`created: false`); a job running for ANOTHER
   * original of the same video is a conflict (one encode per video at a time).
   * The advisory lock serialises concurrent enqueues of the same video.
   */
  async enqueue(input: { videoId: string; originalId: string; requestedById: string | null; channelId?: string | null; maxAttempts?: number }) {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`encode:${input.videoId}`}))`;

      const active = await tx.videoEncodeJob.findFirst({
        where: { videoId: input.videoId, status: { in: [...ACTIVE_ENCODE_STATUSES] } },
        orderBy: { createdAt: "desc" },
      });
      if (active) {
        if (active.originalId === input.originalId) return { job: active, created: false };
        throw new EncodeJobError("ENCODE_ALREADY_ACTIVE", "Dla tego filmu trwa juz kodowanie innego pliku.", true);
      }

      const generation = (await tx.videoEncodeJob.count({ where: { originalId: input.originalId } })) + 1;
      const [jobVersions, assets] = await Promise.all([
        tx.videoEncodeJob.aggregate({ where: { videoId: input.videoId }, _max: { versionNumber: true } }),
        tx.videoAsset.findMany({ where: { videoId: input.videoId, provider: "SELF_HLS" }, select: { objectKey: true } }),
      ]);
      const versionNumber = Math.max(jobVersions._max.versionNumber ?? 0, ...assets.map((a) => parseVersionNumber(a.objectKey))) + 1;

      const job = await tx.videoEncodeJob.create({
        data: {
          videoId: input.videoId,
          channelId: input.channelId ?? null,
          originalId: input.originalId,
          versionNumber,
          idempotencyKey: `${input.originalId}:${generation}`,
          requestedById: input.requestedById,
          maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
        },
      });
      return { job, created: true };
    });
  }

  /** QUEUED -> CANCELLED at once; RUNNING -> flag the worker polls on every heartbeat. */
  async requestCancel(jobId: string, videoId: string): Promise<"cancelled" | "requested" | "terminal" | "not_found"> {
    const job = await this.db.videoEncodeJob.findFirst({ where: { id: jobId, videoId } });
    if (!job) return "not_found";
    if (job.status === "QUEUED") {
      const r = await this.db.videoEncodeJob.updateMany({
        where: { id: jobId, status: "QUEUED" },
        data: { status: "CANCELLED", cancelRequested: true, finishedAt: new Date(), etaSeconds: null },
      });
      if (r.count === 1) return "cancelled";
      return this.requestCancel(jobId, videoId);
    }
    if (job.status === "RUNNING") {
      await this.db.videoEncodeJob.updateMany({ where: { id: jobId, status: "RUNNING" }, data: { cancelRequested: true } });
      return "requested";
    }
    return "terminal";
  }

  getById(jobId: string) {
    return this.db.videoEncodeJob.findUnique({ where: { id: jobId } });
  }

  listForVideo(videoId: string, take = 10) {
    return this.db.videoEncodeJob.findMany({ where: { videoId }, orderBy: { createdAt: "desc" }, take });
  }

  findActiveForVideo(videoId: string) {
    return this.db.videoEncodeJob.findFirst({
      where: { videoId, status: { in: [...ACTIVE_ENCODE_STATUSES] } },
      orderBy: { createdAt: "desc" },
    });
  }
}
