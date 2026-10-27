import type { VideoEncodeJob } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/modules/video-pipeline/application/process-encode-job", () => ({
  processEncodeJob: vi.fn(async (job: VideoEncodeJob) => (job.id === "bad" ? Promise.reject(new Error("boom")) : "succeeded")),
}));

import { abortableSleep, runWorkerLoop } from "@/lib/modules/video-pipeline/application/worker-loop";
import { processEncodeJob } from "@/lib/modules/video-pipeline/application/process-encode-job";

const job = (id: string) => ({ id, videoId: "v", attemptCount: 1 }) as unknown as VideoEncodeJob;

function deps(queue: VideoEncodeJob[], overrides: Record<string, unknown> = {}) {
  const store = {
    requeueStale: vi.fn(async () => ({ requeued: 0, failed: 0, cancelled: 0 })),
    claimNext: vi.fn(async () => queue.shift() ?? null),
  };
  return {
    store: store as never,
    workerId: "w",
    portsFor: () => ({}) as never,
    beat: vi.fn(async () => undefined),
    now: () => new Date(),
    sleep: vi.fn(async () => undefined),
    log: vi.fn(),
    shutdown: new AbortController().signal,
    ...overrides,
  };
}

describe("runWorkerLoop", () => {
  it("sweeps stale jobs, claims jobs one after another and sleeps when the queue is empty", async () => {
    const d = deps([job("a"), job("b")], { maxTurns: 3 });
    const res = await runWorkerLoop(d);
    expect(res.processed).toEqual(["succeeded", "succeeded"]);
    expect((d.store as unknown as { requeueStale: unknown }).requeueStale).toHaveBeenCalledTimes(3);
    expect(d.sleep).toHaveBeenCalledTimes(1); // only the empty third turn
    expect(d.beat).toHaveBeenCalledTimes(3);
  });

  it("survives a job that throws and keeps going", async () => {
    const d = deps([job("bad"), job("c")], { maxTurns: 2 });
    const res = await runWorkerLoop(d);
    expect(res.processed).toEqual(["succeeded"]);
    expect(processEncodeJob).toHaveBeenCalled();
    expect(d.log).toHaveBeenCalledWith("worker turn failed", expect.objectContaining({ error: "boom" }));
  });

  it("stops when shutdown is requested", async () => {
    const stop = new AbortController();
    stop.abort();
    const d = deps([job("a")], { shutdown: stop.signal });
    expect((await runWorkerLoop(d)).processed).toEqual([]);
  });
});

describe('abortableSleep (audit W21)', () => {
  it('removes its abort listener when the timer wins, so idle polling does not leak listeners', async () => {
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, 'addEventListener');
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    for (let i = 0; i < 20; i += 1) await abortableSleep(1, controller.signal);
    expect(add).toHaveBeenCalledTimes(20);
    expect(remove).toHaveBeenCalledTimes(20);
  });

  it('resolves at once on an abort, and for an already aborted signal', async () => {
    const controller = new AbortController();
    const pending = abortableSleep(60_000, controller.signal);
    controller.abort();
    await expect(pending).resolves.toBeUndefined();
    await expect(abortableSleep(60_000, controller.signal)).resolves.toBeUndefined();
  });
});
