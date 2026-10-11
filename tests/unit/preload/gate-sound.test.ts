/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetGateSoundForTests, startGateSound } from "@/app/components/preload/gate-sound";

let visibility: DocumentVisibilityState = "visible";

afterEach(() => {
  vi.restoreAllMocks();
  visibility = "visible";
  resetGateSoundForTests();
});

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("the warp's clock", () => {
  it("stops counting while the tab is hidden, so sound and picture go on together when it is back", () => {
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const clock = startGateSound();
    expect(clock.withSound).toBe(false); // jsdom: no Web Audio, the silent wall clock
    now += 2000;
    expect(clock.now()).toBeCloseTo(2, 5);
    setVisibility("hidden");
    now += 30000;
    expect(clock.now()).toBeCloseTo(2, 5);
    setVisibility("visible");
    now += 500;
    expect(clock.now()).toBeCloseTo(2.5, 5);
    clock.dispose();
    // Disposed: no longer follows the tab.
    setVisibility("hidden");
    now += 1000;
    expect(clock.now()).toBeCloseTo(3.5, 5);
  });
});
