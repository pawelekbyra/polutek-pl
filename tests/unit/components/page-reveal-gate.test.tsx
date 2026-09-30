/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Canvas art is irrelevant here and jsdom has neither matchMedia nor a 2d context.
vi.mock("@/app/components/preload/MatrixRain", () => ({ MatrixRain: () => null }));

const mocks = vi.hoisted(() => ({ auth: { isLoaded: true } }));

vi.mock("@clerk/nextjs", () => ({ useAuth: () => mocks.auth }));

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

// The gate waits for the viewer: once the page has settled (or the max wait expired) the
// preloader shows "Follow the white rabbit" and only a click on the rabbit reveals the page.
// The button is inert until the prompt has finished typing itself out.
async function enterThroughRabbitGate() {
  await act(async () => {
    vi.advanceTimersByTime(3000);
  });
  fireEvent.click(screen.getByRole("button", { name: "Enter" }));
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

  it("covers the page until every awaited piece has settled, then fades out and unmounts", async () => {
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
    // Everything settled: the rabbit prompt takes over, the page stays covered until the click.
    expect(preloaderState()).toBe("gate");

    await enterThroughRabbitGate();
    expect(preloaderState()).toBe("leaving");

    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(preloaderState()).toBe("gone");
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

  it("skips the preloader on later mounts in the same document (client navigation back home)", async () => {
    const first = render(
      <PageRevealGate>
        <p>page</p>
      </PageRevealGate>,
    );
    await enterThroughRabbitGate();
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    first.unmount();

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
