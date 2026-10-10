import { describe, expect, it } from "vitest";
import { WARP, blackoutAt, cameraAt, flashAt, pupilOnScreen, zoomLevels } from "@/app/components/preload/gate-warp-timeline";

const viewport = { width: 390, height: 844 };
const center = { x: 195, y: 422 };
// The rabbit box as laid out on a phone (203 px, centred).
const pupil = pupilOnScreen({ left: 93.5, top: 320.5, width: 203, height: 203 });
const zoom = zoomLevels(pupil.r, viewport);

describe("entry warp timeline", () => {
  it("finds the pupil's black core in the rabbit image (right of centre, upper half)", () => {
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

  it("has the eye centred and filling the frame on the low hit, the text gone", () => {
    const cam = cameraAt(WARP.eyeAt, pupil, center, zoom);
    expect(cam.scale).toBeCloseTo(zoom.eye);
    expect(cam.tx + cam.scale * pupil.x).toBeCloseTo(center.x);
    expect(cam.ty + cam.scale * pupil.y).toBeCloseTo(center.y);
    expect(cam.textOpacity).toBe(0);
  });

  it("ends inside the black core: it covers the whole screen, which is fully black", () => {
    const cam = cameraAt(WARP.blackAt, pupil, center, zoom);
    expect(cam.scale).toBeCloseTo(zoom.black);
    expect(pupil.r * cam.scale).toBeGreaterThan(Math.hypot(viewport.width, viewport.height) / 2);
    expect(cam.tx + cam.scale * pupil.x).toBeCloseTo(center.x);
    expect(blackoutAt(WARP.blackFrom - 0.01)).toBe(0);
    expect(blackoutAt(WARP.blackAt)).toBe(1);
  });

  it("zooms in all the time, never backwards", () => {
    let last = cameraAt(0, pupil, center, zoom).scale;
    for (let t = 0.1; t <= WARP.blackAt; t += 0.1) {
      const s = cameraAt(t, pupil, center, zoom).scale;
      expect(s).toBeGreaterThanOrEqual(last - 1e-9);
      last = s;
    }
  });

  it("keeps a long black void between the end of the zoom and the final flash", () => {
    expect(WARP.flash - WARP.blackAt).toBeGreaterThan(6);
    // Fully black all through it, and the flash is on the sound's last hit, before its end.
    for (let t = WARP.blackAt; t < WARP.flash; t += 0.5) expect(blackoutAt(t)).toBe(1);
    expect(WARP.flash).toBeLessThan(WARP.end);
    expect(WARP.end).toBeCloseTo(12.3, 1);
  });

  it("flashes on the bright hit and then fades the gate out", () => {
    expect(flashAt(WARP.flash - 0.01).radius).toBe(0);
    expect(flashAt(WARP.flashEnd).radius).toBe(1);
    expect(blackoutAt(WARP.flashEnd)).toBe(0);
    expect(flashAt(WARP.flashEnd).screenOpacity).toBe(1);
    expect(flashAt(WARP.end).screenOpacity).toBe(0);
  });
});
