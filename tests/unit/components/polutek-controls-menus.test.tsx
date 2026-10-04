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
  const rates = Object.assign(
    [
      { value: "1", label: "Normalna", selected: true, select: vi.fn() },
      { value: "1.5", label: "1.5x", selected: false, select: vi.fn() },
    ],
    { disabled: false },
  );
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
    usePlaybackRateOptions: () => rates,
  };
});
vi.mock("@vidstack/react/icons", () => {
  const icon = () => null;
  return {
    CheckIcon: icon, FullscreenExitIcon: icon, FullscreenIcon: icon, MuteIcon: icon, OdometerIcon: icon,
    PauseIcon: icon, PlayIcon: icon, ReplayIcon: icon, VolumeHighIcon: icon, VolumeLowIcon: icon,
  };
});

import PolutekControls from "@/app/components/player/PolutekControls";

describe("PolutekControls: captions switch and speed menu", () => {
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

  it("the CC button only toggles captions and never opens the speed menu", () => {
    const view = render(<PolutekControls />);
    fireEvent.click(view.getByRole("button", { name: "Napisy" }));
    expect(media.toggleCaptions).toHaveBeenCalledTimes(1);
    expect(view.queryByRole("menu")).toBeNull();
  });

  it("the speed button opens a speed-only menu", () => {
    const view = render(<PolutekControls />);
    const speed = view.getByRole("button", { name: "Prędkość odtwarzania" });
    expect(speed.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(speed);
    const menu = view.getByRole("menu", { name: "Prędkość odtwarzania" });
    expect(menu.textContent).toContain("Prędkość");
    expect(menu.textContent).not.toContain("Napisy");
    expect(view.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual(["Normalna", "1.5x"]);
    expect(media.toggleCaptions).not.toHaveBeenCalled();
  });

  it("has no CC button for a video without captions, the speed button stays", () => {
    media.state = { ...media.state, hasCaptions: false, textTrack: null };
    const view = render(<PolutekControls />);
    expect(view.queryByRole("button", { name: "Napisy" })).toBeNull();
    expect(view.getByRole("button", { name: "Prędkość odtwarzania" })).toBeTruthy();
  });
});
