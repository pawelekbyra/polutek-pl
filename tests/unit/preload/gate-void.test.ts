import { describe, expect, it } from "vitest";
import { VOID_T, VOID_TITLE, revealAt, titleScale } from "@/app/components/preload/gate-void";
import { WARP } from "@/app/components/preload/gate-warp-timeline";

describe("the void: WWW.PAWELPERFECT.COM out of the pupil", () => {
  it("lives inside the black void, between the end of the zoom and the final flash", () => {
    expect(VOID_TITLE).toBe("WWW.PAWELPERFECT.COM");
    expect(VOID_T.open).toBeGreaterThan(WARP.blackAt);
    expect(VOID_T.flash).toBe(WARP.flash);
  });

  it("flies out of the depth and brakes to its resting size by the swell", () => {
    expect(titleScale(VOID_T.open - 0.01)).toBe(0);
    expect(titleScale(VOID_T.open)).toBeLessThan(0.05);
    let last = 0;
    for (let t = VOID_T.open; t <= VOID_T.arrive; t += 0.1) {
      const s = titleScale(t);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
    expect(titleScale(VOID_T.arrive)).toBeCloseTo(1, 5);
    // Braking: the last half second barely changes it compared to the middle of the flight.
    const late = titleScale(VOID_T.arrive) - titleScale(VOID_T.arrive - 0.5);
    const mid = titleScale(7.0) - titleScale(6.5);
    expect(late).toBeLessThan(mid);
  });

  it("rests, then rushes through the camera into the flash", () => {
    expect(titleScale(9.3)).toBeGreaterThan(1);
    expect(titleScale(9.3)).toBeLessThan(1.06);
    expect(titleScale(VOID_T.flash)).toBeGreaterThan(8);
  });

  it("decodes every letter in order, all of them before it comes to rest", () => {
    for (let i = 1; i < VOID_TITLE.length; i++) expect(revealAt(i)).toBeGreaterThan(revealAt(i - 1));
    expect(revealAt(0)).toBeGreaterThan(VOID_T.open);
    expect(revealAt(VOID_TITLE.length - 1)).toBeLessThan(VOID_T.arrive);
  });
});

