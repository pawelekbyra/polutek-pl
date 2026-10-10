/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Canvas art is irrelevant here and jsdom has neither matchMedia nor a 2d context.
vi.mock("@/app/components/preload/MatrixRain", () => ({ MatrixRain: () => null }));

const mocks = vi.hoisted(() => ({ auth: { isLoaded: true } }));

vi.mock("@/lib/auth/react", () => ({ useAuth: () => mocks.auth }));

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

const enterButton = () => screen.getByRole("button", { name: /WEJDŹ/ });

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

  it("shows the prompt and a progress bar from the very first render, with no rabbit and nothing to click", () => {
    render(
      <PageRevealGate waitFor={["player"]}>
        <Piece name="player" ready={false} />
      </PageRevealGate>,
    );

    expect(preloaderState()).toBe("covering");
    expect(screen.getByText("Follow the white rabbit")).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: "ŁADOWANIE" });
    expect(bar.textContent).toBe("ŁADOWANIE");
    // No rabbit and no entry button until the page is ready.
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.queryByText(/WEJDŹ/)).toBeNull();
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
    // The bar gives way to the rabbit with "WEJDŹ" under it: one button, one click on either part.
    expect(enterButton().textContent).toBe("WEJDŹ");
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

  it("is a no-op outside a gate", () => {
    render(<Piece name="player" ready />);
    expect(preloaderState()).toBe("gone");
  });
});
