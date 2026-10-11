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

  it("never stops at the flash: it keeps flying at the camera until the screen is white", () => {
    let last = titleScale(VOID_T.flash);
    for (let t = VOID_T.flash + 0.02; t <= WARP.flashEnd; t += 0.02) {
      const s = titleScale(t);
      expect(s).toBeGreaterThan(last);
      last = s;
    }
    // Inside the flash it bolts: far more than the whole rush before it.
    expect(titleScale(WARP.flashEnd)).toBeGreaterThan(titleScale(VOID_T.flash) * 15);
  });

  it("keeps cycling rain glyphs for the whole flight and decodes the letters in order only once it is in place", () => {
    for (let i = 1; i < VOID_TITLE.length; i++) expect(revealAt(i)).toBeGreaterThan(revealAt(i - 1));
    expect(revealAt(0)).toBeGreaterThanOrEqual(VOID_T.arrive - 0.05);
    expect(revealAt(VOID_TITLE.length - 1)).toBeLessThan(VOID_T.push);
  });
});


describe("the final dive", () => {
  it("chooses between the two middle letters, the P and the E of PERFECT", async () => {
    const { AIM_CANDIDATES } = await import("@/app/components/preload/gate-void");
    expect(AIM_CANDIDATES.map((i) => VOID_TITLE[i]).join("")).toBe("PE");
  });
});

describe("the tunnel of rain glyphs", () => {
  it("the camera only ever moves forward, fast while the title flies in, slow while it rests, fastest in the flash", async () => {
    const { tunnelTravel } = await import("@/app/components/preload/gate-void");
    let last = -1;
    for (let t = VOID_T.open; t <= WARP.flashEnd; t += 0.05) {
      const d = tunnelTravel(t);
      expect(d).toBeGreaterThanOrEqual(last);
      last = d;
    }
    const rate = (a: number, b: number) => (tunnelTravel(b) - tunnelTravel(a)) / (b - a);
    expect(rate(6.0, 6.5)).toBeGreaterThan(rate(9.0, 9.5));
    expect(rate(11.3, 11.5)).toBeGreaterThan(rate(10.4, 10.9));
  });
});

describe("the tunnel starts on the accent", () => {
  it("is there the moment the camera enters the pupil, with a burst of speed", async () => {
    const { tunnelTravel } = await import("@/app/components/preload/gate-void");
    expect(VOID_T.tunnel).toBe(WARP.blackAt);
    expect(tunnelTravel(VOID_T.tunnel)).toBe(0);
    const burst = (tunnelTravel(VOID_T.tunnel + 0.3) - tunnelTravel(VOID_T.tunnel)) / 0.3;
    const cruise = (tunnelTravel(9.5) - tunnelTravel(9.2)) / 0.3;
    expect(burst).toBeGreaterThan(cruise * 4);
  });
});
