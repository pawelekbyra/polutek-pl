import path from "node:path";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import type { Prisma, VideoEncodeJob } from "@prisma/client";
import {
  ENCODE_LIMITS,
  channelDurationLimitMessage,
  exceedsChannelDurationLimit,
  EncodeCancelledError,
  EncodeJobError,
  EncodeStage,
  HEARTBEAT_INTERVAL_MS,
  PERMANENT,
  classifyFailure,
  decideAfterFailure,
  estimateEtaSeconds,
  overallProgress,
} from "../domain/encode-job.state";
import { hlsAssetKey, hlsContentType, hlsObjectKey, isUploadableHlsFile, sortForUpload } from "../domain/keys";
import type { EncodeJobStore } from "../infrastructure/encode-job.repository";

/** What the encoder library reports about a source file (subset of probeSource()). */
export interface SourceProbe {
  width: number;
  height: number;
  duration: number;
  /** HLG/PQ source: encoded with tone mapping to SDR (scripts/hls/encode-hls.mjs). */
  hdr: boolean;
  hasAudio: boolean;
  videoCodec?: string;
  sizeBytes?: number;
}

export interface EncodeOutcome {
  meta: Record<string, unknown> | null;
  issues: string[];
}

export interface OriginalRef {
  bucket: string;
  objectKey: string;
  originalFileName: string | null;
  sizeBytes: number | null;
}

export interface FinalizeInput {
  job: VideoEncodeJob;
  assetKey: string;
  hlsBucket: string;
  posterPath: string;
  meta: Record<string, unknown>;
  totalBytes: number;
}

/** Everything the processor touches outside itself; the worker wires real ones, tests wire fakes. */
export interface ProcessorPorts {
  store: EncodeJobStore;
  workerId: string;
  workRoot: string;
  originals: {
    loadOriginal(originalId: string): Promise<OriginalRef | null>;
    download(ref: OriginalRef, destPath: string, opts: { signal: AbortSignal; onBytes: (done: number, total: number) => void }): Promise<number>;
  };
  hls: {
    bucket: string;
    putFile(key: string, filePath: string, contentType: string): Promise<number>;
    exists(key: string): Promise<boolean>;
    countPrefix(prefix: string): Promise<number>;
    deletePrefix(prefix: string): Promise<number>;
  };
  encoder: {
    probe(file: string, signal?: AbortSignal): Promise<SourceProbe>;
    encode(args: {
      input: string;
      out: string;
      signal: AbortSignal;
      onProgress: (p: { overall: number; step: string; name: string }) => void;
    }): Promise<EncodeOutcome>;
  };
  finalizer: {
    /** Asset id when this job's output is already live (crash between finalize and markSucceeded). */
    findExisting(job: VideoEncodeJob, assetKey: string): Promise<string | null>;
    finalize(input: FinalizeInput): Promise<{ assetId: string }>;
  };
  /**
   * The channel's length limit for this job's source, in seconds, or null when none applies (the platform's main
   * channel, a job requested by staff, no channel). Optional: without it only the global limit is enforced.
   */
  channelLimits?: { maxVideoSeconds(job: VideoEncodeJob): Promise<number | null> };
  audit(action: string, job: VideoEncodeJob, metadata: Record<string, unknown>): Promise<void>;
  now: () => Date;
  log: (message: string, extra?: Record<string, unknown>) => void;
  /** Throws a transient EncodeJobError when the work dir cannot hold `requiredBytes`. */
  ensureDisk?: (requiredBytes: number) => Promise<void>;
  /** Aborted on SIGTERM: the job is handed back to the queue without using up an attempt. */
  shutdown?: AbortSignal;
  heartbeatIntervalMs?: number;
  uploadConcurrency?: number;
}

export type ProcessOutcome = "succeeded" | "retry" | "failed" | "cancelled" | "lost" | "released";

/** Throttles DB writes: at most one per `minMs` unless the percent moved by `minDelta`. */
function makeProgressWriter(ports: ProcessorPorts, job: VideoEncodeJob, controller: AbortController, state: { lost: boolean }) {
  let lastWrite = 0;
  let lastPercent = -1;
  let stage: EncodeStage = "DOWNLOADING";
  let percent = 0;
  let eta: number | null = null;

  const flush = async (force = false) => {
    const nowMs = Date.now();
    if (!force && nowMs - lastWrite < 2000 && Math.abs(percent - lastPercent) < 2) return;
    lastWrite = nowMs;
    lastPercent = percent;
    const res = await ports.store.reportProgress(job.id, ports.workerId, { stage, progressPercent: percent, etaSeconds: eta });
    if (!res.owned) {
      state.lost = true;
      controller.abort();
    } else if (res.cancelRequested) {
      controller.abort();
    }
  };

  return {
    set(next: { stage?: EncodeStage; percent?: number; eta?: number | null }) {
      if (next.stage) stage = next.stage;
      if (next.percent !== undefined) percent = next.percent;
      if (next.eta !== undefined) eta = next.eta;
    },
    flush,
    /** Fire-and-forget variant for high-frequency callbacks (ffmpeg, download). */
    tick() {
      void flush().catch(() => undefined);
    },
  };
}

async function listFiles(root: string, rel = ""): Promise<string[]> {
  const entries = await readdir(path.join(root, rel), { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const next = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await listFiles(root, next)));
    else out.push(next);
  }
  return out;
}

async function runPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>, signal: AbortSignal): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      if (signal.aborted) throw new EncodeCancelledError();
      const item = items[index++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/**
 * Runs one claimed job end to end: download -> probe -> encode -> upload -> finalize.
 * Invariants (tested):
 *  - the master playlist is uploaded last and the asset/route are created only after every
 *    object is verified in R2, so a partial output is never reachable;
 *  - cancel and a lost claim abort ffmpeg/uploads and clean the partial R2 prefix;
 *  - failures are classified: permanent ones end the job, the rest are retried with backoff;
 *  - the local work directory is always removed.
 */
export async function processEncodeJob(job: VideoEncodeJob, ports: ProcessorPorts): Promise<ProcessOutcome> {
  const controller = new AbortController();
  const lostState = { lost: false };
  const progress = makeProgressWriter(ports, job, controller, lostState);
  const assetKey = hlsAssetKey(job.videoId, job.versionNumber);
  const prefix = `${assetKey}/`;
  const workDir = path.join(ports.workRoot, job.id);
  let uploadStarted = false;
  let finalized = false;

  const shutdownState = { requested: false };
  const onShutdown = () => {
    shutdownState.requested = true;
    controller.abort();
  };
  ports.shutdown?.addEventListener("abort", onShutdown, { once: true });
  if (ports.shutdown?.aborted) onShutdown();

  // The heartbeat always writes (it is the liveness signal and the cancel poll); progress ticks are throttled.
  const heartbeat = setInterval(() => void progress.flush(true).catch(() => undefined), ports.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS);
  const throwIfStopped = () => {
    if (controller.signal.aborted) throw new EncodeCancelledError();
  };
  const stage = async (next: EncodeStage, fraction = 0, eta: number | null = null) => {
    throwIfStopped();
    progress.set({ stage: next, percent: overallProgress(next, fraction), eta });
    await progress.flush(true);
    throwIfStopped();
  };

  try {
    await ports.audit("VIDEO_ENCODE_STARTED", job, { attempt: job.attemptCount, versionNumber: job.versionNumber });

    // A previous attempt may have crashed after the output went live; do not redo or delete it.
    const existing = await ports.finalizer.findExisting(job, assetKey);
    if (existing) {
      await ports.store.markSucceeded(job.id, ports.workerId, { assetId: existing, result: { reusedExistingAsset: true } });
      await ports.audit("VIDEO_ENCODE_SUCCEEDED", job, { assetId: existing, reused: true });
      return "succeeded";
    }

    await mkdir(workDir, { recursive: true });
    const original = await ports.originals.loadOriginal(job.originalId);
    if (!original) throw new EncodeJobError(PERMANENT.ORIGINAL_MISSING, "Oryginal nie istnieje w bazie.", true);
    if (original.sizeBytes) await ports.ensureDisk?.(original.sizeBytes * 3 + 1024 ** 3);

    // 1. download
    await stage("DOWNLOADING", 0);
    const ext = path.extname(original.objectKey) || ".bin";
    const sourcePath = path.join(workDir, `source${ext}`);
    let lastDownloadFraction = 0;
    const downloadStartedAt = Date.now();
    await ports.originals.download(original, sourcePath, {
      signal: controller.signal,
      onBytes: (done, total) => {
        const fraction = total > 0 ? done / total : 0;
        if (fraction - lastDownloadFraction < 0.01 && fraction < 1) return;
        lastDownloadFraction = fraction;
        progress.set({ stage: "DOWNLOADING", percent: overallProgress("DOWNLOADING", fraction), eta: null });
        progress.tick();
      },
    });
    throwIfStopped();
    ports.log("downloaded", { jobId: job.id, seconds: (Date.now() - downloadStartedAt) / 1000 });

    // 2. probe + hard limits
    await stage("PROBING", 0);
    let probe: SourceProbe;
    try {
      probe = await ports.encoder.probe(sourcePath, controller.signal);
    } catch (err) {
      if (controller.signal.aborted) throw new EncodeCancelledError();
      throw err;
    }
    if (!(probe.duration > 0) || probe.duration > ENCODE_LIMITS.maxDurationSeconds) {
      throw new EncodeJobError(PERMANENT.TOO_LONG, `Dlugosc ${Math.round(probe.duration)} s poza limitem ${ENCODE_LIMITS.maxDurationSeconds} s.`, true);
    }
    // Per-channel length limit (ChannelQuota.maxVideoSeconds): known only now, so the job ends here with a
    // reason the creator sees in the Studio. A failed lookup is a transient error (retried), never "no limit".
    const channelLimit = (await ports.channelLimits?.maxVideoSeconds(job)) ?? null;
    if (exceedsChannelDurationLimit(probe.duration, channelLimit)) {
      throw new EncodeJobError(PERMANENT.CHANNEL_DURATION_LIMIT, channelDurationLimitMessage(probe.duration, channelLimit as number), true);
    }
    if (probe.width > ENCODE_LIMITS.maxWidth || probe.height > ENCODE_LIMITS.maxHeight) {
      throw new EncodeJobError(PERMANENT.TOO_LARGE_FRAME, `Rozdzielczosc ${probe.width}x${probe.height} poza limitem.`, true);
    }
    await ports.store.reportProgress(job.id, ports.workerId, {
      sourceInfo: { width: probe.width, height: probe.height, durationSeconds: probe.duration, hasAudio: probe.hasAudio, hdr: probe.hdr, codec: probe.videoCodec ?? null, sizeBytes: probe.sizeBytes ?? null } as Prisma.InputJsonValue,
    });

    // 3. encode
    await stage("ENCODING", 0);
    const outDir = path.join(workDir, "out");
    const encodeStartedAt = Date.now();
    const encoded = await ports.encoder.encode({
      input: sourcePath,
      out: outDir,
      signal: controller.signal,
      onProgress: ({ overall }) => {
        progress.set({
          stage: "ENCODING",
          percent: overallProgress("ENCODING", overall),
          eta: estimateEtaSeconds({ stageElapsedMs: Date.now() - encodeStartedAt, fraction: overall, remainingStagesSeconds: Math.max(20, probe.duration * 0.02) }),
        });
        progress.tick();
      },
    }).catch((err: unknown) => {
      if (controller.signal.aborted) throw new EncodeCancelledError();
      throw err;
    });
    throwIfStopped();
    if (!encoded.meta) throw new EncodeJobError(PERMANENT.VALIDATION_FAILED, "Enkoder nie zwrocil wyniku.", true);
    if (encoded.issues.length > 0) {
      throw new EncodeJobError(PERMANENT.VALIDATION_FAILED, `Walidacja wyniku nie przeszla: ${encoded.issues.slice(0, 5).join("; ")}`, true);
    }

    // 4. upload (master last; the prefix is emptied first so an earlier partial attempt cannot mix in)
    await stage("UPLOADING", 0);
    uploadStarted = true;
    await ports.hls.deletePrefix(prefix);
    const files = sortForUpload((await listFiles(outDir)).filter(isUploadableHlsFile));
    if (!files.includes("master.m3u8")) throw new EncodeJobError(PERMANENT.VALIDATION_FAILED, "Brak master.m3u8 w wyniku.", true);
    const sizes = new Map<string, number>();
    for (const f of files) sizes.set(f, (await stat(path.join(outDir, f))).size);
    const totalBytes = [...sizes.values()].reduce((a, b) => a + b, 0);
    let uploaded = 0;
    const putOne = async (rel: string) => {
      await ports.hls.putFile(hlsObjectKey(job.videoId, job.versionNumber, rel), path.join(outDir, rel), hlsContentType(rel));
      uploaded += sizes.get(rel) ?? 0;
      progress.set({ stage: "UPLOADING", percent: overallProgress("UPLOADING", totalBytes ? uploaded / totalBytes : 1), eta: null });
      progress.tick();
    };
    const withoutMaster = files.filter((f) => f !== "master.m3u8");
    await runPool(withoutMaster, ports.uploadConcurrency ?? 4, putOne, controller.signal);
    throwIfStopped();
    await putOne("master.m3u8");

    // 5. verify everything is really in R2 before anything points at it
    await stage("FINALIZING", 0);
    if (!(await ports.hls.exists(hlsObjectKey(job.videoId, job.versionNumber, "master.m3u8")))) {
      throw new EncodeJobError("UPLOAD_VERIFY_FAILED", "master.m3u8 nie jest widoczny w R2 po wgraniu.", false);
    }
    const objectCount = await ports.hls.countPrefix(prefix);
    if (objectCount !== files.length) {
      throw new EncodeJobError("UPLOAD_VERIFY_FAILED", `W R2 jest ${objectCount} obiektow, oczekiwano ${files.length}.`, false);
    }

    // 6. asset + route + thumbnail + auto-publish
    const { assetId } = await ports.finalizer.finalize({
      job,
      assetKey,
      hlsBucket: ports.hls.bucket,
      posterPath: path.join(outDir, "poster.jpg"),
      meta: encoded.meta,
      totalBytes,
    });
    finalized = true;
    const result = { ...encoded.meta, uploadedObjects: files.length, uploadedBytes: totalBytes } as Prisma.InputJsonValue;
    const done = await ports.store.markSucceeded(job.id, ports.workerId, { assetId, result });
    await ports.audit("VIDEO_ENCODE_SUCCEEDED", job, { assetId, versionNumber: job.versionNumber, objects: files.length, bytes: totalBytes });
    return done ? "succeeded" : "lost";
  } catch (err) {
    return await handleFailure(err);
  } finally {
    clearInterval(heartbeat);
    ports.shutdown?.removeEventListener("abort", onShutdown);
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }

  async function handleFailure(err: unknown): Promise<ProcessOutcome> {
    const cancelled = err instanceof EncodeCancelledError || controller.signal.aborted;
    // Nothing references the prefix until the asset exists, so partial output can always go.
    if (uploadStarted && !finalized) await ports.hls.deletePrefix(prefix).catch((e) => ports.log("cleanup failed", { jobId: job.id, error: String(e) }));
    if (shutdownState.requested && !lostState.lost) {
      await ports.store.release(job.id, ports.workerId);
      ports.log("released on shutdown", { jobId: job.id });
      return "released";
    }
    if (lostState.lost) {
      ports.log("claim lost, leaving the job to its new owner", { jobId: job.id });
      return "lost";
    }
    if (cancelled) {
      await ports.store.markCancelled(job.id, ports.workerId);
      await ports.audit("VIDEO_ENCODE_CANCELLED", job, {});
      return "cancelled";
    }
    const failure = classifyFailure(err);
    const verdict = decideAfterFailure(job, failure);
    const applied = await ports.store.markFailedOrRetry(job.id, ports.workerId, verdict, ports.now());
    ports.log("job failed", { jobId: job.id, code: failure.code, next: verdict.next, error: failure.message });
    if (verdict.next === "FAILED") await ports.audit("VIDEO_ENCODE_FAILED", job, { code: failure.code, message: failure.message });
    if (!applied) return "lost";
    return verdict.next === "FAILED" ? "failed" : "retry";
  }
}
