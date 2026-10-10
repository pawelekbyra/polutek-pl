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

  it("shows the gate with the rabbit, the prompt and a progress bar (no button) on the first load of the document", () => {
    render(<HomeRouteLoading />);
    expect(screen.getByTestId("site-preloader")).toBeTruthy();
    expect(screen.getByText("Follow the white rabbit")).toBeTruthy();
    expect(document.querySelector("[data-gate-rabbit] img")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "ŁADOWANIE" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("never re-shows the gate once the page was entered in this session", async () => {
    const gate = render(<PageRevealGate><p>page</p></PageRevealGate>);
    fireEvent.click(screen.getByRole("button", { name: "ENTER" }));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    gate.unmount();

    const loading = render(<HomeRouteLoading />);
    expect(screen.queryByTestId("site-preloader")).toBeNull();
    expect(loading.container.innerHTML).toBe("");
  });

  it("renders nothing on a reload in a tab session that already entered", () => {
    sessionStorage.setItem("polutek:revealed", "1");
    const loading = render(<HomeRouteLoading />);
    expect(loading.container.innerHTML).toBe("");
  });
});
