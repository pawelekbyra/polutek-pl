/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const media = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  chapters: [] as { cue: { startTime: number }; label: string; selected: boolean }[],
  chapterTitle: "",
  toggleCaptions: vi.fn(),
  changeQuality: vi.fn(),
  changePlaybackRate: vi.fn(),
  enterPictureInPicture: vi.fn(),
  exitPictureInPicture: vi.fn(),
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
  // Chapters: without a chapters track Vidstack hands the render function one empty cue (a single segment).
  const Chapters = ({ children }: { children: (cues: unknown[], ref: () => void) => React.ReactNode }) =>
    ReactModule.createElement("div", null, children([{ startTime: 0 }], () => undefined));
  const slider = { Root: Box, Track: Box, TrackFill: Box, Thumb: Box, Progress: Box, Preview: Box, Value: Box, Chapters, ChapterTitle: Box };
  return {
    Captions: Box,
    FullscreenButton: Btn,
    Gesture: Box,
    MuteButton: Btn,
    PlayButton: Btn,
    Time: ({ className }: { className?: string }) => ReactModule.createElement("span", { className }),
    TimeSlider: slider,
    VolumeSlider: slider,
    isTrackCaptionKind: (track: { kind: string }) => track.kind === "subtitles" || track.kind === "captions",
    useMediaState: (name: string) => media.state[name],
    useMediaRemote: () => ({
      toggleCaptions: media.toggleCaptions,
      changeQuality: media.changeQuality,
      changePlaybackRate: media.changePlaybackRate,
      enterPictureInPicture: media.enterPictureInPicture,
      exitPictureInPicture: media.exitPictureInPicture,
    }),
    useMediaPlayer: () => ({ textTracks: (media.state.textTracks as unknown[]) ?? [] }),
    useChapterOptions: () => media.chapters,
    useChapterTitle: () => media.chapterTitle,
  };
});
vi.mock("@vidstack/react/icons", () => {
  const icon = () => null;
  // Play and replay get a marker so the tests can tell which glyph the centre button shows.
  const marked = (id: string) => (props: { className?: string }) =>
    React.createElement("svg", { "data-testid": id, className: props.className, "aria-hidden": "true" });
  return {
    ChaptersIcon: icon, FullscreenExitIcon: icon, FullscreenIcon: icon, MuteIcon: icon,
    PauseIcon: icon, PlayIcon: marked("play-icon"), ReplayIcon: marked("replay-icon"),
    VolumeHighIcon: icon, VolumeLowIcon: icon,
  };
});

import PolutekControls from "@/app/components/player/PolutekControls";

describe("PolutekControls: captions switch and settings menu", () => {
  beforeEach(() => {
    document.documentElement.lang = "pl";
    media.toggleCaptions.mockReset();
    media.changeQuality.mockReset();
    media.changePlaybackRate.mockReset();
    media.enterPictureInPicture.mockReset();
    media.exitPictureInPicture.mockReset();
    media.chapters = [];
    media.chapterTitle = "";
    try { localStorage.clear(); } catch {}
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

  it("keeps the settings menu closed until the viewer opens it", () => {
    const view = render(<PolutekControls />);
    const trigger = view.getByRole("button", { name: "Ustawienia" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(view.queryByRole("menu")).toBeNull();
    expect(view.queryAllByRole("menuitemradio")).toHaveLength(0);
  });

  it("offers speeds from 0.5x to 2x, marks the current one and remembers the choice", () => {
    media.state = { ...media.state, playbackRate: 1 };
    const view = render(<PolutekControls />);
    fireEvent.click(view.getByRole("button", { name: "Ustawienia" }));

    expect(view.getByRole("menu")).toBeTruthy();
    const speeds = view.getAllByRole("menuitemradio").map((el) => el.textContent);
    expect(speeds).toEqual(["0.5x", "0.75x", "Normalna", "1.25x", "1.5x", "2x"]);
    expect(view.getByRole("menuitemradio", { name: "Normalna" }).getAttribute("aria-checked")).toBe("true");

    fireEvent.click(view.getByRole("menuitemradio", { name: "1.5x" }));
    expect(media.changePlaybackRate).toHaveBeenCalledWith(1.5);
    expect(localStorage.getItem("polutek:player-rate")).toBe("1.5");
    // The menu closes after a choice.
    expect(view.queryByRole("menu")).toBeNull();
  });

  it("restores the saved speed when the player becomes ready", () => {
    localStorage.setItem("polutek:player-rate", "1.25");
    media.state = { ...media.state, playbackRate: 1, canPlay: true };
    render(<PolutekControls />);
    expect(media.changePlaybackRate).toHaveBeenCalledWith(1.25);
  });

  it("lists Auto and the manifest's renditions (best first) only when the stream has several", () => {
    media.state = {
      ...media.state,
      autoQuality: true,
      quality: { height: 720 },
      qualities: [{ height: 360 }, { height: 720 }, { height: 1080 }],
    };
    const view = render(<PolutekControls />);
    fireEvent.click(view.getByRole("button", { name: "Ustawienia (HD)" }));

    const labels = view.getAllByRole("menuitemradio").map((el) => el.textContent);
    expect(labels.slice(0, 4)).toEqual(["Auto (720p)", "1080p", "720p", "360p"]);
    expect(view.getByRole("menuitemradio", { name: "Auto (720p)" }).getAttribute("aria-checked")).toBe("true");

    fireEvent.click(view.getByRole("menuitemradio", { name: "1080p" }));
    // The index is the one in the player's own list, not the sorted position.
    expect(media.changeQuality).toHaveBeenCalledWith(2);
    expect(localStorage.getItem("polutek:player-quality")).toBe("1080");
  });

  it("has no quality group for a single rendition", () => {
    media.state = { ...media.state, autoQuality: true, qualities: [{ height: 720 }] };
    const view = render(<PolutekControls />);
    fireEvent.click(view.getByRole("button", { name: "Ustawienia" }));
    expect(view.queryByRole("menuitemradio", { name: /Auto/ })).toBeNull();
    expect(view.getAllByRole("menuitemradio")).toHaveLength(6);
  });

  it("Auto switches back to automatic selection and is remembered", () => {
    media.state = {
      ...media.state,
      autoQuality: false,
      quality: { height: 360 },
      qualities: [{ height: 360 }, { height: 720 }],
    };
    const view = render(<PolutekControls />);
    fireEvent.click(view.getByRole("button", { name: "Ustawienia (SD)" }));
    fireEvent.click(view.getByRole("menuitemradio", { name: "Auto" }));

    expect(media.changeQuality).toHaveBeenLastCalledWith(-1);
    expect(localStorage.getItem("polutek:player-quality")).toBe("auto");
  });

  it("re-applies the saved quality once the renditions are known, and ignores a height the video lacks", () => {
    localStorage.setItem("polutek:player-quality", "720");
    media.state = { ...media.state, autoQuality: true, qualities: [{ height: 360 }, { height: 720 }] };
    render(<PolutekControls />);
    expect(media.changeQuality).toHaveBeenCalledWith(1);

    cleanup();
    media.changeQuality.mockReset();
    localStorage.setItem("polutek:player-quality", "2160");
    render(<PolutekControls />);
    expect(media.changeQuality).not.toHaveBeenCalled();
  });

  it("shows picture-in-picture only where the browser offers it", () => {
    const withoutPip = render(<PolutekControls />);
    fireEvent.click(withoutPip.getByRole("button", { name: "Ustawienia" }));
    expect(withoutPip.queryByRole("menuitem", { name: "Obraz w obrazie" })).toBeNull();
    cleanup();

    media.state = { ...media.state, canPictureInPicture: true, pictureInPicture: false };
    const withPip = render(<PolutekControls />);
    fireEvent.click(withPip.getByRole("button", { name: "Ustawienia" }));
    fireEvent.click(withPip.getByRole("menuitem", { name: "Obraz w obrazie" }));
    expect(media.enterPictureInPicture).toHaveBeenCalledTimes(1);
  });

  it("is keyboard operable: arrows move between items, Escape closes and returns the focus", () => {
    const view = render(<PolutekControls />);
    const trigger = view.getByRole("button", { name: "Ustawienia" });
    fireEvent.click(trigger);

    const items = view.getAllByRole("menuitemradio");
    // The focus starts on the checked item (normal speed).
    expect(document.activeElement).toBe(items[2]);
    fireEvent.keyDown(items[2], { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[3]);
    fireEvent.keyDown(items[3], { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0], { key: "End" });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(items[items.length - 1], { key: "Escape" });

    expect(view.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes when the controls hide", () => {
    const view = render(<PolutekControls />);
    fireEvent.click(view.getByRole("button", { name: "Ustawienia" }));
    expect(view.getByRole("menu")).toBeTruthy();
    media.state = { ...media.state, controlsVisible: false };
    view.rerender(<PolutekControls />);
    expect(view.queryByRole("menu")).toBeNull();
  });

  it("keeps Vidstack's default keys, minus the speed keys (the menu is the only speed control)", () => {
    const source = readFileSync(join(process.cwd(), "app/components/VideoPlayer.tsx"), "utf8");
    expect(source).toMatch(/PLAYER_KEY_SHORTCUTS = \{ \.\.\.MEDIA_KEY_SHORTCUTS, speedUp: '', slowDown: '', \.\.\.CHAPTER_KEY_SHORTCUTS \}/);
  });

  it("has no CC button for a video without captions", () => {
    media.state = { ...media.state, hasCaptions: false, textTrack: null };
    const view = render(<PolutekControls />);
    expect(view.queryByRole("button", { name: "Napisy" })).toBeNull();
  });
});

describe("PolutekControls: one-row bar (quality badge, time chip, picture-in-picture, chapters entry)", () => {
  beforeEach(() => {
    document.documentElement.lang = "pl";
    media.enterPictureInPicture.mockReset();
    media.toggleCaptions.mockReset();
    media.chapters = [];
    media.chapterTitle = "";
    media.state = {
      paused: false, waiting: false, ended: false, muted: false, volume: 1, canSetVolume: true,
      canFullscreen: true, fullscreen: false, controlsVisible: true, hasCaptions: false, textTracks: [],
      duration: 600, live: false,
    };
  });
  afterEach(() => cleanup());

  it("the settings button shows the quality being played (4K / HD / SD), named in its label too", () => {
    for (const [height, badge] of [[2160, "4K"], [1080, "HD"], [720, "HD"], [480, "SD"]] as const) {
      media.state = { ...media.state, quality: { height }, qualities: [{ height: 360 }, { height }] };
      const view = render(<PolutekControls />);
      const trigger = view.getByRole("button", { name: `Ustawienia (${badge})` });
      expect(trigger.querySelector(".mc-quality-badge")?.textContent).toBe(badge);
      expect(trigger.className).toContain("mc-btn--badge");
      cleanup();
    }
  });

  it("falls back to a gear while the quality is unknown", () => {
    const view = render(<PolutekControls />);
    const trigger = view.getByRole("button", { name: "Ustawienia" });
    expect(trigger.querySelector(".mc-quality-badge")).toBeNull();
    expect(trigger.querySelector("svg")).not.toBeNull();
  });

  it("lays play, track, duration and the icon group out in one row, with the time chip on the track", () => {
    const view = render(<PolutekControls />);
    const bar = view.container.querySelector(".mc-bar")!;
    const children = Array.from(bar.children);
    expect(children[0].className).toContain("mc-play");
    expect(children.some((el) => el.classList.contains("mc-track-area"))).toBe(true);
    expect(children[children.length - 1].className).toBe("mc-group");
    expect(view.container.querySelector(".mc-track-area .mc-chip--playhead")).not.toBeNull();
    // The chip is decoration: the slider announces the time.
    expect(view.container.querySelector(".mc-chip--playhead")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows the total length only for a finite, non-live video", () => {
    const vod = render(<PolutekControls />);
    expect(vod.container.querySelector(".mc-duration")).not.toBeNull();
    cleanup();
    media.state = { ...media.state, live: true, duration: Infinity };
    const live = render(<PolutekControls />);
    expect(live.container.querySelector(".mc-duration")).toBeNull();
  });

  it("puts picture-in-picture on the bar only where the browser offers it", () => {
    const without = render(<PolutekControls />);
    expect(without.queryByRole("button", { name: "Obraz w obrazie" })).toBeNull();
    cleanup();
    media.state = { ...media.state, canPictureInPicture: true, pictureInPicture: false };
    const view = render(<PolutekControls />);
    fireEvent.click(view.getByRole("button", { name: "Obraz w obrazie" }));
    expect(media.enterPictureInPicture).toHaveBeenCalledTimes(1);
  });

  it("offers the chapters panel from the settings menu (the phone row has no chapters button)", () => {
    media.chapters = [
      { cue: { startTime: 0 }, label: "Wstęp", selected: false },
      { cue: { startTime: 20 }, label: "Temat", selected: true },
      { cue: { startTime: 40 }, label: "Koniec", selected: false },
    ];
    media.chapterTitle = "Temat";
    const view = render(<PolutekControls />);
    fireEvent.click(view.getByRole("button", { name: "Ustawienia" }));
    const entry = view.getByRole("menuitem", { name: /Rozdziały/ });
    expect(entry.textContent).toContain("Temat");
    fireEvent.click(entry);
    // The settings menu closed and the chapters panel opened in its place.
    const menus = view.getAllByRole("menu");
    expect(menus).toHaveLength(1);
    expect(menus[0].getAttribute("aria-label")).toBe("Rozdziały");
  });

  it("below 400px the captions switch is a 'Napisy' entry of the settings menu", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === "(max-width: 399px)",
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    try {
      media.state = { ...media.state, hasCaptions: true, textTrack: { kind: "subtitles", language: "pl", mode: "showing" } };
      const view = render(<PolutekControls />);
      fireEvent.click(view.getByRole("button", { name: "Ustawienia" }));
      const entry = view.getByRole("menuitemcheckbox", { name: "Napisy" });
      expect(entry.getAttribute("aria-checked")).toBe("true");
      fireEvent.click(entry);
      expect(media.toggleCaptions).toHaveBeenCalledTimes(1);
      expect(view.queryByRole("menu")).toBeNull();
      cleanup();

      // No captions on the video: no entry.
      media.state = { ...media.state, hasCaptions: false, textTrack: null };
      const none = render(<PolutekControls />);
      fireEvent.click(none.getByRole("button", { name: "Ustawienia" }));
      expect(none.queryByRole("menuitemcheckbox", { name: "Napisy" })).toBeNull();
    } finally {
      window.matchMedia = original;
    }
  });

  it("wide screens keep captions on the bar, not in the menu", () => {
    media.state = { ...media.state, hasCaptions: true, textTrack: null };
    const view = render(<PolutekControls />);
    expect(view.getByRole("button", { name: "Napisy" })).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Ustawienia" }));
    expect(view.queryByRole("menuitemcheckbox")).toBeNull();
  });

  it("gives every bar button an accessible name", () => {
    media.state = { ...media.state, hasCaptions: true, textTrack: null, canPictureInPicture: true, quality: { height: 1080 } };
    const view = render(<PolutekControls />);
    for (const button of Array.from(view.container.querySelectorAll(".mc-bar button"))) {
      expect(button.getAttribute("aria-label")?.trim()).toBeTruthy();
    }
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
