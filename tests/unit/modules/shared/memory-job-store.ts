import type { ClaimedJob, DurableJobStore, EnqueueInput } from "@/lib/modules/shared/durable-job";

export type MemoryJob = {
  id: string;
  kind: string;
  dedupeKey: string;
  payload: unknown;
  status: "PENDING" | "DONE" | "DEAD";
  attempts: number;
  cursor: string | null;
  runAfter: number;
  lockedBy: string | null;
  lockedUntil: number | null;
  lastError: string | null;
};

/**
 * In-memory twin of DurableJobRepository with the same contract (lease owned by a token, every write
 * conditional on it) and a manual clock, so tests can let a lease run out and hand the job to another run.
 */
export function createMemoryJobStore() {
  const jobs: MemoryJob[] = [];
  const clock = { now: 1_000_000 };
  let seq = 0;
  const own = (job: ClaimedJob) => jobs.find((j) => j.id === job.id && j.lockedBy === job.token && j.status === "PENDING");

  const store: DurableJobStore & { jobs: MemoryJob[]; clock: typeof clock } = {
    jobs,
    clock,
    async enqueue(input: EnqueueInput) {
      const existing = jobs.find((j) => j.kind === input.kind && j.dedupeKey === input.dedupeKey);
      if (!existing) {
        jobs.push({ id: `job-${++seq}`, kind: input.kind, dedupeKey: input.dedupeKey, payload: input.payload, status: "PENDING", attempts: 0, cursor: null, runAfter: clock.now, lockedBy: null, lockedUntil: null, lastError: null });
      } else if ((input.reopen ?? []).includes(existing.status as "DONE" | "DEAD")) {
        Object.assign(existing, { status: "PENDING", cursor: null, attempts: 0, runAfter: clock.now, lockedBy: null, lockedUntil: null, lastError: null, payload: input.payload });
      }
    },
    async claimNext(kinds, leaseMs, token) {
      const job = jobs
        .filter((j) => j.status === "PENDING" && kinds.includes(j.kind) && j.runAfter <= clock.now && (j.lockedUntil === null || j.lockedUntil < clock.now))
        .sort((a, b) => a.runAfter - b.runAfter)[0];
      if (!job) return null;
      job.lockedBy = token;
      job.lockedUntil = clock.now + leaseMs;
      return { id: job.id, kind: job.kind, dedupeKey: job.dedupeKey, payload: job.payload, cursor: job.cursor, attempts: job.attempts, token };
    },
    async checkpoint(job, cursor, leaseMs) {
      const row = own(job);
      if (!row) return false;
      row.cursor = cursor;
      row.lockedUntil = clock.now + leaseMs;
      return true;
    },
    async complete(job) {
      const row = own(job);
      if (!row) return false;
      Object.assign(row, { status: "DONE", lockedBy: null, lockedUntil: null });
      return true;
    },
    async release(job, input) {
      const row = own(job);
      if (!row) return false;
      row.lockedBy = null;
      row.lockedUntil = null;
      row.runAfter = input.runAfter.getTime();
      if (input.error !== undefined) row.lastError = input.error;
      if (input.countAttempt) row.attempts += 1;
      if (input.dead) row.status = "DEAD";
      return true;
    },
  };
  return store;
}
