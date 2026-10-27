import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import {
  DURABLE_JOB_LEASE_MS,
  DURABLE_JOB_MAX_ATTEMPTS,
  JobLeaseLostError,
  durableJobBackoffMs,
  runDurableJobs,
  type JobHandler,
} from "@/lib/modules/shared/durable-job";
import { createMemoryJobStore } from "./memory-job-store";

const run = (store: ReturnType<typeof createMemoryJobStore>, handler: JobHandler, extra: { budgetMs?: number } = {}) =>
  runDurableJobs({ store, handlers: { NEW_VIDEO_FANOUT: handler }, now: () => store.clock.now, ...extra });

describe("durable job runner", () => {
  it("runs a job once and marks it DONE; a second enqueue of the same key is a no-op", async () => {
    const store = createMemoryJobStore();
    await store.enqueue({ kind: "NEW_VIDEO_FANOUT", dedupeKey: "v1", payload: {} });
    await store.enqueue({ kind: "NEW_VIDEO_FANOUT", dedupeKey: "v1", payload: {} });
    expect(store.jobs).toHaveLength(1);
    const handler = vi.fn<JobHandler>(async () => "done");
    expect(await run(store, handler)).toMatchObject({ claimed: 1, done: 1 });
    expect(store.jobs[0].status).toBe("DONE");
    await run(store, handler);
    expect(handler).toHaveBeenCalledTimes(1); // DONE jobs are never taken again
  });

  it("an enqueue with reopen puts a finished job back to PENDING from the start; a pending one is left alone", async () => {
    const store = createMemoryJobStore();
    await store.enqueue({ kind: "NEW_VIDEO_FANOUT", dedupeKey: "v1", payload: {} });
    await run(store, async () => "done");
    store.jobs[0].cursor = "u9";
    await store.enqueue({ kind: "NEW_VIDEO_FANOUT", dedupeKey: "v1", payload: {}, reopen: ["DONE", "DEAD"] });
    expect(store.jobs[0]).toMatchObject({ status: "PENDING", cursor: null });
    store.jobs[0].cursor = "u5";
    await store.enqueue({ kind: "NEW_VIDEO_FANOUT", dedupeKey: "v1", payload: {}, reopen: ["DONE", "DEAD"] });
    expect(store.jobs[0].cursor).toBe("u5"); // PENDING: nothing reset, the running fan-out is not restarted
  });

  it("resumes after an interruption: 'continue' keeps the cursor and the next claim starts from it", async () => {
    const store = createMemoryJobStore();
    await store.enqueue({ kind: "NEW_VIDEO_FANOUT", dedupeKey: "v1", payload: {} });
    const seenCursors: Array<string | null> = [];
    const handler: JobHandler = async (ctx) => {
      seenCursors.push(ctx.job.cursor);
      await ctx.checkpoint(ctx.job.cursor === null ? "page-1" : "page-2");
      return ctx.job.cursor === "page-1" ? "done" : "continue";
    };
    await run(store, handler);
    expect(seenCursors).toEqual([null, "page-1"]);
    expect(store.jobs[0]).toMatchObject({ status: "DONE", cursor: "page-2" });
  });

  it("a crash mid-way (lease never released) is taken over by another run after the lease expires, from the saved cursor", async () => {
    const store = createMemoryJobStore();
    await store.enqueue({ kind: "NEW_VIDEO_FANOUT", dedupeKey: "v1", payload: {} });
    // Process A takes the job, saves page 1 and dies without releasing it.
    const a = (await store.claimNext(["NEW_VIDEO_FANOUT"], DURABLE_JOB_LEASE_MS, "token-A"))!;
    await store.checkpoint(a, "page-1", DURABLE_JOB_LEASE_MS);

    // Before the lease runs out nobody else can take it.
    const handler = vi.fn<JobHandler>(async () => "done");
    expect(await run(store, handler)).toMatchObject({ claimed: 0 });
    expect(handler).not.toHaveBeenCalled();

    store.clock.now += DURABLE_JOB_LEASE_MS + 1;
    expect(await run(store, handler)).toMatchObject({ claimed: 1, done: 1 });
    expect(handler.mock.calls[0][0].job.cursor).toBe("page-1");

    // The old process wakes up: every write of it is refused.
    expect(await store.checkpoint(a, "page-9", DURABLE_JOB_LEASE_MS)).toBe(false);
    expect(await store.complete(a)).toBe(false);
    expect(await store.release(a, { runAfter: new Date(0) })).toBe(false);
    expect(store.jobs[0]).toMatchObject({ status: "DONE", cursor: "page-1" });
  });

  it("a handler that lost its lease stops quietly and does not touch the job the new owner holds", async () => {
    const store = createMemoryJobStore();
    await store.enqueue({ kind: "NEW_VIDEO_FANOUT", dedupeKey: "v1", payload: {} });
    const result = await run(store, async (ctx) => {
      store.jobs[0].lockedBy = "token-other"; // somebody took the job over while this run was stalled
      await ctx.checkpoint("page-1"); // throws JobLeaseLostError
      return "done";
    });
    expect(result).toMatchObject({ leaseLost: 1, done: 0, retried: 0 });
    expect(store.jobs[0]).toMatchObject({ status: "PENDING", lockedBy: "token-other", attempts: 0 });
  });

  it("retries a failing job with exponential backoff and gives up (DEAD) after the attempt limit", async () => {
    const store = createMemoryJobStore();
    await store.enqueue({ kind: "NEW_VIDEO_FANOUT", dedupeKey: "v1", payload: {} });
    const handler = vi.fn<JobHandler>(async () => {
      throw new Error("db down");
    });
    for (let attempt = 1; attempt <= DURABLE_JOB_MAX_ATTEMPTS; attempt++) {
      const before = store.clock.now;
      const result = await run(store, handler);
      expect(result.claimed).toBe(1);
      expect(store.jobs[0].attempts).toBe(attempt);
      if (attempt < DURABLE_JOB_MAX_ATTEMPTS) {
        expect(store.jobs[0]).toMatchObject({ status: "PENDING", lastError: "db down" });
        expect(store.jobs[0].runAfter).toBe(before + durableJobBackoffMs(attempt));
        // not due yet: a run right now does nothing
        expect((await run(store, handler)).claimed).toBe(0);
        store.clock.now = store.jobs[0].runAfter;
      }
    }
    expect(store.jobs[0].status).toBe("DEAD");
    store.clock.now += 10 * 60 * 60_000;
    expect((await run(store, handler)).claimed).toBe(0);
  });

  it("backoff doubles from one minute and is capped at 30", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => durableJobBackoffMs(n) / 60_000)).toEqual([1, 2, 4, 8, 16, 30, 30]);
  });

  it("stops claiming when the time budget is used (shouldYield turns true) and leaves the rest for the next run", async () => {
    const store = createMemoryJobStore();
    await store.enqueue({ kind: "NEW_VIDEO_FANOUT", dedupeKey: "v1", payload: {} });
    await store.enqueue({ kind: "NEW_VIDEO_FANOUT", dedupeKey: "v2", payload: {} });
    const result = await run(
      store,
      async () => {
        store.clock.now += 50_000;
        return "done";
      },
      { budgetMs: 45_000 },
    );
    expect(result.done).toBe(1);
    expect(store.jobs.filter((j) => j.status === "PENDING")).toHaveLength(1);
  });

  it("JobLeaseLostError is a real error type the handlers can rely on", () => {
    expect(new JobLeaseLostError("j1")).toBeInstanceOf(Error);
  });
});
