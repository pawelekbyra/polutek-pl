/** @vitest-environment jsdom */
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ isLoaded: true }) }));
vi.mock("@/components/skeletons", () => ({
  HomePageSkeleton: () => <div data-testid="home-skeleton" />,
}));

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

  it("shows a layout skeleton, never the preloader, once the page was revealed in this session", async () => {
    const gate = render(<PageRevealGate><p>page</p></PageRevealGate>);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    gate.unmount();

    render(<HomeRouteLoading />);
    expect(screen.getByTestId("home-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("site-preloader")).toBeNull();
  });
});
