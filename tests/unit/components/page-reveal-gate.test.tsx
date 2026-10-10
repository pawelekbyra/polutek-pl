/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Canvas art is irrelevant here and jsdom has neither matchMedia nor a 2d context.
vi.mock("@/app/components/preload/MatrixRain", () => ({ MatrixRain: () => null }));

const mocks = vi.hoisted(() => ({ auth: { isLoaded: true } }));

vi.mock("@/lib/auth/react", () => ({ useAuth: () => mocks.auth }));
// The warp itself (canvas, rAF, audio) is out of scope here: a stand-in that plays it on demand.
vi.mock("@/app/components/preload/GateWarp", () => ({
  GateWarp: (props: { onFlash: () => void; onDone: () => void }) => (
    <button type="button" data-testid="warp-finish" onClick={() => { props.onFlash(); props.onDone(); }} />
  ),
}));

import {
  PAGE_REVEAL_MAX_WAIT_MS,
  PageRevealGate,
  resetPageRevealForTests,
  usePageRevealReady,
} from "@/app/components/preload/PageRevealGate";

function Piece({ name, ready }: { name: string; ready: boolean }) {
  usePageRevealReady(name, ready);
  return <p>{name}</p>;
}

function preloaderState() {
  return screen.queryByTestId("site-preloader")?.getAttribute("data-state") ?? "gone";
}

const enterButton = () => screen.getByRole("button", { name: /ENTER/ });

async function finishLeaving() {
  await act(async () => {
    vi.advanceTimersByTime(800);
  });
}

describe("PageRevealGate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockReturnValue(0);
    mocks.auth.isLoaded = true;
    resetPageRevealForTests();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows only a progress bar from the very first render: no prompt, no rabbit, nothing to click", () => {
    render(
      <PageRevealGate waitFor={["player"]}>
        <Piece name="player" ready={false} />
      </PageRevealGate>,
    );

    expect(preloaderState()).toBe("covering");
    // The prompt belongs to the rabbit: it is not on screen while the bar is.
    expect(screen.queryByText("Follow the white rabbit")).toBeNull();
    const bar = screen.getByRole("progressbar", { name: "ŁADOWANIE" });
    expect(bar.textContent).toBe("ŁADOWANIE");
    // No rabbit and no entry button until the page is ready.
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.queryByText(/ENTER/)).toBeNull();
  });

  it("covers the page until every awaited piece has settled, then waits for the click", async () => {
    const { rerender } = render(
      <PageRevealGate waitFor={["player", "comments"]}>
        <Piece name="player" ready />
        <Piece name="comments" ready={false} />
      </PageRevealGate>,
    );

    // Page content is rendered underneath from the start; only the overlay decides visibility.
    expect(screen.getByText("player")).toBeTruthy();
    expect(preloaderState()).toBe("covering");

    rerender(
      <PageRevealGate waitFor={["player", "comments"]}>
        <Piece name="player" ready />
        <Piece name="comments" ready />
      </PageRevealGate>,
    );
    expect(preloaderState()).toBe("gate");
    // The bar gives way to the rabbit with the prompt above it and "ENTER" under it; rabbit and
    // caption are one button, one click on either part.
    expect(screen.getByText("Follow the white rabbit")).toBeTruthy();
    expect(enterButton().textContent).toBe("ENTER");
    expect(enterButton().querySelector("img")?.getAttribute("src")).toBe("/rabbit-gate.webp");
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("ŁADOWANIE")).toBeNull();

    fireEvent.click(enterButton());
    expect(preloaderState()).toBe("leaving");

    await finishLeaving();
    expect(preloaderState()).toBe("gone");
  });

  it("lets the viewer in with a click on the rabbit or on the caption, only once the page is ready", async () => {
    const onEnter = vi.fn();
    window.addEventListener("polutek:gate-enter", onEnter);
    const { rerender } = render(
      <PageRevealGate waitFor={["player"]}>
        <Piece name="player" ready={false} />
      </PageRevealGate>,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(onEnter).not.toHaveBeenCalled();

    rerender(
      <PageRevealGate waitFor={["player"]}>
        <Piece name="player" ready />
      </PageRevealGate>,
    );
    expect(preloaderState()).toBe("gate");
    // Ready: the button takes the keyboard focus and a click on the rabbit enters.
    expect(document.activeElement).toBe(enterButton());
    fireEvent.click(enterButton().querySelector("img")!);
    expect(preloaderState()).toBe("leaving");
    expect(onEnter).toHaveBeenCalledTimes(1);
    window.removeEventListener("polutek:gate-enter", onEnter);
  });

  it("waits for auth to load before revealing", () => {
    mocks.auth.isLoaded = false;
    render(
      <PageRevealGate>
        <p>page</p>
      </PageRevealGate>,
    );
    expect(preloaderState()).toBe("covering");
  });

  it("never holds the page behind the loader longer than the max wait, even if a piece never settles", async () => {
    render(
      <PageRevealGate waitFor={["player"]}>
        <Piece name="player" ready={false} />
      </PageRevealGate>,
    );
    expect(preloaderState()).toBe("covering");

    await act(async () => {
      vi.advanceTimersByTime(PAGE_REVEAL_MAX_WAIT_MS - 1);
    });
    expect(preloaderState()).toBe("covering");

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(preloaderState()).toBe("gate");
  });

  it("shows the carrot cursor over the whole gate and drops it once the viewer enters", async () => {
    render(
      <PageRevealGate>
        <p>page</p>
      </PageRevealGate>,
    );
    expect(screen.getByTestId("site-preloader").getAttribute("data-cursor")).toBe("carrot");

    fireEvent.click(enterButton());
    expect(screen.getByTestId("site-preloader").getAttribute("data-cursor")).toBeNull();
    await finishLeaving();
    expect(screen.queryByTestId("site-preloader")).toBeNull();
  });

  it("skips the gate on later mounts in the same document and marks <html> for reloads", async () => {
    const first = render(
      <PageRevealGate>
        <p>page</p>
      </PageRevealGate>,
    );
    fireEvent.click(enterButton());
    await finishLeaving();
    expect(sessionStorage.getItem("polutek:revealed")).toBe("1");
    expect(document.documentElement.hasAttribute("data-gate-passed")).toBe(true);
    first.unmount();

    render(
      <PageRevealGate waitFor={["player"]}>
        <Piece name="player" ready={false} />
      </PageRevealGate>,
    );
    expect(preloaderState()).toBe("gone");
  });

  it("skips the gate on a reload in a tab session that already entered", () => {
    sessionStorage.setItem("polutek:revealed", "1");
    render(
      <PageRevealGate waitFor={["player"]}>
        <Piece name="player" ready={false} />
      </PageRevealGate>,
    );
    expect(preloaderState()).toBe("gone");
  });

  it("runs the warp on the click when motion is allowed: unlocks the hero now, starts it at the flash", async () => {
    window.matchMedia = ((query: string) => ({ matches: false, media: query })) as unknown as typeof window.matchMedia;
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as never);
    const unlock = vi.fn();
    const enterEvent = vi.fn();
    window.addEventListener("polutek:gate-unlock", unlock);
    window.addEventListener("polutek:gate-enter", enterEvent);
    render(
      <PageRevealGate>
        <p>page</p>
      </PageRevealGate>,
    );
    const rabbit = enterButton().querySelector("img")!;
    vi.spyOn(rabbit, "getBoundingClientRect").mockReturnValue({ left: 100, top: 300, width: 200, height: 200, right: 300, bottom: 500, x: 100, y: 300, toJSON() {} } as DOMRect);
    fireEvent.click(enterButton());

    expect(preloaderState()).toBe("warp");
    expect(unlock).toHaveBeenCalledTimes(1);
    expect(enterEvent).not.toHaveBeenCalled();
    // A reload during the warp must not show the gate again.
    expect(sessionStorage.getItem("polutek:revealed")).toBe("1");

    fireEvent.click(screen.getByTestId("warp-finish"));
    expect(enterEvent).toHaveBeenCalledTimes(1);
    expect(preloaderState()).toBe("gone");
    window.removeEventListener("polutek:gate-unlock", unlock);
    window.removeEventListener("polutek:gate-enter", enterEvent);
    getContext.mockRestore();
    // @ts-expect-error back to jsdom's default (no matchMedia)
    delete window.matchMedia;
  });

  it("keeps the plain fade (no warp, no unlock) when the viewer prefers reduced motion", () => {
    window.matchMedia = ((query: string) => ({ matches: true, media: query })) as unknown as typeof window.matchMedia;
    const unlock = vi.fn();
    window.addEventListener("polutek:gate-unlock", unlock);
    render(
      <PageRevealGate>
        <p>page</p>
      </PageRevealGate>,
    );
    fireEvent.click(enterButton());
    expect(preloaderState()).toBe("leaving");
    expect(unlock).not.toHaveBeenCalled();
    window.removeEventListener("polutek:gate-unlock", unlock);
    // @ts-expect-error back to jsdom's default (no matchMedia)
    delete window.matchMedia;
  });

  it("is a no-op outside a gate", () => {
    render(<Piece name="player" ready />);
    expect(preloaderState()).toBe("gone");
  });
});
