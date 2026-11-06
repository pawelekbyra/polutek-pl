import { describe, expect, it, vi } from "vitest";
import {
  MultipartStartResponseSchema,
  PipelineStateResponseSchema,
  PlaybackPlanResponseSchema,
  readPlaybackPlan,
} from "@/lib/video-api-contracts/contracts";
import { studioApiContract } from "@/app/components/studio/studio-client";

const pipeline = {
  summary: "QUEUED",
  workerAlive: true,
  original: { id: "original-1", status: "READY", fileName: "a.mp4", sizeBytes: "100", version: 1, failureReason: null, uploadCompletedAt: null },
  job: {
    id: "job-1", status: "QUEUED", stage: "QUEUED", progressPercent: 0, etaSeconds: null,
    attemptCount: 0, maxAttempts: 3, versionNumber: 1, originalId: "original-1", assetId: null,
    cancelRequested: false, failureCode: null, failureReason: null, nextAttemptAt: null,
    createdAt: "2026-11-06T00:00:00.000Z", startedAt: null, finishedAt: null, heartbeatFresh: false,
  },
  assets: [],
  hasCompetingSource: false,
};

const playbackPlan = {
  videoId: "video-1", status: "LOGIN_REQUIRED", canPlay: false,
  access: { allowed: false },
  player: { autoplayAllowed: false, mutedAutoplay: false, controls: true, poster: "/poster.jpg", title: "Film" },
  diagnostics: { warnings: [], sourceConfidence: "LOW", providerResolutionAllowed: false, providerResolutionAttempted: false },
  tracking: { playbackSessionId: "", heartbeatIntervalSeconds: 0 },
  hasAccess: false,
};

describe("video API runtime contracts", () => {
  it("accepts canonical job/pipeline and playback responses", () => {
    expect(PipelineStateResponseSchema.safeParse(pipeline).success).toBe(true);
    expect(PlaybackPlanResponseSchema.safeParse(playbackPlan).success).toBe(true);
    expect(readPlaybackPlan(playbackPlan)?.videoId).toBe("video-1");
  });

  it.each([
    ["null", null],
    ["missing upload identifiers", { partSize: 8, partCount: 1 }],
    ["zero part count", { originalId: "o1", partSize: 8, partCount: 0 }],
  ])("rejects %s at the upload boundary", (_name, body) => {
    expect(MultipartStartResponseSchema.safeParse(body).success).toBe(false);
  });

  it("rejects unknown job and playback statuses instead of passing them to UI code", () => {
    expect(PipelineStateResponseSchema.safeParse({ ...pipeline, summary: "WAITING_MAYBE" }).success).toBe(false);
    expect(readPlaybackPlan({ ...playbackPlan, status: "PLAY_EVERYTHING" })).toBeNull();
  });

  it.each([
    ["null JSON", "null"],
    ["wrong fields", JSON.stringify({ originalId: "o1" })],
    ["invalid JSON", "{"],
  ])("turns a 200 with %s into a controlled contract error", async (_name, body) => {
    const fetchImpl = vi.fn(async () => new Response(body, { status: 200 }));
    await expect(studioApiContract("/api/studio/videos/v1/upload", MultipartStartResponseSchema, {}, fetchImpl as unknown as typeof fetch))
      .rejects.toMatchObject({ status: 502, code: "API_CONTRACT_MISMATCH" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
