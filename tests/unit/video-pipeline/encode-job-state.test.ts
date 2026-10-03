import { describe, expect, it } from "vitest";
import {
  EncodeJobError,
  PERMANENT,
  STALE_HEARTBEAT_MS,
  canTransition,
  classifyFailure,
  decideAfterFailure,
  estimateEtaSeconds,
  isHeartbeatStale,
  isTerminalStatus,
  overallProgress,
  parseVersionNumber,
  retryDelayMs,
} from "@/lib/modules/video-pipeline/domain/encode-job.state";
import { hlsAssetKey, hlsContentType, hlsObjectKey, isUploadableHlsFile, sortForUpload } from "@/lib/modules/video-pipeline/domain/keys";
import { stepWeights } from "@/scripts/hls/encode-hls.mjs";

describe("encode job state machine", () => {
  it("allows only the documented transitions", () => {
    expect(canTransition("QUEUED", "RUNNING")).toBe(true);
    expect(canTransition("QUEUED", "CANCELLED")).toBe(true);
    expect(canTransition("QUEUED", "SUCCEEDED")).toBe(false);
    expect(canTransition("RUNNING", "QUEUED")).toBe(true); // retry
    expect(canTransition("RUNNING", "SUCCEEDED")).toBe(true);
    for (const terminal of ["SUCCEEDED", "FAILED", "CANCELLED"] as const) {
      expect(isTerminalStatus(terminal)).toBe(true);
      expect(canTransition(terminal, "QUEUED")).toBe(false);
      expect(canTransition(terminal, "RUNNING")).toBe(false);
    }
  });

  it("retries transient failures with growing backoff and gives up after maxAttempts", () => {
    const transient = classifyFailure(new Error("socket hang up"));
    expect(transient.permanent).toBe(false);
    expect(decideAfterFailure({ attemptCount: 1, maxAttempts: 3 }, transient)).toMatchObject({ next: "QUEUED", delayMs: 60_000 });
    expect(decideAfterFailure({ attemptCount: 2, maxAttempts: 3 }, transient)).toMatchObject({ next: "QUEUED", delayMs: 300_000 });
    expect(decideAfterFailure({ attemptCount: 3, maxAttempts: 3 }, transient)).toMatchObject({ next: "FAILED" });
    expect(retryDelayMs(99)).toBe(1_800_000);
  });

  it("fails permanent errors at once, whatever attempts are left", () => {
    const verdict = decideAfterFailure({ attemptCount: 1, maxAttempts: 3 }, classifyFailure(new EncodeJobError("X", "bad", true)));
    expect(verdict).toMatchObject({ next: "FAILED", code: "X" });
  });

  it("classifies ffmpeg/ffprobe messages about broken or audio-only files as permanent", () => {
    expect(classifyFailure(new Error("Source has no video stream"))).toMatchObject({ code: PERMANENT.NO_VIDEO_STREAM, permanent: true });
    expect(classifyFailure(new Error("ffprobe exited with 1\nInvalid data found when processing input"))).toMatchObject({ code: PERMANENT.INVALID_MEDIA, permanent: true });
    expect(classifyFailure(Object.assign(new Error("x"), { name: "NoSuchKey" }))).toMatchObject({ code: PERMANENT.ORIGINAL_MISSING, permanent: true });
  });

  it("detects a stale heartbeat", () => {
    const now = new Date("2026-10-03T12:00:00Z");
    expect(isHeartbeatStale(null, now)).toBe(true);
    expect(isHeartbeatStale(new Date(now.getTime() - STALE_HEARTBEAT_MS - 1), now)).toBe(true);
    expect(isHeartbeatStale(new Date(now.getTime() - 10_000), now)).toBe(false);
  });

  it("maps stage fractions onto one monotonic 0..100 progress", () => {
    expect(overallProgress("QUEUED", 0.5)).toBe(0);
    expect(overallProgress("DOWNLOADING", 1)).toBe(8);
    expect(overallProgress("ENCODING", 0)).toBe(9);
    expect(overallProgress("ENCODING", 0.5)).toBeGreaterThan(overallProgress("ENCODING", 0.1));
    expect(overallProgress("UPLOADING", 1)).toBe(99);
    expect(overallProgress("DONE", 0)).toBe(100);
    expect(overallProgress("ENCODING", Number.NaN)).toBe(9);
    expect(overallProgress("ENCODING", 7)).toBe(90);
  });

  it("gives no ETA until there is enough signal, then extrapolates", () => {
    expect(estimateEtaSeconds({ stageElapsedMs: 5_000, fraction: 0.5 })).toBeNull();
    expect(estimateEtaSeconds({ stageElapsedMs: 60_000, fraction: 0.01 })).toBeNull();
    expect(estimateEtaSeconds({ stageElapsedMs: 60_000, fraction: 0.5 })).toBe(60);
    expect(estimateEtaSeconds({ stageElapsedMs: 60_000, fraction: 0.5, remainingStagesSeconds: 30 })).toBe(90);
  });

  it("weights the loudness pre-pass small against the one encode of all rungs", () => {
    const ladder = [{ width: 1280, height: 720 }, { width: 640, height: 360 }];
    expect(stepWeights(ladder, true)).toEqual([92160, 1152000]);
    expect(stepWeights(ladder, false)).toEqual([1152000]);
  });

  it("parses HLS output generations", () => {
    expect(parseVersionNumber("videos/abc/v/v3")).toBe(3);
    expect(parseVersionNumber("v12")).toBe(12);
    expect(parseVersionNumber("videos/abc/v/final")).toBe(0);
    expect(parseVersionNumber(null)).toBe(0);
  });
});

describe("hls keys", () => {
  it("builds the object keys the Worker and SelfHlsTokenService expect", () => {
    expect(hlsAssetKey("vid", 2)).toBe("videos/vid/v/v2");
    expect(hlsObjectKey("vid", 2, "720p/seg_00001.m4s")).toBe("videos/vid/v/v2/720p/seg_00001.m4s");
    expect(hlsContentType("master.m3u8")).toBe("application/vnd.apple.mpegurl");
    expect(hlsContentType("x.bin")).toBe("application/octet-stream");
  });

  it("uploads the master playlist last and never meta.json", () => {
    const files = ["master.m3u8", "720p/index.m3u8", "poster.jpg", "meta.json", "720p/.probe.mp4"].filter(isUploadableHlsFile);
    expect(sortForUpload(files)).toEqual(["720p/index.m3u8", "poster.jpg", "master.m3u8"]);
  });
});
