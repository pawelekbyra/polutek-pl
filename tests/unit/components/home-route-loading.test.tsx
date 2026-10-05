/** @vitest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Canvas art is irrelevant here and jsdom has neither matchMedia nor a 2d context.
vi.mock("@/app/components/preload/MatrixRain", () => ({ MatrixRain: () => null }));

vi.mock("@/lib/auth/react", () => ({ useAuth: () => ({ isLoaded: true }) }));

import { HomeRouteLoading } from "@/app/components/preload/HomeRouteLoading";
import { PageRevealGate, resetPageRevealForTests } from "@/app/components/preload/PageRevealGate";

describe("HomeRouteLoading", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetPageRevealForTests();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows the full-screen preloader on the first load of the document", () => {
    render(<HomeRouteLoading />);
    expect(screen.getByTestId("site-preloader")).toBeTruthy();
    expect(screen.queryByTestId("home-skeleton")).toBeNull();
  });

  it("never re-shows the preloader once the page was revealed in this session", async () => {
    const gate = render(<PageRevealGate><p>page</p></PageRevealGate>);
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Enter" }));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    gate.unmount();

    const loading = render(<HomeRouteLoading />);
    expect(screen.queryByTestId("site-preloader")).toBeNull();
    expect(loading.container.innerHTML).toBe("");
  });
});
