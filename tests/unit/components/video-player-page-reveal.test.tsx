/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Canvas art is irrelevant here and jsdom has neither matchMedia nor a 2d context.
vi.mock("@/app/components/preload/MatrixRain", () => ({ MatrixRain: () => null }));

const mocks = vi.hoisted(() => ({
  lastPlayerProps: null as Record<string, unknown> | null,
  instance: {
    paused: true,
    muted: true,
    volume: 1,
    currentTime: 0,
    duration: 60,
    state: { canPlay: true },
    buffered: { length: 0, end: (_index: number): number => 0 },
    play: vi.fn(async () => undefined),
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
  readSoundPreference,
  resetSoundPreferenceForTests,
  writeUserMuted,
} from "@/app/components/player/sound-preference";
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
  source: { kind: "self_hls", playbackUrl: "https://video.example/h/1.sig/video-1/v1/master.m3u8", posterUrl: "/poster.jpg" },
  player: { autoplayAllowed: true, mutedAutoplay: true, controls: true, poster: "/poster.jpg" },
  tracking: {},
} as never;

function withPlan(children: React.ReactNode) {
  return (
    <VideoAccessContext.Provider
      value={{
        hasAccess: true,
        playbackPlan: PLAN,
        isLoading: false,
        effectiveTier: "PUBLIC",
        refreshPlaybackPlan: async () => {},
        renewPlaybackPlan: async () => null,
      }}
    >
      {children}
    </VideoAccessContext.Provider>
  );
}

function renderUnderGate() {
  return render(
    <PageRevealGate waitFor={["player"]}>
      {withPlan(<VideoPlayer video={VIDEO} revealKey="player" />)}
    </PageRevealGate>,
  );
}

const fire = (name: string, ...args: unknown[]) => (mocks.lastPlayerProps?.[name] as (...a: unknown[]) => void)(...args);
const startOverlay = () => screen.getByTestId("player-start-loading");
const unmuteHint = () => screen.queryByTestId("player-unmute-hint");

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(performance, "now").mockReturnValue(0);
  resetPageRevealForTests();
  sessionStorage.clear();
  localStorage.clear();
  resetSoundPreferenceForTests();
  vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { getAutoplayPolicy: undefined }));
  mocks.lastPlayerProps = null;
  mocks.instance.buffered = { length: 0, end: () => 0 };
  mocks.instance.muted = true;
  mocks.instance.paused = true;
  mocks.instance.volume = 1;
  mocks.instance.play.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("VideoPlayer under the first-load preloader", () => {
  const preloaderState = () => screen.getByTestId("site-preloader").getAttribute("data-state");

  it("autoplays muted under the preloader and is ready for the gate only once a real frame is on screen", async () => {
    renderUnderGate();
    await act(async () => {});

    expect(mocks.lastPlayerProps?.autoPlay).toBe(true);
    expect(mocks.lastPlayerProps?.muted).toBe(true);
    expect(mocks.lastPlayerProps?.preload).toBe("auto");

    // Buffered but no frame yet: still covered, start-up frame still up (spinner suppressed).
    await act(async () => fire("onCanPlay"));
    expect(preloaderState()).toBe("covering");
    expect(startOverlay().className).toContain("polutek-start-loader--ready");
    expect(startOverlay().className).not.toContain("polutek-start-loader--hidden");

    // `play` is only a request: the dark frame must stay, or the gap flashes.
    await act(async () => fire("onPlay"));
    expect(preloaderState()).toBe("covering");
    expect(startOverlay().className).not.toContain("polutek-start-loader--hidden");

    // First frame rendered → the frame fades out, but while autoplaying the page still waits
    // for a few seconds of buffered video so it isn't handed over to a player that stalls.
    await act(async () => fire("onPlaying"));
    expect(startOverlay().className).toContain("polutek-start-loader--hidden");
    expect(preloaderState()).toBe("covering");

    mocks.instance.buffered = { length: 1, end: () => 5 };
    await act(async () => fire("onProgress"));
    // Settled: the preloader hands over to the "white rabbit" gate (page still covered until a click).
    expect(preloaderState()).toBe("gate");
  });

  it("is ready for the gate on a paused player when the browser blocks even the muted autoplay", async () => {
    renderUnderGate();
    await act(async () => fire("onCanPlay"));
    await act(async () => fire("onAutoPlayFail", { muted: true, error: new Error("NotAllowedError") }));

    expect(preloaderState()).toBe("gate");
    expect(startOverlay().className).toContain("polutek-start-loader--hidden");
  });

  it("is not ready on the access check alone while the stream is still loading", async () => {
    renderUnderGate();
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(preloaderState()).toBe("covering");
  });

  it("turns the sound on when the viewer clicks the gate", async () => {
    renderUnderGate();
    await act(async () => fire("onCanPlay"));
    await act(async () => {
      window.dispatchEvent(new Event("polutek:gate-enter"));
    });
    expect(mocks.instance.muted).toBe(false);
    expect(mocks.lastPlayerProps?.muted).toBe(false);
    // Muted autoplay had been refused too: the gate click starts it.
    expect(mocks.instance.play).toHaveBeenCalled();
  });
});

describe("VideoPlayer start-up frame", () => {
  it("never shows the video's cover image in the player area", async () => {
    const { container } = render(withPlan(<VideoPlayer video={VIDEO} />));
    // Pre-mount frame and the frame over the mounted player alike.
    expect(container.querySelector("img")).toBeNull();
    await act(async () => {});
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("poster.jpg");
    expect(mocks.lastPlayerProps?.poster).toBeUndefined();
    expect(startOverlay()).toBeTruthy();
  });
});

describe("VideoPlayer sound", () => {
  async function mountPlayer(startWithSound: boolean) {
    render(withPlan(<VideoPlayer video={VIDEO} startWithSound={startWithSound} />));
    await act(async () => {});
  }

  it("starts a video the viewer picked with sound", async () => {
    await mountPlayer(true);
    expect(mocks.lastPlayerProps?.muted).toBe(false);
    expect(mocks.lastPlayerProps?.autoPlay).toBe(true);
  });

  it("starts muted without a gesture (first load, Back/Forward) and offers the unmute hint", async () => {
    await mountPlayer(false);
    expect(mocks.lastPlayerProps?.muted).toBe(true);
    expect(unmuteHint()).toBeNull();
    await act(async () => fire("onPlaying"));
    expect(unmuteHint()).not.toBeNull();
  });

  it("falls back to a muted start with a visible unmute button when the browser refuses sound", async () => {
    await mountPlayer(true);
    await act(async () => fire("onCanPlay"));
    await act(async () => fire("onAutoPlayFail", { muted: false, error: new Error("NotAllowedError") }));

    expect(mocks.instance.muted).toBe(true);
    expect(mocks.instance.play).toHaveBeenCalledTimes(1);
    expect(mocks.lastPlayerProps?.muted).toBe(true);
    await act(async () => fire("onPlaying"));
    const hint = unmuteHint();
    expect(hint).not.toBeNull();

    await act(async () => {
      fireEvent.click(hint!);
    });
    expect(mocks.instance.muted).toBe(false);
    expect(unmuteHint()).toBeNull();
  });

  it("keeps the next video muted when the viewer muted the player themselves this session", async () => {
    await mountPlayer(true);
    await act(async () => fire("onMediaMuteRequest"));
    cleanup();

    await mountPlayer(true);
    expect(mocks.lastPlayerProps?.muted).toBe(true);
    // Their own choice: no hint nagging them to unmute.
    await act(async () => fire("onPlaying"));
    expect(unmuteHint()).toBeNull();

    // Unmuting later (button or slider) lifts the choice for the next videos.
    await act(async () => fire("onVolumeChange", { muted: false, volume: 0.6 }));
    cleanup();
    await mountPlayer(true);
    expect(mocks.lastPlayerProps?.muted).toBe(false);
  });

  it("does not unmute on the gate click when the viewer chose mute", async () => {
    writeUserMuted(true);
    await mountPlayer(false);
    await act(async () => {
      window.dispatchEvent(new Event("polutek:gate-enter"));
    });
    expect(mocks.instance.muted).toBe(true);
    expect(mocks.lastPlayerProps?.muted).toBe(true);
  });
});

describe("VideoPlayer unmutes on the first gesture after a muted start (reload, Back/Forward)", () => {
  async function mountMutedAndPlaying() {
    render(withPlan(<VideoPlayer video={VIDEO} />));
    await act(async () => {});
    await act(async () => fire("onPlaying"));
    expect(mocks.lastPlayerProps?.muted).toBe(true);
  }

  it("turns the sound on at the first gesture anywhere, once, without saving it as the viewer's choice", async () => {
    await mountMutedAndPlaying();
    await act(async () => {
      fireEvent.pointerDown(document.body);
    });
    expect(mocks.instance.muted).toBe(false);
    expect(mocks.lastPlayerProps?.muted).toBe(false);
    expect(readSoundPreference().muted).toBeNull();

    // One-shot: once the viewer mutes it, later gestures leave it muted.
    mocks.instance.muted = true;
    await act(async () => fire("onMediaMuteRequest"));
    await act(async () => fire("onVolumeChange", { muted: true, volume: 1 }));
    await act(async () => {
      fireEvent.keyDown(document.body, { key: "a" });
      fireEvent.pointerDown(document.body);
    });
    expect(mocks.instance.muted).toBe(true);
    expect(mocks.lastPlayerProps?.muted).toBe(true);
  });

  it("does not unmute when the viewer muted the player themselves", async () => {
    writeUserMuted(true);
    await mountMutedAndPlaying();
    await act(async () => {
      fireEvent.pointerDown(document.body);
      fireEvent.keyDown(document.body, { key: "Enter" });
    });
    expect(mocks.instance.muted).toBe(true);
    expect(mocks.lastPlayerProps?.muted).toBe(true);
  });

  it("leaves a gesture on the unmute button, the player's volume control or the \"m\" key to them", async () => {
    await mountMutedAndPlaying();
    const hint = unmuteHint()!;
    const volumeControl = document.createElement("div");
    volumeControl.className = "mc-volume";
    const muteButton = document.createElement("button");
    volumeControl.appendChild(muteButton);
    document.body.appendChild(volumeControl);

    await act(async () => {
      fireEvent.pointerDown(muteButton);
      fireEvent.keyDown(document.body, { key: "m" });
      fireEvent.pointerDown(hint);
    });
    // The page-wide listener stayed out of it (no unmute-then-mute toggle)...
    expect(mocks.instance.muted).toBe(true);

    // ...and the button's own click turns the sound on, as the viewer's explicit choice.
    writeUserMuted(true);
    await act(async () => {
      fireEvent.click(hint);
    });
    expect(mocks.instance.muted).toBe(false);
    expect(readSoundPreference().muted).toBe(false);
    expect(unmuteHint()).toBeNull();
    volumeControl.remove();
  });
});

describe("VideoPlayer restores the viewer's sound after a reload", () => {
  async function mountAfterReload() {
    // A reload inside the session: the entry gate was already passed, so it does not wait for a click.
    sessionStorage.setItem("polutek:revealed", "1");
    render(withPlan(<VideoPlayer video={VIDEO} />));
    await act(async () => {});
  }
  const stubAutoplayPolicy = (policy: string) =>
    vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { getAutoplayPolicy: () => policy }));

  it("tries sound first after a reload when the viewer had sound on (regression: it always started muted)", async () => {
    writeUserMuted(false);
    await mountAfterReload();
    expect(mocks.lastPlayerProps?.muted).toBe(false);
    expect(mocks.lastPlayerProps?.autoPlay).toBe(true);
  });

  it("falls back to muted autoplay plus the unmute button when the browser refuses (NotAllowedError)", async () => {
    writeUserMuted(false);
    await mountAfterReload();
    mocks.instance.play.mockRejectedValueOnce(Object.assign(new Error("blocked"), { name: "NotAllowedError" }));
    await act(async () => fire("onCanPlay"));
    await act(async () => fire("onAutoPlayFail", { muted: false, error: new Error("NotAllowedError") }));
    expect(mocks.instance.muted).toBe(true);
    await act(async () => fire("onPlaying"));
    expect(unmuteHint()).not.toBeNull();
    // ...and the first gesture anywhere turns the sound on again, with the restored volume.
    await act(async () => {
      fireEvent.pointerDown(document.body);
    });
    expect(mocks.instance.muted).toBe(false);
    expect(unmuteHint()).toBeNull();
  });

  it("stays muted after a reload when the viewer never chose sound (no choice yet)", async () => {
    await mountAfterReload();
    expect(mocks.lastPlayerProps?.muted).toBe(true);
  });

  it("stays muted after a reload when the viewer muted the player", async () => {
    writeUserMuted(true);
    await mountAfterReload();
    expect(mocks.lastPlayerProps?.muted).toBe(true);
    await act(async () => fire("onPlaying"));
    expect(unmuteHint()).toBeNull();
  });

  it("stays muted under a waiting entry gate even with sound remembered (the gate click brings it)", async () => {
    writeUserMuted(false);
    renderUnderGate();
    await act(async () => {});
    expect(mocks.lastPlayerProps?.muted).toBe(true);
    await act(async () => {
      window.dispatchEvent(new Event("polutek:gate-enter"));
    });
    expect(mocks.instance.muted).toBe(false);
  });

  it("does not even try sound when the browser says only muted autoplay is allowed", async () => {
    writeUserMuted(false);
    stubAutoplayPolicy("allowed-muted");
    await mountAfterReload();
    expect(mocks.lastPlayerProps?.muted).toBe(true);
    await act(async () => fire("onPlaying"));
    expect(unmuteHint()).not.toBeNull();
  });

  it("tries sound when the browser reports that autoplay is allowed", async () => {
    writeUserMuted(false);
    stubAutoplayPolicy("allowed");
    await mountAfterReload();
    expect(mocks.lastPlayerProps?.muted).toBe(false);
  });

  it("remembers the gate click as the viewer's own sound choice", async () => {
    renderUnderGate();
    await act(async () => {});
    await act(async () => {
      window.dispatchEvent(new Event("polutek:gate-enter"));
    });
    expect(readSoundPreference().muted).toBe(false);
  });

  it("restores the saved volume and saves the one the viewer sets", async () => {
    await mountAfterReload();
    expect(mocks.lastPlayerProps?.volume).toBe(1);
    await act(async () => fire("onMediaVolumeChangeRequest", 0.35));
    await act(async () => fire("onMediaVolumeChangeRequest", 0));
    expect(readSoundPreference().volume).toBe(0.35);
    cleanup();
    await mountAfterReload();
    expect(mocks.lastPlayerProps?.volume).toBe(0.35);
  });

  it("survives blocked storage (falls back to the current document)", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    writeUserMuted(true);
    expect(readSoundPreference().muted).toBe(true);
  });

  it("turns off the playback-speed keys (the player has no speed control)", async () => {
    await mountAfterReload();
    expect(mocks.lastPlayerProps?.keyShortcuts).toEqual({ speedUp: "", slowDown: "" });
  });
});
