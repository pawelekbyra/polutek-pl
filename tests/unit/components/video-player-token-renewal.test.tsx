/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lastProps: null as Record<string, unknown> | null,
  mounts: 0,
  events: [] as string[],
  instance: { paused: false, muted: true, currentTime: 0, duration: 600, play: async () => undefined },
}));

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/app/components/player/PolutekControls", () => ({ default: () => null }));
vi.mock("@/app/components/player/chapters/ChaptersParts", () => ({ ChaptersParts: () => null }));
vi.mock("@/app/components/preload/PageRevealGate", () => ({ usePageRevealReady: () => undefined }));
vi.mock("@/app/components/PlayerErrorOverlay", () => ({ PlayerErrorOverlay: ({ errorCode }: { errorCode: string }) => <div data-testid="player-error">{errorCode}</div> }));
vi.mock("@/lib/hooks/usePlaybackTelemetry", () => ({
  usePlaybackTelemetry: () => async (type: string) => {
    mocks.events.push(type);
    return { ok: true };
  },
}));
// Playback quality goes to the analytics beacon (lib/telemetry/client), not to the per-event route.
vi.mock("@/lib/telemetry/client/use-playback-qoe", () => {
  const record = (name: string) => (...args: unknown[]) => mocks.events.push(["qoe", name, ...args].join(":"));
  const handlers = Object.fromEntries(
    ["playRequested", "playing", "waiting", "seekStarted", "paused", "ended", "qualityChanged", "error"].map((n) => [n, record(n)]),
  );
  return { usePlaybackQoe: () => handlers };
});
vi.mock("@vidstack/react", async () => {
  const ReactModule = await import("react");
  const MediaPlayer = ReactModule.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    mocks.lastProps = props;
    ReactModule.useImperativeHandle(ref, () => mocks.instance);
    ReactModule.useEffect(() => {
      mocks.mounts += 1;
    }, []);
    return <div data-testid="media-player">{props.children as React.ReactNode}</div>;
  });
  MediaPlayer.displayName = "MediaPlayer";
  const Track = (props: Record<string, unknown>) => <span data-testid="track" data-src={String(props.src)} data-lang={String(props.language)} />;
  return { MediaPlayer, MediaProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>, Track, isHLSProvider: () => false };
});

import VideoPlayer from "@/app/components/VideoPlayer";
import { VideoAccessContext } from "@/app/components/VideoAccessContext";

const VIDEO = { id: "c52f0407-b0e8-4b5c-b6d3-a9f152653002", slug: "v", title: "Video", thumbnailUrl: "/poster.jpg", tier: "PUBLIC" } as never;
const url = (token: string, version = "v1") => `https://video.pawelperfect.com/h/${token}/${VIDEO_ID}/${version}/master.m3u8`;
const VIDEO_ID = "c52f0407-b0e8-4b5c-b6d3-a9f152653002";

const plan = (token: string, sessionId = "sess-1", version = "v1") => ({
  videoId: VIDEO_ID,
  status: "READY",
  canPlay: true,
  access: { allowed: true },
  source: { provider: "SELF_HLS", kind: "self_hls", playbackUrl: url(token, version), isSignedUrl: true, expiresAt: new Date(Date.now() + 6 * 3600_000).toISOString() },
  player: {
    autoplayAllowed: true, mutedAutoplay: true, controls: true, poster: "", title: "Video",
    textTracks: [{ src: "https://subs.example.com/pl.vtt", label: "Polski", language: "pl", kind: "subtitles" }],
  },
  diagnostics: { warnings: [], sourceConfidence: "HIGH", providerResolutionAllowed: true, providerResolutionAttempted: true },
  tracking: { playbackSessionId: sessionId, heartbeatIntervalSeconds: 60 },
}) as never;

function Harness({ value }: { value: React.ContextType<typeof VideoAccessContext> }) {
  return (
    <VideoAccessContext.Provider value={value}>
      <VideoPlayer video={VIDEO} />
    </VideoAccessContext.Provider>
  );
}

const ctx = (p: unknown, renew = vi.fn(async () => null)) => ({
  hasAccess: true, playbackPlan: p as never, isLoading: false, effectiveTier: "PUBLIC" as const,
  refreshPlaybackPlan: async () => {}, renewPlaybackPlan: renew,
});

describe("VideoPlayer and delivery-token renewal", () => {
  beforeEach(() => {
    mocks.lastProps = null;
    mocks.mounts = 0;
    mocks.events = [];
    mocks.instance.currentTime = 0;
    mocks.instance.paused = false;
  });
  afterEach(() => cleanup());

  it("keeps playing the same mounted stream when only the token or session changes", async () => {
    const view = render(<Harness value={ctx(plan("1800000000.a"))} />);
    await act(async () => {});
    const mountsAfterStart = mocks.mounts;
    expect(mocks.lastProps?.src).toBe(url("1800000000.a"));

    view.rerender(<Harness value={ctx(plan("1800021600.b", "sess-2"))} />);
    await act(async () => {});
    expect(mocks.mounts).toBe(mountsAfterStart);
    expect(mocks.lastProps?.src).toBe(url("1800000000.a"));
  });

  it("restarts the player for a different version of the video", async () => {
    const view = render(<Harness value={ctx(plan("1800000000.a"))} />);
    await act(async () => {});
    const mountsAfterStart = mocks.mounts;
    view.rerender(<Harness value={ctx(plan("1800000000.a", "sess-1", "v2"))} />);
    await act(async () => {});
    expect(mocks.mounts).toBeGreaterThan(mountsAfterStart);
    expect(mocks.lastProps?.src).toBe(url("1800000000.a", "v2"));
  });

  it("after a fatal error (expired token in a slept tab) renews once and resumes from the same position", async () => {
    const fresh = plan("1800021600.b");
    const renew = vi.fn(async () => fresh);
    render(<Harness value={ctx(plan("1800000000.a"), renew)} />);
    await act(async () => {});
    mocks.instance.currentTime = 321;
    const mountsBefore = mocks.mounts;

    await act(async () => (mocks.lastProps?.onError as () => void)());
    expect(renew).toHaveBeenCalledTimes(1);
    expect(mocks.mounts).toBeGreaterThan(mountsBefore);
    expect(mocks.lastProps?.src).toBe(url("1800021600.b"));
    expect(mocks.events).not.toContain("qoe:error:LOAD_FAILED:true");

    mocks.instance.currentTime = 0;
    await act(async () => (mocks.lastProps?.onCanPlay as () => void)());
    expect(mocks.instance.currentTime).toBe(321);
  });

  it("shows the error when the renewal does not help", async () => {
    const view = render(<Harness value={ctx(plan("1800000000.a"), vi.fn(async () => null))} />);
    await act(async () => {});
    await act(async () => (mocks.lastProps?.onError as () => void)());
    expect(mocks.events).toContain("qoe:error:LOAD_FAILED:true");
    expect(view.queryByTestId("media-player")).toBeNull();
    expect(view.getByTestId("player-error").textContent).toBe("MEDIA_LOAD_FAILED");
  });

  it("sends PLAY_STARTED once and PLAY_RESUMED after a pause", async () => {
    render(<Harness value={ctx(plan("1800000000.a"))} />);
    await act(async () => {});
    const fire = (name: string) => (mocks.lastProps?.[name] as () => void)();
    await act(async () => fire("onPlay"));
    await act(async () => fire("onPause"));
    await act(async () => fire("onPlay"));
    expect(mocks.events.filter((e) => e.startsWith("PLAY_"))).toEqual(["PLAY_STARTED", "PLAY_PAUSED", "PLAY_RESUMED"]);
  });

  it("renders the plan's subtitle track for the page language", async () => {
    const view = render(<Harness value={ctx(plan("1800000000.a"))} />);
    await act(async () => {});
    const track = view.getByTestId("track");
    expect(track.getAttribute("data-src")).toBe("https://subs.example.com/pl.vtt");
    expect(track.getAttribute("data-lang")).toBe("pl");
  });
});

describe("VideoPlayer captions", () => {
  const withTracks = (tracks: Array<{ src: string; language: string; label: string }>) => {
    const p = plan("1800000000.a") as unknown as { player: { textTracks: unknown[] } };
    p.player.textTracks = tracks.map((t) => ({ ...t, kind: "subtitles" }));
    return p as never;
  };
  const BOTH = [
    { src: "/subtitles/v/pl.vtt", language: "pl", label: "Polski" },
    { src: "/subtitles/v/en.vtt", language: "en", label: "English" },
  ];

  afterEach(() => {
    cleanup();
    document.documentElement.lang = "";
    localStorage.clear();
  });

  it("mounts only the track in the page language (Polish site)", async () => {
    document.documentElement.lang = "pl";
    const view = render(<Harness value={ctx(withTracks(BOTH))} />);
    await act(async () => {});
    expect(view.getAllByTestId("track").map((t) => t.getAttribute("data-lang"))).toEqual(["pl"]);
  });

  it("mounts only the track in the page language (English site)", async () => {
    document.documentElement.lang = "en";
    const view = render(<Harness value={ctx(withTracks(BOTH))} />);
    await act(async () => {});
    expect(view.getAllByTestId("track").map((t) => t.getAttribute("data-src"))).toEqual(["/subtitles/v/en.vtt"]);
  });

  it("mounts no track when there is none in the page language", async () => {
    document.documentElement.lang = "en";
    const view = render(<Harness value={ctx(withTracks([BOTH[0]]))} />);
    await act(async () => {});
    expect(view.queryByTestId("track")).toBeNull();
  });

  it("remembers the viewer's own captions switch (CC button or c key)", async () => {
    const { readCaptionsEnabled } = await import("@/app/components/player/captions");
    render(<Harness value={ctx(withTracks(BOTH))} />);
    await act(async () => {});
    const request = mocks.lastProps?.onMediaTextTrackChangeRequest as (detail: { index: number; mode: string }) => void;
    act(() => request({ index: 0, mode: "disabled" }));
    expect(readCaptionsEnabled()).toBe(false);
    act(() => request({ index: 0, mode: "showing" }));
    expect(readCaptionsEnabled()).toBe(true);
  });
});
