/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const media = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  toggleCaptions: vi.fn(),
}));

vi.mock("@vidstack/react", async () => {
  const ReactModule = await import("react");
  const Box = ({ children }: { children?: React.ReactNode }) => ReactModule.createElement("div", null, children);
  const Btn = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    ReactModule.createElement(
      "button",
      {
        type: "button",
        "aria-label": props["aria-label"] as string,
        title: props.title as string | undefined,
        className: props.className as string | undefined,
      },
      children,
    );
  const slider = { Root: Box, Track: Box, TrackFill: Box, Thumb: Box, Progress: Box, Preview: Box, Value: Box };
  return {
    Captions: Box,
    FullscreenButton: Btn,
    Gesture: Box,
    MuteButton: Btn,
    PlayButton: Btn,
    Time: Box,
    TimeSlider: slider,
    VolumeSlider: slider,
    isTrackCaptionKind: (track: { kind: string }) => track.kind === "subtitles" || track.kind === "captions",
    useMediaState: (name: string) => media.state[name],
    useMediaRemote: () => ({ toggleCaptions: media.toggleCaptions }),
    useMediaPlayer: () => ({ textTracks: (media.state.textTracks as unknown[]) ?? [] }),
  };
});
vi.mock("@vidstack/react/icons", () => {
  const icon = () => null;
  // Play and replay get a marker so the tests can tell which glyph the centre button shows.
  const marked = (id: string) => (props: { className?: string }) =>
    React.createElement("svg", { "data-testid": id, className: props.className, "aria-hidden": "true" });
  return {
    FullscreenExitIcon: icon, FullscreenIcon: icon, MuteIcon: icon,
    PauseIcon: icon, PlayIcon: marked("play-icon"), ReplayIcon: marked("replay-icon"),
    VolumeHighIcon: icon, VolumeLowIcon: icon,
  };
});

import PolutekControls from "@/app/components/player/PolutekControls";

describe("PolutekControls: captions switch, no speed control", () => {
  beforeEach(() => {
    document.documentElement.lang = "pl";
    media.toggleCaptions.mockReset();
    media.state = {
      paused: false, waiting: false, ended: false, muted: false, volume: 1, canSetVolume: true,
      canFullscreen: true, fullscreen: false, controlsVisible: true,
      hasCaptions: true, textTrack: { kind: "subtitles", language: "pl", mode: "showing" }, textTracks: [],
    };
  });
  afterEach(() => cleanup());

  it("the CC button only toggles captions and opens no menu", () => {
    const view = render(<PolutekControls />);
    fireEvent.click(view.getByRole("button", { name: "Napisy" }));
    expect(media.toggleCaptions).toHaveBeenCalledTimes(1);
    expect(view.queryByRole("menu")).toBeNull();
  });

  it("has no playback speed control at all", () => {
    const view = render(<PolutekControls />);
    expect(view.queryByRole("button", { name: /Prędkość/i })).toBeNull();
    expect(view.queryByRole("menu")).toBeNull();
    expect(view.queryAllByRole("menuitemradio")).toHaveLength(0);
  });

  it("has no CC button for a video without captions", () => {
    media.state = { ...media.state, hasCaptions: false, textTrack: null };
    const view = render(<PolutekControls />);
    expect(view.queryByRole("button", { name: "Napisy" })).toBeNull();
  });
});

describe("PolutekControls: centre play / replay overlay", () => {
  beforeEach(() => {
    document.documentElement.lang = "pl";
    media.state = {
      paused: true, waiting: false, ended: false, muted: false, volume: 1, canSetVolume: true,
      canFullscreen: true, fullscreen: false, controlsVisible: true, hasCaptions: false, textTracks: [],
    };
  });
  afterEach(() => cleanup());

  // The bottom bar has its own play/pause button with the same name; the overlay is the one inside .mc-center.
  function centerButton(view: ReturnType<typeof render>) {
    const buttons = view.container.querySelectorAll<HTMLButtonElement>(".mc-center button");
    expect(buttons).toHaveLength(1);
    return buttons[0];
  }

  it("replay is the same button as play: same classes, icon only, still has an accessible name", () => {
    const playView = render(<PolutekControls />);
    const play = centerButton(playView);
    const playClasses = play.className;
    expect(playClasses).toContain("mc-hero");
    expect(play.getAttribute("aria-label")).toBe("Odtwórz");
    expect(play.querySelector('[data-testid="play-icon"]')).not.toBeNull();
    cleanup();

    media.state = { ...media.state, ended: true };
    const replayView = render(<PolutekControls />);
    const replay = centerButton(replayView);
    // Literally the same class set as play (size, circle, shadow, hover, focus ring come from it).
    expect(replay.className).toBe(playClasses);
    // Icon only: no visible text node, the name comes from aria-label (and title).
    expect(replay.textContent).toBe("");
    expect(replay.getAttribute("aria-label")).toBe("Odtwórz ponownie");
    expect(replay.getAttribute("title")).toBe("Odtwórz ponownie");
    expect(replay.querySelector('[data-testid="replay-icon"]')).not.toBeNull();
    expect(replay.querySelector('[data-testid="play-icon"]')).toBeNull();
    // Both glyphs share one icon class, so they render at one size.
    const replayIcon = replay.querySelector('[data-testid="replay-icon"]')!;
    expect(replayIcon.getAttribute("class")).toBe("mc-hero-icon");
    expect(replay.querySelector(".mc-replay-label")).toBeNull();
  });

  it("styles no separate replay variant (no pill, no label, one glyph size)", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    const source = readFileSync(join(process.cwd(), "app/components/player/PolutekControls.tsx"), "utf8");
    for (const dead of ["mc-hero--replay", "mc-replay-label", "mc-hero-icon-wrap"]) {
      expect(css).not.toContain(dead);
      expect(source).not.toContain(dead);
    }
    expect(css.match(/\.mc-hero-icon\s*\{/g)).toHaveLength(1);
  });
});
