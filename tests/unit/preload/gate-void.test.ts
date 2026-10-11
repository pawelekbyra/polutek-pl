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
    for (const [a, b] of [[4.5, 4.9], [5.0, 5.4], [7.0, 7.5], [8.4, 9.4], [10.4, 11.2]]) {
      expect(rate(a, b)).toBeCloseTo(TUNNEL_SPEED, 6);
    }
    expect(rate(11.35, 11.5)).toBeGreaterThan(TUNNEL_SPEED * 2);
  });

  it("grows at the zoom's own tempo, with no jump when the camera enters the pupil", async () => {
    const { tunnelEmerge, zoomEndRate } = await import("@/app/components/preload/gate-void");
    const { cameraAt, zoomLevels } = await import("@/app/components/preload/gate-warp-timeline");
    expect(VOID_T.tunnelFull).toBe(WARP.blackAt);
    const rate = (t: number) => Math.log(tunnelEmerge(t + 0.005) / tunnelEmerge(t - 0.005)) / 0.01;
    // Inside the pupil it grows exactly as fast as the zoom...
    const viewport = { width: 390, height: 844 };
    const pupil = { x: 195, y: 422, r: 1.4 };
    const zoom = zoomLevels(pupil.r, viewport);
    const zoomRate = (t: number) =>
      Math.log(cameraAt(t + 0.005, pupil, pupil, zoom).scale / cameraAt(t - 0.005, pupil, pupil, zoom).scale) / 0.01;
    for (const t of [4.5, 4.7, 4.9]) expect(rate(t) / zoomRate(t)).toBeCloseTo(1, 1);
    // ...its rate is continuous through the entry (no sudden acceleration or stop)...
    expect(rate(WARP.blackAt + 0.006) / rate(WARP.blackAt - 0.006)).toBeGreaterThan(0.9);
    expect(rate(WARP.blackAt + 0.006) / rate(WARP.blackAt - 0.006)).toBeLessThan(1.1);
    expect(zoomEndRate()).toBeGreaterThan(2.5);
    expect(zoomEndRate()).toBeLessThan(4);
    // ...and then eases off into its full size within about a second.
    expect(rate(5.5)).toBeLessThan(rate(5.0));
    expect(tunnelEmerge(6.2)).toBeGreaterThan(0.95);
    expect(tunnelEmerge(9)).toBeCloseTo(1, 4);
    let last = 0;
    for (let t = VOID_T.tunnelFrom; t <= 7; t += 0.01) {
      expect(tunnelEmerge(t)).toBeGreaterThanOrEqual(last);
      last = tunnelEmerge(t);
    }
    // Inside the pupil it is a small disc well within the pupil's black core.
    const fullRadius = Math.hypot(195, 422) / 0.9;
    for (let t = VOID_T.tunnelFrom; t < WARP.blackAt; t += 0.02) {
      const core = cameraAt(t, pupil, pupil, zoom).scale * pupil.r;
      expect(tunnelEmerge(t) * fullRadius).toBeLessThanOrEqual(core * 0.5);
    }
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
