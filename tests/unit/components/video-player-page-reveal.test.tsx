/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Canvas art is irrelevant here and jsdom has neither matchMedia nor a 2d context.
vi.mock("@/app/components/preload/MatrixRain", () => ({ MatrixRain: () => null }));

const mocks = vi.hoisted(() => ({
  lastPlayerProps: null as Record<string, unknown> | null,
  instance: {
    paused: true,
    muted: true,
    currentTime: 0,
    duration: 60,
    buffered: { length: 0, end: (_index: number) => 0 },
  },
}));

vi.mock("@/lib/auth/react", () => ({ useAuth: () => ({ isLoaded: true, orgRole: null }) }));
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
  source: { kind: "self_hls", playbackUrl: "https://video.example/h/1.sig/video-1/v1/master.m3u8" },
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
    mocks.instance.buffered = { length: 0, end: () => 0 };
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const fire = (name: string) => (mocks.lastPlayerProps?.[name] as () => void)();
  const preloaderState = () => screen.getByTestId("site-preloader").getAttribute("data-state");
  const posterOverlay = () => screen.getByTestId("player-poster-loading");

  it("autoplays under the preloader and is ready for the gate only once a real frame is on screen", async () => {
    renderUnderGate();
    await act(async () => {});

    expect(mocks.lastPlayerProps?.autoPlay).toBe(true);
    expect(mocks.lastPlayerProps?.preload).toBe("auto");

    // Buffered but no frame yet: still covered, poster still up (spinner suppressed).
    await act(async () => fire("onCanPlay"));
    expect(preloaderState()).toBe("covering");
    expect(posterOverlay().className).toContain("polutek-poster-loader--ready");
    expect(posterOverlay().className).not.toContain("polutek-poster-loader--hidden");

    // `play` is only a request: the poster must stay, or the gap flashes black.
    await act(async () => fire("onPlay"));
    expect(preloaderState()).toBe("covering");
    expect(posterOverlay().className).not.toContain("polutek-poster-loader--hidden");

    // First frame rendered → poster fades out, but while autoplaying the page still waits
    // for a few seconds of buffered video so it isn't handed over to a player that stalls.
    await act(async () => fire("onPlaying"));
    expect(posterOverlay().className).toContain("polutek-poster-loader--hidden");
    expect(preloaderState()).toBe("covering");

    mocks.instance.buffered = { length: 1, end: () => 5 };
    await act(async () => fire("onProgress"));
    // Settled: the preloader hands over to the "white rabbit" gate (page still covered until a click).
    expect(preloaderState()).toBe("gate");
  });

  it("is ready for the gate on a paused player when the browser blocks autoplay", async () => {
    renderUnderGate();
    await act(async () => fire("onCanPlay"));
    await act(async () => fire("onAutoPlayFail"));

    // Settled: the preloader hands over to the "white rabbit" gate (page still covered until a click).
    expect(preloaderState()).toBe("gate");
    expect(posterOverlay().className).toContain("polutek-poster-loader--hidden");
  });

  it("is not ready on the access check alone while the stream is still loading", async () => {
    renderUnderGate();
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(preloaderState()).toBe("covering");
  });
});
