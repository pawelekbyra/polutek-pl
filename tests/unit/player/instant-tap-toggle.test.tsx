// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const togglePaused = vi.fn();
const play = vi.fn();
const pause = vi.fn();
const state = { paused: false };
let listener: ((s: { paused: boolean }) => void) | null = null;
const subscribe = (cb: (s: { paused: boolean }) => void) => {
  listener = cb;
  return () => {
    listener = null;
  };
};
const provider = document.createElement("div");
provider.setAttribute("data-media-provider", "");
const playerEl = document.createElement("div");
playerEl.appendChild(provider);

vi.mock("@vidstack/react", () => ({
  useMediaPlayer: () => ({ el: playerEl, state, subscribe }),
  useMediaRemote: () => ({ togglePaused, play, pause }),
}));

import { InstantTapToggle } from "@/app/components/player/controls/InstantTapToggle";

function up(init: PointerEventInit) {
  // jsdom has no PointerEvent: a MouseEvent carrying the one extra field the handler reads.
  const event = new MouseEvent("pointerup", { bubbles: true, ...init });
  Object.defineProperty(event, "isPrimary", { value: true });
  provider.dispatchEvent(event);
}

describe("InstantTapToggle", () => {
  afterEach(() => {
    cleanup();
    togglePaused.mockClear();
    play.mockClear();
    pause.mockClear();
    state.paused = false;
  });

  it("toggles on the release itself, synchronously (no 250 ms double-tap wait)", () => {
    render(<InstantTapToggle />);
    up({ button: 0 });
    expect(togglePaused).toHaveBeenCalledTimes(1);
  });

  it("a double tap puts the state back once the media has reported the first toggle", () => {
    render(<InstantTapToggle />);
    up({ button: 0 });
    up({ button: 0 });
    expect(togglePaused).toHaveBeenCalledTimes(1);
    expect(play).not.toHaveBeenCalled(); // state has not caught up yet: wait
    state.paused = true; // the media reports the pause
    listener?.({ paused: true });
    expect(play).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();
  });

  it("ignores other buttons and stops listening on unmount", () => {
    const view = render(<InstantTapToggle />);
    up({ button: 2 });
    expect(togglePaused).not.toHaveBeenCalled();
    view.unmount();
    up({ button: 0 });
    expect(togglePaused).not.toHaveBeenCalled();
  });
});

describe("PolutekControls gestures", () => {
  it("uses the instant toggle for the single tap and keeps Vidstack's double tap for fullscreen", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/components/player/PolutekControls.tsx", "utf8");
    expect(src).toContain("<InstantTapToggle />");
    expect(src).not.toContain('event="pointerup"');
    expect(src).toContain('event="dblpointerup" action="toggle:fullscreen"');
  });
});
