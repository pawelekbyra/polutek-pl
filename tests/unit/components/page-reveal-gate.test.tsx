/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Canvas art is irrelevant here and jsdom has neither matchMedia nor a 2d context.
vi.mock("@/app/components/preload/MatrixRain", () => ({ MatrixRain: () => null }));

const mocks = vi.hoisted(() => ({ auth: { isLoaded: true } }));

vi.mock("@/lib/auth/react", () => ({ useAuth: () => mocks.auth }));
// The entry sound (Web Audio does not exist in jsdom): decoded or not, loadable or not, on demand.
const sound = vi.hoisted(() => ({
  ready: true,
  withSound: true,
  preload: (() => Promise.resolve(true)) as () => Promise<boolean>,
}));
vi.mock("@/app/components/preload/gate-sound", () => ({
  preloadGateSound: () => sound.preload(),
  primeGateSound: () => undefined,
  isGateSoundReady: () => sound.ready,
  releaseGateSound: () => undefined,
  startGateSound: () => ({
    now: () => 0,
    stop: () => undefined,
    dispose: () => undefined,
    get withSound() {
      return sound.withSound;
    },
  }),
}));
// The warp itself (canvas, rAF, audio) is out of scope here: a stand-in that plays it on demand.
vi.mock("@/app/components/preload/GateWarp", () => ({
  GateWarp: (props: { onReveal: () => void; onDone: () => void }) => (
    <button type="button" data-testid="warp-finish" onClick={() => { props.onReveal(); props.onDone(); }} />
  ),
}));

import { GATE_RABBIT } from "@/app/components/preload/gate-rabbit";
import {
  GATE_SOUND_MAX_WAIT_MS,
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
    sound.ready = true;
    sound.withSound = true;
    sound.preload = () => Promise.resolve(true);
    resetPageRevealForTests();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows the rabbit, the prompt and a progress bar from the very first render, with nothing to click", () => {
    render(
      <PageRevealGate waitFor={["player"]}>
        <Piece name="player" ready={false} />
      </PageRevealGate>,
    );

    expect(preloaderState()).toBe("covering");
    // The rabbit and the prompt are in their place from the start; the rabbit is not clickable yet.
    expect(screen.getByText("Follow the white rabbit")).toBeTruthy();
    expect(document.querySelector("[data-gate-rabbit] img")?.getAttribute("src")).toBe(GATE_RABBIT.svg);
    expect(document.querySelector("[data-gate-rabbit]")?.hasAttribute("data-ready")).toBe(false);
    // Under the rabbit: the progress bar with its label, and no entry button until the page is ready.
    const bar = screen.getByRole("progressbar", { name: "ŁADOWANIE" });
    expect(bar.textContent).toBe("ŁADOWANIE");
    expect(screen.queryByRole("button")).toBeNull();
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
    // The bar gives way to the ENTER button under the rabbit, which stays where it was.
    expect(screen.getByText("Follow the white rabbit")).toBeTruthy();
    expect(enterButton().textContent).toBe("ENTER");
    expect(document.querySelector("[data-gate-rabbit] img")?.getAttribute("src")).toBe(GATE_RABBIT.svg);
    expect(document.querySelector("[data-gate-rabbit]")?.hasAttribute("data-ready")).toBe(true);
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
    // A click on the rabbit while loading does nothing.
    fireEvent.click(document.querySelector("[data-gate-rabbit] img")!);
    expect(preloaderState()).toBe("covering");
    expect(onEnter).not.toHaveBeenCalled();

    rerender(
      <PageRevealGate waitFor={["player"]}>
        <Piece name="player" ready />
      </PageRevealGate>,
    );
    expect(preloaderState()).toBe("gate");
    // Ready: the button takes the keyboard focus and a click on the rabbit enters.
    expect(document.activeElement).toBe(enterButton());
    fireEvent.click(document.querySelector("[data-gate-rabbit] img")!);
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

  it("hides the pointer while loading, shows the carrot only once ENTER is there, hides it again after the click", async () => {
    const { rerender } = render(
      <PageRevealGate waitFor={["player"]}>
        <Piece name="player" ready={false} />
      </PageRevealGate>,
    );
    const cursor = () => screen.getByTestId("site-preloader").getAttribute("data-cursor");
    expect(cursor()).toBe("none");

    rerender(
      <PageRevealGate waitFor={["player"]}>
        <Piece name="player" ready />
      </PageRevealGate>,
    );
    expect(cursor()).toBe("carrot");

    fireEvent.click(enterButton());
    expect(cursor()).toBe("none");
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
    // The warp's sound and vector are loaded while the gate loads (here: unavailable, resolved at once).
    await act(async () => {});
    const rabbit = document.querySelector("[data-gate-rabbit] img")!;
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

  it("moves the focus to the page content once the gate is gone (after the warp and after the plain fade)", async () => {
    // Warp.
    window.matchMedia = ((query: string) => ({ matches: false, media: query })) as unknown as typeof window.matchMedia;
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as never);
    const { unmount } = render(
      <PageRevealGate>
        <main id="main" tabIndex={-1}>page</main>
      </PageRevealGate>,
    );
    await act(async () => {});
    const rabbit = document.querySelector("[data-gate-rabbit] img")!;
    vi.spyOn(rabbit, "getBoundingClientRect").mockReturnValue({ left: 100, top: 300, width: 200, height: 200, right: 300, bottom: 500, x: 100, y: 300, toJSON() {} } as DOMRect);
    fireEvent.click(enterButton());
    // Browsers ignore focus() inside an inert subtree (jsdom does not): record where it is called.
    const original = HTMLElement.prototype.focus;
    const inertAtFocus: boolean[] = [];
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
      if (this.id === "main") inertAtFocus.push(this.closest("[inert]") !== null);
      return original.call(this, options);
    });
    fireEvent.click(screen.getByTestId("warp-finish"));
    expect(preloaderState()).toBe("gone");
    expect(document.activeElement?.id).toBe("main");
    expect(inertAtFocus).toEqual([false]);
    focusSpy.mockRestore();
    unmount();
    getContext.mockRestore();
    // @ts-expect-error back to jsdom's default (no matchMedia)
    delete window.matchMedia;

    // Plain fade (no matchMedia in jsdom: no warp).
    resetPageRevealForTests();
    render(
      <PageRevealGate>
        <main id="main" tabIndex={-1}>page</main>
      </PageRevealGate>,
    );
    await act(async () => {});
    fireEvent.click(enterButton());
    expect(preloaderState()).toBe("leaving");
    await finishLeaving();
    expect(preloaderState()).toBe("gone");
    expect(document.activeElement?.id).toBe("main");
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

  describe("the entry's sound", () => {
    function allowMotion() {
      window.matchMedia = ((query: string) => ({ matches: false, media: query })) as unknown as typeof window.matchMedia;
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as never);
    }
    function rabbitBox() {
      const rabbit = document.querySelector("[data-gate-rabbit] img")!;
      vi.spyOn(rabbit, "getBoundingClientRect").mockReturnValue({ left: 100, top: 300, width: 200, height: 200, right: 300, bottom: 500, x: 100, y: 300, toJSON() {} } as DOMRect);
    }
    afterEach(() => {
      // @ts-expect-error back to jsdom's default (no matchMedia)
      delete window.matchMedia;
    });

    it("keeps the loading bar up past the page limit while the sound is not decoded, and offers ENTER the moment it is", async () => {
      allowMotion();
      let resolve!: (ok: boolean) => void;
      sound.ready = false;
      sound.preload = () => new Promise<boolean>((r) => { resolve = r; });
      render(
        <PageRevealGate>
          <p>page</p>
        </PageRevealGate>,
      );
      await act(async () => {});
      // The page has long been ready (nothing awaited, auth loaded), the page limit has passed.
      await act(async () => {
        vi.advanceTimersByTime(PAGE_REVEAL_MAX_WAIT_MS + 4000);
      });
      expect(preloaderState()).toBe("covering");
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.getByRole("progressbar", { name: "ŁADOWANIE" })).toBeTruthy();
      // The rabbit does not enter either.
      fireEvent.click(document.querySelector("[data-gate-rabbit] img")!);
      expect(preloaderState()).toBe("covering");

      sound.ready = true;
      await act(async () => {
        resolve(true);
      });
      expect(preloaderState()).toBe("gate");
      expect(enterButton().textContent).toBe("ENTER");

      // With the sound decoded, the click runs the warp.
      rabbitBox();
      fireEvent.click(enterButton());
      expect(preloaderState()).toBe("warp");
    });

    it("falls back to the plain fade, silent and without animation, when the sound cannot be loaded", async () => {
      allowMotion();
      const unlock = vi.fn();
      window.addEventListener("polutek:gate-unlock", unlock);
      sound.ready = false;
      sound.preload = () => Promise.resolve(false);
      render(
        <PageRevealGate>
          <p>page</p>
        </PageRevealGate>,
      );
      await act(async () => {});
      expect(preloaderState()).toBe("gate");
      rabbitBox();
      fireEvent.click(enterButton());
      expect(preloaderState()).toBe("leaving");
      expect(unlock).not.toHaveBeenCalled();
      await finishLeaving();
      expect(preloaderState()).toBe("gone");
      window.removeEventListener("polutek:gate-unlock", unlock);
    });

    it("gives the sound up at its long limit (never stuck on the bar) and then takes the plain fade", async () => {
      allowMotion();
      sound.ready = false;
      sound.preload = () => new Promise<boolean>(() => undefined);
      render(
        <PageRevealGate>
          <p>page</p>
        </PageRevealGate>,
      );
      await act(async () => {});
      await act(async () => {
        vi.advanceTimersByTime(GATE_SOUND_MAX_WAIT_MS - 1);
      });
      expect(preloaderState()).toBe("covering");
      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(preloaderState()).toBe("gate");
      rabbitBox();
      fireEvent.click(enterButton());
      expect(preloaderState()).toBe("leaving");
    });

    it("takes the plain fade when the audio output cannot be started at the click", async () => {
      allowMotion();
      sound.withSound = false;
      render(
        <PageRevealGate>
          <p>page</p>
        </PageRevealGate>,
      );
      await act(async () => {});
      rabbitBox();
      fireEvent.click(enterButton());
      expect(preloaderState()).toBe("leaving");
    });
  });

  it("is a no-op outside a gate", () => {
    render(<Piece name="player" ready />);
    expect(preloaderState()).toBe("gone");
  });
});
