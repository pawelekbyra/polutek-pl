/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lastPlayerProps: null as Record<string, unknown> | null,
  instance: { paused: true, muted: true, currentTime: 0, duration: 60, play: vi.fn() },
}));

vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ isLoaded: true, orgRole: null }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/app/components/player/PolutekControls", () => ({ default: () => null }));
vi.mock("@/lib/hooks/usePlaybackTelemetry", () => ({
  usePlaybackTelemetry: () => async () => ({ ok: true }),
}));
vi.mock("@vidstack/react", async () => {
  const ReactModule = await import("react");
  const MediaPlayer = ReactModule.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    mocks.lastPlayerProps = props;
    ReactModule.useImperativeHandle(ref, () => mocks.instance);
    return <div data-testid="media-player">{props.children as React.ReactNode}</div>;
  });
  MediaPlayer.displayName = "MediaPlayer";
  return { MediaPlayer, MediaProvider: () => null };
});

import VideoPlayer from "@/app/components/VideoPlayer";
import { VideoAccessContext } from "@/app/components/VideoAccessContext";
import {
  PageRevealGate,
  resetPageRevealForTests,
} from "@/app/components/preload/PageRevealGate";

const VIDEO = {
  id: "video-1",
  slug: "video-1",
  title: "Video",
  thumbnailUrl: "/poster.jpg",
  tier: "PUBLIC",
} as never;

const PLAN = {
  status: "READY",
  source: { kind: "cloudflare_stream", playbackUrl: "https://stream.example/v/manifest/video.m3u8" },
  player: { autoplayAllowed: true, mutedAutoplay: true, controls: true },
  tracking: {},
} as never;

function renderUnderGate() {
  return render(
    <PageRevealGate waitFor={["player"]}>
      <VideoAccessContext.Provider
        value={{
          hasAccess: true,
          playbackPlan: PLAN,
          isLoading: false,
          effectiveTier: "PUBLIC",
          refreshPlaybackPlan: async () => {},
        }}
      >
        <VideoPlayer video={VIDEO} revealKey="player" />
      </VideoAccessContext.Provider>
    </PageRevealGate>,
  );
}

describe("VideoPlayer under the first-load preloader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockReturnValue(0);
    resetPageRevealForTests();
    mocks.lastPlayerProps = null;
    mocks.instance.paused = true;
    mocks.instance.play.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("buffers without autoplaying, holds the preloader until it can play, then starts playback on reveal", async () => {
    renderUnderGate();
    await act(async () => {});

    expect(screen.getByTestId("site-preloader").getAttribute("data-state")).toBe("covering");
    expect(mocks.lastPlayerProps?.autoPlay).toBe(false);
    expect(mocks.lastPlayerProps?.preload).toBe("auto");
    expect(mocks.instance.play).not.toHaveBeenCalled();

    // Stream buffered its first frames → the gate may reveal.
    await act(async () => {
      (mocks.lastPlayerProps?.onCanPlay as () => void)();
    });

    expect(screen.getByTestId("site-preloader").getAttribute("data-state")).toBe("leaving");
    expect(mocks.instance.play).toHaveBeenCalledTimes(1);
  });

  it("does not reveal on the access check alone while the stream is still loading", async () => {
    renderUnderGate();
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByTestId("site-preloader").getAttribute("data-state")).toBe("covering");
  });
});
