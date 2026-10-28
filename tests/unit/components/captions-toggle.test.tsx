/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakeTrack = { kind: string; language: string; mode: string; setMode: (mode: string) => void };

const media = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  toggleCaptions: vi.fn(),
}));

vi.mock("@vidstack/react", () => ({
  isTrackCaptionKind: (track: { kind: string }) => track.kind === "subtitles" || track.kind === "captions",
  useMediaState: (name: string) => media.state[name],
  useMediaRemote: () => ({ toggleCaptions: media.toggleCaptions }),
  useMediaPlayer: () => ({ textTracks: (media.state.textTracks as unknown[]) ?? [] }),
}));

import { CaptionsSync, CaptionsToggleButton } from "@/app/components/player/CaptionsToggle";
import { CAPTIONS_STORAGE_KEY, writeCaptionsEnabled } from "@/app/components/player/captions";

const track = (mode = "disabled", kind = "subtitles"): FakeTrack => {
  const fake: FakeTrack = { kind, language: "pl", mode, setMode: (next) => { fake.mode = next; } };
  return fake;
};

describe("CaptionsToggleButton", () => {
  beforeEach(() => {
    media.state = {};
    media.toggleCaptions.mockReset();
    document.documentElement.lang = "pl";
  });
  afterEach(() => cleanup());

  it("without captions in the page language: crossed CC at full white and inert (no toggle)", () => {
    media.state = { hasCaptions: false, textTrack: null };
    const view = render(<CaptionsToggleButton />);
    const button = view.getByRole("button", { name: "Napisy" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.querySelector("svg")?.getAttribute("data-crossed")).toBe("true");
    expect(button.getAttribute("tabindex")).toBe("-1");
    expect(button.className).toContain("mc-caption--none");
    fireEvent.click(button);
    expect(media.toggleCaptions).not.toHaveBeenCalled();
  });

  it("captions on: plain CC icon, pressed, tooltip offers to turn them off", () => {
    const shown = track("showing");
    media.state = { hasCaptions: true, textTrack: shown };
    const view = render(<CaptionsToggleButton />);
    const button = view.getByRole("button", { name: "Napisy" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.getAttribute("aria-keyshortcuts")).toBe("c");
    expect(button.getAttribute("title")).toBe("Wyłącz napisy (c)");
    expect(button.querySelector("svg")?.getAttribute("data-crossed")).toBe("false");
    expect(button.querySelectorAll("svg > path")).toHaveLength(3);
  });

  it("captions off: crossed CC icon, not pressed, tooltip offers to turn them on", () => {
    media.state = { hasCaptions: true, textTrack: null };
    const view = render(<CaptionsToggleButton />);
    const button = view.getByRole("button", { name: "Napisy" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("title")).toBe("Włącz napisy (c)");
    expect(button.querySelector("svg")?.getAttribute("data-crossed")).toBe("true");
    // The crossed icon is the set's "captions off": the frame, two C arcs and the slash (4 strokes vs 3 when on).
    expect(button.querySelectorAll("svg > path")).toHaveLength(4);
  });

  it("uses English copy on the English site", () => {
    document.documentElement.lang = "en";
    media.state = { hasCaptions: true, textTrack: null };
    const view = render(<CaptionsToggleButton />);
    expect(view.getByRole("button", { name: "Captions" }).getAttribute("title")).toBe("Turn captions on (c)");
  });

  it("a click asks the player to toggle captions (same path as the c key)", () => {
    media.state = { hasCaptions: true, textTrack: track("showing") };
    const view = render(<CaptionsToggleButton />);
    fireEvent.click(view.getByRole("button", { name: "Napisy" }));
    expect(media.toggleCaptions).toHaveBeenCalledTimes(1);
  });
});

describe("CaptionsSync", () => {
  beforeEach(() => {
    localStorage.clear();
    writeCaptionsEnabled(true);
  });
  afterEach(() => cleanup());

  it("shows the caption track by default", () => {
    const pl = track();
    media.state = { textTracks: [pl] };
    render(<CaptionsSync />);
    expect(pl.mode).toBe("showing");
  });

  it("keeps captions off for a viewer who turned them off before", () => {
    writeCaptionsEnabled(false);
    const pl = track();
    media.state = { textTracks: [pl] };
    render(<CaptionsSync />);
    expect(pl.mode).toBe("disabled");
  });

  it("follows the viewer's choice while the video plays", () => {
    const pl = track();
    media.state = { textTracks: [pl] };
    render(<CaptionsSync />);
    act(() => writeCaptionsEnabled(false));
    expect(pl.mode).toBe("disabled");
    act(() => writeCaptionsEnabled(true));
    expect(pl.mode).toBe("showing");
  });

  it("follows a change made in another tab", () => {
    const pl = track();
    media.state = { textTracks: [pl] };
    render(<CaptionsSync />);
    act(() => {
      localStorage.setItem(CAPTIONS_STORAGE_KEY, "off");
      window.dispatchEvent(new StorageEvent("storage", { key: CAPTIONS_STORAGE_KEY }));
    });
    expect(pl.mode).toBe("disabled");
  });

  it("never touches non-caption tracks", () => {
    const chapters = track("hidden", "chapters");
    media.state = { textTracks: [chapters] };
    render(<CaptionsSync />);
    expect(chapters.mode).toBe("hidden");
  });
});
