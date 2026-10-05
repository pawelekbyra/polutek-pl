/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const media = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  toggleCaptions: vi.fn(),
}));

vi.mock("@vidstack/react", async () => {
  const ReactModule = await import("react");
  const Box = ({ children }: { children?: React.ReactNode }) => ReactModule.createElement("div", null, children);
  const Btn = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
    ReactModule.createElement("button", { type: "button", "aria-label": props["aria-label"] as string }, children);
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
  return {
    FullscreenExitIcon: icon, FullscreenIcon: icon, MuteIcon: icon,
    PauseIcon: icon, PlayIcon: icon, ReplayIcon: icon, VolumeHighIcon: icon, VolumeLowIcon: icon,
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
