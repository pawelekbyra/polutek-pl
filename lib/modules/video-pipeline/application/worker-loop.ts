import type { VideoEncodeJob } from "@prisma/client";
import type { EncodeJobStore } from "../infrastructure/encode-job.repository";
import { processEncodeJob, type ProcessOutcome, type ProcessorPorts } from "./process-encode-job";

export interface WorkerLoopDeps {
  store: EncodeJobStore;
  workerId: string;
  /** Builds the processor ports for one claimed job. */
  portsFor: (job: VideoEncodeJob) => ProcessorPorts;
  /** Marks the worker alive for the admin UI (AppSetting heartbeat). */
  beat: () => Promise<void>;
  now: () => Date;
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  log: (message: string, extra?: Record<string, unknown>) => void;
  shutdown: AbortSignal;
  pollIntervalMs?: number;
  /** Test hook: stop after N loop turns. */
  maxTurns?: number;
}

/**
 * Waits `ms`, or until `signal` aborts. The abort listener is removed again when the timer wins, so an idle worker
 * polling every few seconds does not pile up one listener per turn on the shutdown signal (audit W21).
 */
export function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Pull loop: sweep abandoned jobs, claim the next due one, process it, repeat. One job at a
 * time by construction. Errors inside a turn are logged and never kill the loop (a poison job
 * is bounded by maxAttempts, a DB blip just delays the next turn).
 */
export async function runWorkerLoop(deps: WorkerLoopDeps): Promise<{ processed: ProcessOutcome[] }> {
  const processed: ProcessOutcome[] = [];
  const poll = deps.pollIntervalMs ?? 5000;
  let turns = 0;
  while (!deps.shutdown.aborted && (deps.maxTurns === undefined || turns < deps.maxTurns)) {
    turns += 1;
    try {
      await deps.beat();
      const sweep = await deps.store.requeueStale(deps.now());
      if (sweep.requeued || sweep.failed || sweep.cancelled) deps.log("stale jobs swept", sweep);
      const job = await deps.store.claimNext(deps.workerId, deps.now());
      if (!job) {
        await deps.sleep(poll, deps.shutdown);
        continue;
      }
      deps.log("job claimed", { jobId: job.id, videoId: job.videoId, attempt: job.attemptCount });
      const outcome = await processEncodeJob(job, deps.portsFor(job));
      // The history is a test hook (maxTurns); a long-lived production loop would only grow it (audit W30).
      if (deps.maxTurns !== undefined) processed.push(outcome);
      deps.log("job finished", { jobId: job.id, outcome });
    } catch (error) {
      deps.log("worker turn failed", { error: error instanceof Error ? error.message : String(error) });
      await deps.sleep(poll, deps.shutdown).catch(() => undefined);
    }
  }
  return { processed };
}
