import { describe, expect, it } from "vitest";
import { WARP, cameraAt, flashAt, maxZoom, pupilAt, pupilOnScreen, tunnelAt } from "@/app/components/preload/gate-warp-timeline";

const viewport = { width: 390, height: 844 };
const center = { x: 195, y: 422 };
// The rabbit box as laid out on a phone (203 px, centred).
const pupil = pupilOnScreen({ left: 93.5, top: 320.5, width: 203, height: 203 });
const zoom = maxZoom(pupil.r, viewport);
const cover = Math.hypot(viewport.width, viewport.height) * 0.62;

describe("entry warp timeline", () => {
  it("finds the pupil in the rabbit image (right of centre, upper half)", () => {
    expect(pupil.x).toBeGreaterThan(195);
    expect(pupil.y).toBeLessThan(422);
    expect(pupil.r).toBeGreaterThan(1);
  });

  it("starts with the camera at rest and the text fully visible", () => {
    const cam = cameraAt(0, pupil, center, zoom);
    expect(cam.scale).toBeCloseTo(1);
    expect(cam.tx).toBeCloseTo(0);
    expect(cam.ty).toBeCloseTo(0);
    expect(cam.textOpacity).toBe(1);
  });

  it("ends the zoom with the eye in the screen centre, filling the frame, the text gone", () => {
    const cam = cameraAt(WARP.zoomEnd, pupil, center, zoom);
    expect(cam.scale).toBeCloseTo(zoom);
    expect(cam.tx + cam.scale * pupil.x).toBeCloseTo(center.x);
    expect(cam.ty + cam.scale * pupil.y).toBeCloseTo(center.y);
    expect(cam.textOpacity).toBe(0);
    // About 11 pupil radii (the eye) fill most of the shorter edge.
    expect(pupil.r * zoom * 11).toBeGreaterThan(viewport.width * 0.8);
  });

  it("zooms faster and faster (accelerating), never backwards", () => {
    let last = cameraAt(0, pupil, center, zoom).scale;
    let lastStep = 0;
    for (let t = 0.2; t <= WARP.zoomEnd; t += 0.2) {
      const s = cameraAt(t, pupil, center, zoom).scale;
      expect(s).toBeGreaterThanOrEqual(last);
      expect(s - last).toBeGreaterThanOrEqual(lastStep - 1e-9);
      lastStep = s - last;
      last = s;
    }
  });

  it("opens the pupil on the low hit until it covers the screen", () => {
    const before = pupilAt(WARP.burstStart, pupil, center, zoom, cover);
    const after = pupilAt(WARP.burstEnd, pupil, center, zoom, cover);
    expect(before.r).toBeLessThan(after.r);
    expect(after.r).toBeGreaterThanOrEqual(cover * 0.99);
  });

  it("runs the tunnel from its start to the flash, faster and faster", () => {
    expect(tunnelAt(WARP.tunnelStart - 0.01).visible).toBe(false);
    expect(tunnelAt(WARP.tunnelStart + 0.5).visible).toBe(true);
    const a = tunnelAt(3).travel;
    const b = tunnelAt(3.5).travel;
    const c = tunnelAt(4).travel;
    expect(b - a).toBeLessThan(c - b);
    expect(tunnelAt(WARP.flashEnd).visible).toBe(false);
  });

  it("flashes on the bright hit and then fades the gate out", () => {
    expect(flashAt(WARP.flash - 0.01).radius).toBe(0);
    expect(flashAt(WARP.flashEnd).radius).toBe(1);
    expect(flashAt(WARP.flashEnd).screenOpacity).toBe(1);
    expect(flashAt(WARP.end).screenOpacity).toBe(0);
  });
});
