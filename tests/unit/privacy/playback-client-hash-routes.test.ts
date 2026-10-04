/**
 * The guest playback session created by /api/media-source and the events posted to
 * /api/videos/[id]/playback-event must carry the same keyed hashes, or every guest's events would be
 * rejected as a fingerprint mismatch. Neither route may store the plain SHA-256 any more.
 */
import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api/auth", () => ({ getActorFromAuth: vi.fn().mockResolvedValue({ type: "guest" }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue({ success: true }), setNxEx: vi.fn() }));
vi.mock("@/lib/modules/playback", () => ({ PlaybackService: { createPlaybackPlanWithContext: vi.fn() } }));
vi.mock("@/lib/modules/video", () => ({ recordPlaybackEventUseCase: vi.fn() }));

import { GET as mediaSource } from "@/app/api/media-source/[videoId]/route";
import { POST as playbackEvent } from "@/app/api/videos/[id]/playback-event/route";
import { PlaybackService } from "@/lib/modules/playback";
import { recordPlaybackEventUseCase } from "@/lib/modules/video";

const HEADERS = { "x-forwarded-for": "203.0.113.7", "user-agent": "TestBrowser/1.0" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("IP_HASH_SECRET", "k".repeat(40));
  vi.mocked(PlaybackService.createPlaybackPlanWithContext).mockResolvedValue({
    videoId: "v1",
    status: "LOGIN_REQUIRED",
    canPlay: false,
    access: { allowed: false },
    diagnostics: { warnings: [] },
    tracking: { playbackSessionId: "" },
  } as never);
  vi.mocked(recordPlaybackEventUseCase).mockResolvedValue({ ok: true, data: { success: true } } as never);
});
afterEach(() => vi.unstubAllEnvs());

describe("client hashes shared by the playback routes", () => {
  it("media-source and playback-event hash the same client identically, with a key", async () => {
    await mediaSource(new NextRequest("http://localhost/api/media-source/v1", { headers: HEADERS }), { params: Promise.resolve({ videoId: "v1" }) });
    await playbackEvent(
      new NextRequest("http://localhost/api/videos/v1/playback-event", { method: "POST", headers: HEADERS, body: JSON.stringify({ type: "PLAYER_READY" }) }),
      { params: Promise.resolve({ id: "v1" }) },
    );

    const [, , sessionIpHash, sessionUaHash] = vi.mocked(PlaybackService.createPlaybackPlanWithContext).mock.calls[0];
    const eventInput = vi.mocked(recordPlaybackEventUseCase).mock.calls[0][0] as { ipHash: string; uaHash: string; fingerprint: string };

    expect(eventInput.ipHash).toBe(sessionIpHash);
    expect(eventInput.uaHash).toBe(sessionUaHash);
    expect(sessionIpHash).not.toBe(crypto.createHash("sha256").update("203.0.113.7").digest("hex"));
    expect(eventInput.fingerprint).not.toBe(crypto.createHash("sha256").update("203.0.113.7:TestBrowser/1.0").digest("hex"));
  });
});
