import { mkdtemp, mkdir, rm, writeFile, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { VideoEncodeJob } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { processEncodeJob, type EncodeOutcome, type ProcessorPorts, type SourceProbe } from "@/lib/modules/video-pipeline/application/process-encode-job";
import type { EncodeJobStore } from "@/lib/modules/video-pipeline/infrastructure/encode-job.repository";

function makeJob(overrides: Partial<VideoEncodeJob> = {}): VideoEncodeJob {
  return {
    id: "job-1",
    videoId: "vid-1",
    originalId: "orig-1",
    versionNumber: 2,
    idempotencyKey: "orig-1:1",
    status: "RUNNING",
    stage: "DOWNLOADING",
    progressPercent: 0,
    etaSeconds: null,
    attemptCount: 1,
    maxAttempts: 3,
    cancelRequested: false,
    failureCode: null,
    failureReason: null,
    nextAttemptAt: null,
    workerId: "w1",
    heartbeatAt: new Date(),
    startedAt: new Date(),
    finishedAt: null,
    requestedById: null,
    assetId: null,
    sourceInfo: null,
    result: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const GOOD_PROBE: SourceProbe = { width: 1280, height: 720, duration: 30, hdr: false, hasAudio: true, videoCodec: "h264", sizeBytes: 1000 };

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "pipeline-test-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function writeOutput(out: string, extra: string[] = []) {
  await mkdir(path.join(out, "720p"), { recursive: true });
  for (const f of ["master.m3u8", "720p/index.m3u8", "720p/init.mp4", "720p/seg_00001.m4s", "poster.jpg", "meta.json", ...extra]) {
    await writeFile(path.join(out, f), "x");
  }
}

function harness(opts: { job?: VideoEncodeJob; cancelAfterFirstProgress?: boolean } = {}) {
  const job = opts.job ?? makeJob();
  const events: string[] = [];
  const state = { cancelRequested: false, owned: true };
  const store: EncodeJobStore = {
    requeueStale: vi.fn(),
    claimNext: vi.fn(),
    reportProgress: vi.fn(async () => ({ owned: state.owned, cancelRequested: state.cancelRequested })),
    markSucceeded: vi.fn(async () => { events.push("markSucceeded"); return true; }),
    markFailedOrRetry: vi.fn(async () => { events.push("markFailedOrRetry"); return true; }),
    markCancelled: vi.fn(async () => { events.push("markCancelled"); return true; }),
    release: vi.fn(async () => { events.push("release"); return true; }),
  };
  const uploaded: string[] = [];
  const hls = {
    bucket: "polutek-hls",
    putFile: vi.fn(async (key: string) => { uploaded.push(key); events.push(`put:${key.split("/").slice(4).join("/")}`); return 1; }),
    exists: vi.fn(async () => true),
    countPrefix: vi.fn(async () => uploaded.length),
    deletePrefix: vi.fn(async () => { events.push("deletePrefix"); return 0; }),
  };
  const encoder = {
    probe: vi.fn(async () => GOOD_PROBE),
    encode: vi.fn(async ({ out, onProgress }: { out: string; onProgress: (p: { overall: number; step: string; name: string }) => void; signal: AbortSignal }): Promise<EncodeOutcome> => {
      await writeOutput(out);
      onProgress({ overall: 0.5, step: "rung", name: "720p" });
      return { meta: { source: { durationSeconds: 30 }, rungs: [] }, issues: [] };
    }),
  };
  const finalizer = {
    findExisting: vi.fn(async (): Promise<string | null> => null),
    finalize: vi.fn(async () => { events.push("finalize"); return { assetId: "asset-1" }; }),
  };
  const audit = vi.fn(async (action: string) => { events.push(`audit:${action}`); });
  const shutdown = new AbortController();
  const ports: ProcessorPorts = {
    store,
    workerId: "w1",
    workRoot: root,
    originals: {
      loadOriginal: vi.fn(async () => ({ bucket: "polutek", objectKey: "originals/vid-1/1.mp4", originalFileName: "a.mp4", sizeBytes: 1000 })),
      download: vi.fn(async (_ref, dest, o) => { await writeFile(dest, "src"); o.onBytes(1, 1); events.push("download"); return 3; }),
    },
    hls,
    encoder,
    finalizer,
    audit,
    now: () => new Date("2026-10-03T12:00:00Z"),
    log: () => undefined,
    heartbeatIntervalMs: 10,
    shutdown: shutdown.signal,
    ensureDisk: vi.fn(async () => undefined),
  };
  return { job, ports, store, hls, encoder, finalizer, audit, events, uploaded, state, shutdown };
}

describe("processEncodeJob", () => {
  it("runs the whole pipeline, uploads the master last and publishes only after verification", async () => {
    const h = harness();
    const outcome = await processEncodeJob(h.job, h.ports);
    expect(outcome).toBe("succeeded");

    const putOrder = h.events.filter((e) => e.startsWith("put:"));
    expect(putOrder.at(-1)).toBe("put:master.m3u8");
    expect(putOrder).toContain("put:720p/seg_00001.m4s");
    expect(putOrder).not.toContain("put:meta.json");
    // finalize (asset + route) strictly after the uploads and the R2 verification
    expect(h.events.indexOf("finalize")).toBeGreaterThan(h.events.indexOf("put:master.m3u8"));
    expect(h.events.indexOf("markSucceeded")).toBeGreaterThan(h.events.indexOf("finalize"));
    expect(h.uploaded.every((k) => k.startsWith("videos/vid-1/v/v2/"))).toBe(true);
    expect(h.hls.deletePrefix).toHaveBeenCalledWith("videos/vid-1/v/v2/"); // empties a stale partial attempt first
    expect(h.audit).toHaveBeenCalledWith("VIDEO_ENCODE_STARTED", expect.anything(), expect.anything());
    expect(h.audit).toHaveBeenCalledWith("VIDEO_ENCODE_SUCCEEDED", expect.anything(), expect.objectContaining({ assetId: "asset-1" }));
    // the work directory is gone
    await expect(access(path.join(root, "job-1"))).rejects.toBeTruthy();
  });

  it("never finalizes when the R2 object count does not match, and retries", async () => {
    const h = harness();
    h.hls.countPrefix.mockResolvedValue(1);
    const outcome = await processEncodeJob(h.job, h.ports);
    expect(outcome).toBe("retry");
    expect(h.finalizer.finalize).not.toHaveBeenCalled();
    expect(h.store.markFailedOrRetry).toHaveBeenCalledWith("job-1", "w1", expect.objectContaining({ next: "QUEUED", code: "UPLOAD_VERIFY_FAILED" }), expect.any(Date));
    // the partial output is removed so nothing half-uploaded can be reached
    expect(h.hls.deletePrefix.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("encodes HDR input (the encoder tone-maps it) and records it in the source info", async () => {
    const h = harness();
    h.encoder.probe.mockResolvedValue({ ...GOOD_PROBE, hdr: true });
    const outcome = await processEncodeJob(h.job, h.ports);
    expect(outcome).toBe("succeeded");
    expect(h.encoder.encode).toHaveBeenCalledTimes(1);
    expect(h.store.reportProgress).toHaveBeenCalledWith("job-1", "w1", expect.objectContaining({ sourceInfo: expect.objectContaining({ hdr: true }) }));
  });

  it("rejects over-long and over-large sources", async () => {
    const long = harness();
    long.encoder.probe.mockResolvedValue({ ...GOOD_PROBE, duration: 7 * 3600 });
    expect(await processEncodeJob(long.job, long.ports)).toBe("failed");
    const big = harness();
    big.encoder.probe.mockResolvedValue({ ...GOOD_PROBE, width: 10000 });
    expect(await processEncodeJob(big.job, big.ports)).toBe("failed");
  });

  describe("per-channel length limit (ChannelQuota.maxVideoSeconds)", () => {
    it("fails a source over the channel limit with a creator-readable permanent reason", async () => {
      const h = harness();
      h.encoder.probe.mockResolvedValue({ ...GOOD_PROBE, duration: 901 });
      h.ports.channelLimits = { maxVideoSeconds: vi.fn(async () => 900) };
      expect(await processEncodeJob(h.job, h.ports)).toBe("failed");
      expect(h.store.markFailedOrRetry).toHaveBeenCalledWith("job-1", "w1", expect.objectContaining({ code: "CHANNEL_DURATION_LIMIT", next: "FAILED", message: expect.stringContaining("15 min") }), expect.any(Date));
      expect(h.encoder.encode).not.toHaveBeenCalled();
    });

    it("accepts a source exactly at the limit", async () => {
      const h = harness();
      h.encoder.probe.mockResolvedValue({ ...GOOD_PROBE, duration: 900 });
      h.ports.channelLimits = { maxVideoSeconds: vi.fn(async () => 900) };
      expect(await processEncodeJob(h.job, h.ports)).toBe("succeeded");
    });

    it("applies no channel limit when none resolves (main channel, staff job)", async () => {
      const h = harness();
      h.encoder.probe.mockResolvedValue({ ...GOOD_PROBE, duration: 5 * 3600 });
      h.ports.channelLimits = { maxVideoSeconds: vi.fn(async () => null) };
      expect(await processEncodeJob(h.job, h.ports)).toBe("succeeded");
    });
  });

  it("treats a source without video (audio-only) as a permanent failure", async () => {
    const h = harness();
    h.encoder.probe.mockRejectedValue(new Error("Source has no video stream"));
    expect(await processEncodeJob(h.job, h.ports)).toBe("failed");
    expect(h.store.markFailedOrRetry).toHaveBeenCalledWith("job-1", "w1", expect.objectContaining({ code: "NO_VIDEO_STREAM", next: "FAILED" }), expect.any(Date));
  });

  it("does not publish an output that failed encoder validation", async () => {
    const h = harness();
    h.encoder.encode.mockImplementation(async ({ out }: { out: string }) => {
      await writeOutput(out);
      return { meta: { source: {} }, issues: ["720p/index.m3u8: duration differs"] };
    });
    expect(await processEncodeJob(h.job, h.ports)).toBe("failed");
    expect(h.hls.putFile).not.toHaveBeenCalled();
    expect(h.finalizer.finalize).not.toHaveBeenCalled();
  });

  it("retries a transient upload error and stops after the last attempt", async () => {
    const first = harness();
    first.hls.putFile.mockRejectedValueOnce(new Error("socket hang up"));
    expect(await processEncodeJob(first.job, first.ports)).toBe("retry");
    expect(first.hls.deletePrefix).toHaveBeenCalledTimes(2); // before upload + cleanup

    const last = harness({ job: makeJob({ attemptCount: 3 }) });
    last.hls.putFile.mockRejectedValue(new Error("socket hang up"));
    expect(await processEncodeJob(last.job, last.ports)).toBe("failed");
  });

  it("stops ffmpeg and cleans R2 when the admin cancels", async () => {
    const h = harness();
    h.encoder.encode.mockImplementation(({ signal }: { signal: AbortSignal }) =>
      new Promise<EncodeOutcome>((_, reject) => {
        h.state.cancelRequested = true; // the next heartbeat will see the flag
        signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      }),
    );
    const outcome = await processEncodeJob(h.job, h.ports);
    expect(outcome).toBe("cancelled");
    expect(h.store.markCancelled).toHaveBeenCalled();
    expect(h.finalizer.finalize).not.toHaveBeenCalled();
    expect(h.store.markFailedOrRetry).not.toHaveBeenCalled();
    expect(h.audit).toHaveBeenCalledWith("VIDEO_ENCODE_CANCELLED", expect.anything(), expect.anything());
  });

  it("backs off without touching the job when another worker took the claim", async () => {
    const h = harness();
    h.encoder.encode.mockImplementation(({ signal }: { signal: AbortSignal }) =>
      new Promise<EncodeOutcome>((_, reject) => {
        h.state.owned = false;
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      }),
    );
    expect(await processEncodeJob(h.job, h.ports)).toBe("lost");
    expect(h.store.markFailedOrRetry).not.toHaveBeenCalled();
    expect(h.store.markCancelled).not.toHaveBeenCalled();
    expect(h.store.markSucceeded).not.toHaveBeenCalled();
  });

  it("hands the job back on shutdown without consuming the attempt", async () => {
    const h = harness();
    h.encoder.encode.mockImplementation(({ signal }: { signal: AbortSignal }) =>
      new Promise<EncodeOutcome>((_, reject) => {
        setTimeout(() => h.shutdown.abort(), 20);
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      }),
    );
    expect(await processEncodeJob(h.job, h.ports)).toBe("released");
    expect(h.store.release).toHaveBeenCalledWith("job-1", "w1");
    expect(h.store.markFailedOrRetry).not.toHaveBeenCalled();
  });

  it("is idempotent: an output that is already live is only marked done (no re-encode, no R2 delete)", async () => {
    const h = harness();
    h.finalizer.findExisting.mockResolvedValue("asset-live");
    expect(await processEncodeJob(h.job, h.ports)).toBe("succeeded");
    expect(h.ports.originals.download).not.toHaveBeenCalled();
    expect(h.hls.deletePrefix).not.toHaveBeenCalled();
    expect(h.store.markSucceeded).toHaveBeenCalledWith("job-1", "w1", expect.objectContaining({ assetId: "asset-live" }));
  });

  it("does not delete a live output when marking success fails after finalize", async () => {
    const h = harness();
    h.store.markSucceeded = vi.fn(async () => { throw new Error("db down"); });
    const outcome = await processEncodeJob(h.job, h.ports);
    expect(outcome).toBe("retry");
    // only the pre-upload emptying ran; the finalized prefix must stay
    expect(h.hls.deletePrefix).toHaveBeenCalledTimes(1);
  });

  it("checks free disk space from the original size before downloading", async () => {
    const h = harness();
    h.ports.ensureDisk = vi.fn(async () => { throw Object.assign(new Error("Za malo miejsca"), { code: "DISK_FULL" }); });
    expect(await processEncodeJob(h.job, h.ports)).toBe("retry");
    expect(h.ports.originals.download).not.toHaveBeenCalled();
  });
});
