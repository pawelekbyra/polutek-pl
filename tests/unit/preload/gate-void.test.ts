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
  it("the camera travels at one constant speed (no burst, no slowing with the title), bolting only in the flash", async () => {
    const { tunnelTravel, TUNNEL_SPEED } = await import("@/app/components/preload/gate-void");
    let last = -1;
    for (let t = VOID_T.tunnelFrom; t <= WARP.flashEnd; t += 0.05) {
      const d = tunnelTravel(t);
      expect(d).toBeGreaterThanOrEqual(last);
      last = d;
    }
    const rate = (a: number, b: number) => (tunnelTravel(b) - tunnelTravel(a)) / (b - a);
    for (const [a, b] of [[4.9, 5.0], [5.0, 5.4], [7.0, 7.5], [8.4, 9.4], [10.4, 11.2]]) {
      expect(rate(a, b)).toBeCloseTo(TUNNEL_SPEED, 6);
    }
    expect(rate(11.35, 11.5)).toBeGreaterThan(TUNNEL_SPEED * 2);
  });

  it("appears only once the pupil covers the whole screen, as a point, and grows at the zoom's end tempo", async () => {
    const { tunnelEmerge } = await import("@/app/components/preload/gate-void");
    const { cameraAt, zoomLevels } = await import("@/app/components/preload/gate-warp-timeline");
    // The pupil stays pure black while it does not fill the screen: by tunnelFrom its core covers it.
    for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
      const pupil = { x: viewport.width / 2, y: viewport.height / 2, r: 1.4 };
      const centre = { x: viewport.width / 2, y: viewport.height / 2 };
      const cam = cameraAt(VOID_T.tunnelFrom, pupil, centre, zoomLevels(pupil.r, viewport));
      expect(cam.scale * pupil.r).toBeGreaterThanOrEqual(Math.hypot(viewport.width, viewport.height) / 2);
    }
    expect(VOID_T.tunnelFrom).toBeLessThan(WARP.blackAt);
    expect(VOID_T.tunnelFrom).toBeGreaterThan(WARP.blackAt - 0.2);
    expect(tunnelEmerge(VOID_T.tunnelFrom - 0.01)).toBe(0);
    expect(tunnelEmerge(VOID_T.tunnelFrom + 0.001)).toBeLessThan(0.04);
    // At first it grows about as fast as the zoom ends (e-folds per second).
    const rate = Math.log(tunnelEmerge(VOID_T.tunnelFrom + 0.06) / tunnelEmerge(VOID_T.tunnelFrom + 0.01)) / 0.05;
    expect(rate).toBeGreaterThan(2.5);
    expect(rate).toBeLessThan(4.5);
    let last = 0;
    for (let t = VOID_T.tunnelFrom; t <= VOID_T.tunnelFull; t += 0.05) {
      expect(tunnelEmerge(t)).toBeGreaterThanOrEqual(last);
      last = tunnelEmerge(t);
    }
    expect(tunnelEmerge(VOID_T.tunnelFull)).toBe(1);
    expect(tunnelEmerge(9)).toBe(1);
  });



  it("is already seen through the pupil before the camera enters it", () => {
    expect(VOID_T.tunnelFrom).toBeLessThan(WARP.blackAt);
  });

  it("is a round tube through the screen corners, its columns evenly round it", async () => {
    const { tubeColumns } = await import("@/app/components/preload/gate-void");
    const { xs, ys } = tubeColumns(390, 844);
    const radius = Math.hypot(195, 422) / 195;
    for (let i = 0; i < xs.length; i++) expect(Math.hypot(xs[i], ys[i])).toBeCloseTo(radius, 6);
    const gaps = [...xs].map((x, i) => Math.hypot(xs[(i + 1) % xs.length] - x, ys[(i + 1) % ys.length] - ys[i]));
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1e-9);
  });

});
