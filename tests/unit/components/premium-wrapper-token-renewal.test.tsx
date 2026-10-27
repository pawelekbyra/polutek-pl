/** @vitest-environment jsdom */

import React, { useEffect } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlaybackPlan } from "@/lib/modules/playback";

vi.mock("@/lib/auth/react", () => ({ useAuth: () => ({ isLoaded: true, userId: "u1", sessionId: "s1" }) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/app/components/PlayerLoadingState", () => ({ PlayerLoadingState: () => <div data-testid="player-loading" /> }));
vi.mock("@/app/components/PlayerStateFrame", () => ({ PlayerStateFrame: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/app/components/AccessLockOverlay", () => ({ default: ({ state }: { state: string }) => <div data-testid="player-locked">{state}</div> }));

import PremiumWrapper from "@/app/components/PremiumWrapper";
import { useVideoAccess } from "@/app/components/VideoAccessContext";

const VIDEO_ID = "video-1";

function readyPlan(token: string, expiresInMs: number): PlaybackPlan {
  return {
    videoId: VIDEO_ID,
    status: "READY",
    canPlay: true,
    access: { allowed: true },
    source: {
      provider: "SELF_HLS",
      kind: "self_hls",
      playbackUrl: `https://video.pawelperfect.com/h/${token}/${VIDEO_ID}/v1/master.m3u8`,
      isSignedUrl: true,
      expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    },
    player: { autoplayAllowed: false, mutedAutoplay: false, controls: true, poster: "", title: "Video" },
    diagnostics: { warnings: [], sourceConfidence: "HIGH", providerResolutionAllowed: true, providerResolutionAttempted: true },
    tracking: { playbackSessionId: "playback-session", heartbeatIntervalSeconds: 60 },
  };
}

const seen = { mounts: 0, urls: [] as string[] };
function PlayerProbe() {
  const { playbackPlan } = useVideoAccess();
  useEffect(() => {
    seen.mounts += 1;
  }, []);
  useEffect(() => {
    if (playbackPlan?.source?.playbackUrl) seen.urls.push(playbackPlan.source.playbackUrl);
  }, [playbackPlan]);
  return <div data-testid="player" />;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("PremiumWrapper token renewal", { timeout: 15_000 }, () => {
  beforeEach(() => {
    seen.mounts = 0;
    seen.urls = [];
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renews a token that is about to expire in place: same session asked for, player never unmounted", async () => {
    const fetchMock = vi.fn()
      // Expires within the 2-minute window. A short token is renewed halfway (at least 5 s after it arrives), so that a
      // token cut short by the end of a pass does not cause a request storm (audit S08).
      .mockResolvedValueOnce(json(readyPlan("old", 6_000)))
      .mockResolvedValueOnce(json(readyPlan("new", 6 * 3600_000)));
    vi.stubGlobal("fetch", fetchMock);

    render(<PremiumWrapper videoId={VIDEO_ID} requiredTier="LOGGED_IN"><PlayerProbe /></PremiumWrapper>);

    await waitFor(() => expect(seen.urls.at(-1)).toContain("/h/new/"), { timeout: 9_000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/media-source/${VIDEO_ID}?session=playback-session`);
    expect(seen.mounts).toBe(1);
    expect(screen.queryByTestId("player-loading")).toBeNull();
  });

  it("keeps the current plan when the renewal fails on the server side (5xx)", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(readyPlan("old", 6_000)))
      .mockResolvedValue(json({ error: "boom" }, 503));
    vi.stubGlobal("fetch", fetchMock);

    render(<PremiumWrapper videoId={VIDEO_ID} requiredTier="LOGGED_IN"><PlayerProbe /></PremiumWrapper>);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 9_000 });
    expect(screen.getByTestId("player")).toBeTruthy();
    expect(seen.urls.at(-1)).toContain("/h/old/");
    expect(seen.mounts).toBe(1);
  });
});
