import { randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";

/**
 * Durable job runner (no I/O of its own): the generic part of "work that must survive a crash and
 * never run twice at once". The storage (`DurableJobStore`, Prisma in `durable-job.repository.ts`, a
 * fake in tests) takes a job with a lease owned by a random token; every later write of the run is
 * conditional on that token, so a run whose lease expired (stalled, process frozen) cannot overwrite
 * the run that took the job over. A handler is resumable: it reads `job.cursor`, does a bounded
 * piece of work, saves the new cursor with `ctx.checkpoint` (which also renews the lease) and returns
 * "continue" when the time budget is up or "done" when finished. A thrown error schedules a retry
 * with exponential backoff; after `DURABLE_JOB_MAX_ATTEMPTS` failures the job becomes DEAD (kept for an operator).
 */

export const DURABLE_JOB_LEASE_MS = 2 * 60_000;
export const DURABLE_JOB_MAX_ATTEMPTS = 8;
/** One runner invocation (cron tick or post-publish kick) works for at most this long, then hands over. */
export const DURABLE_JOB_RUN_BUDGET_MS = 45_000;

export type DurableJobKind = "NEW_VIDEO_FANOUT" | "STORAGE_CLEANUP";

export type ClaimedJob = {
  id: string;
  kind: string;
  dedupeKey: string;
  payload: unknown;
  cursor: string | null;
  attempts: number;
  /** Random owner token of this claim; the store checks it on every write. */
  token: string;
};

export type EnqueueInput = {
  kind: DurableJobKind;
  dedupeKey: string;
  payload: unknown;
  /** Terminal states that an enqueue puts back to PENDING (cursor cleared). Default: none, the second enqueue is a no-op. */
  reopen?: Array<"DONE" | "DEAD">;
};

/** Everything the runner needs from the database. `Tx` is the caller's transaction handle, opaque here. */
export interface DurableJobStore<Tx = unknown> {
  /** Creates the job unless (kind, dedupeKey) exists; see `reopen`. Accepts an open transaction. */
  enqueue(input: EnqueueInput, tx?: Tx): Promise<void>;
  /** Takes the oldest due PENDING job of one of `kinds` with a fresh lease; null when there is none. */
  claimNext(kinds: string[], leaseMs: number, token: string): Promise<ClaimedJob | null>;
  /** Saves the resume point and extends the lease, inside the caller's transaction when given. false = the lease is no longer ours. */
  checkpoint(job: ClaimedJob, cursor: string | null, leaseMs: number, tx?: Tx): Promise<boolean>;
  /** Marks the job DONE. false = the lease is no longer ours (nothing written). */
  complete(job: ClaimedJob): Promise<boolean>;
  /** Hands the job back, to run again at `runAfter`; `failed` counts an attempt and records the error. `dead` ends it. */
  release(job: ClaimedJob, input: { runAfter: Date; error?: string; countAttempt?: boolean; dead?: boolean }): Promise<boolean>;
}

/** Thrown by `checkpoint` when the lease belongs to someone else now: the handler must stop at once and write nothing more. */
export class JobLeaseLostError extends Error {
  constructor(jobId: string) {
    super(`Lease of job ${jobId} was lost`);
    this.name = "JobLeaseLostError";
  }
}

export type JobContext<Tx = unknown> = {
  job: ClaimedJob;
  /** True when the run's time budget is spent: finish the current piece, save the cursor, return "continue". */
  shouldYield(): boolean;
  /** Saves `cursor` and extends the lease (pass the open transaction to make it atomic with the work). Throws JobLeaseLostError. */
  checkpoint(cursor: string | null, tx?: Tx): Promise<void>;
};

export type JobOutcome = "done" | "continue";
export type JobHandler<Tx = unknown> = (ctx: JobContext<Tx>) => Promise<JobOutcome>;

export type RunJobsResult = { claimed: number; done: number; continued: number; retried: number; dead: number; leaseLost: number };

export type RunJobsDeps<Tx = unknown> = {
  store: DurableJobStore<Tx>;
  handlers: Partial<Record<DurableJobKind, JobHandler<Tx>>>;
  now?: () => number;
  budgetMs?: number;
  maxJobs?: number;
  leaseMs?: number;
  maxAttempts?: number;
  newToken?: () => string;
};

/** 1, 2, 4, ... minutes, at most 30. `attempts` is the number of failures so far (>= 1). */
export function durableJobBackoffMs(attempts: number): number {
  return Math.min(30, 2 ** Math.max(0, attempts - 1)) * 60_000;
}

export async function runDurableJobs<Tx = unknown>(deps: RunJobsDeps<Tx>): Promise<RunJobsResult> {
  const { store, handlers } = deps;
  const now = deps.now ?? Date.now;
  const budgetMs = deps.budgetMs ?? DURABLE_JOB_RUN_BUDGET_MS;
  const leaseMs = deps.leaseMs ?? DURABLE_JOB_LEASE_MS;
  const maxAttempts = deps.maxAttempts ?? DURABLE_JOB_MAX_ATTEMPTS;
  const maxJobs = deps.maxJobs ?? 20;
  const newToken = deps.newToken ?? randomUUID;
  const startedAt = now();
  const kinds = Object.keys(handlers);
  const result: RunJobsResult = { claimed: 0, done: 0, continued: 0, retried: 0, dead: 0, leaseLost: 0 };
  if (kinds.length === 0) return result;

  while (result.claimed < maxJobs && now() - startedAt < budgetMs) {
    const job = await store.claimNext(kinds, leaseMs, newToken());
    if (!job) break;
    result.claimed += 1;
    const handler = handlers[job.kind as DurableJobKind];
    if (!handler) {
      // Cannot happen (claim filters by kind); give it back untouched rather than lose it.
      await store.release(job, { runAfter: new Date(now() + 60_000) });
      continue;
    }
    const ctx: JobContext<Tx> = {
      job,
      shouldYield: () => now() - startedAt >= budgetMs,
      checkpoint: async (cursor, tx) => {
        if (!(await store.checkpoint(job, cursor, leaseMs, tx))) throw new JobLeaseLostError(job.id);
      },
    };
    try {
      const outcome = await handler(ctx);
      if (outcome === "done") {
        if (await store.complete(job)) result.done += 1;
        else result.leaseLost += 1;
      } else {
        // Progress was made: due again at once (this run if the budget allows, otherwise the next one).
        if (await store.release(job, { runAfter: new Date(now()) })) result.continued += 1;
        else result.leaseLost += 1;
      }
    } catch (error) {
      if (error instanceof JobLeaseLostError) {
        result.leaseLost += 1;
        logger.warn("[durable-job] lease lost, run abandoned", { jobId: job.id, kind: job.kind });
        continue;
      }
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      const attempts = job.attempts + 1;
      const dead = attempts >= maxAttempts;
      logger.error("[durable-job] run failed", { jobId: job.id, kind: job.kind, attempts, dead, error: message });
      const released = await store
        .release(job, { runAfter: new Date(now() + durableJobBackoffMs(attempts)), error: message, countAttempt: true, dead })
        .catch(() => false);
      if (!released) result.leaseLost += 1;
      else if (dead) result.dead += 1;
      else result.retried += 1;
    }
  }
  return result;
}
