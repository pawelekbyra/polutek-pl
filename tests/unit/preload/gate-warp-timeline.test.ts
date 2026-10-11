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

  it("holds still through the opening whisper, then moves from the motif's first frame, slowly", () => {
    // The whisper (0-0.65 s): no zoom yet, but the prompt already fades (the click registered).
    expect(cameraAt(WARP.zoomFrom - 0.01, pupil, center, zoom).scale).toBeCloseTo(1);
    expect(cameraAt(0.4, pupil, center, zoom).textOpacity).toBeLessThan(0.7);
    // The motif: visibly bigger a tenth of a second later, still small a second later.
    expect(cameraAt(WARP.zoomFrom + 0.1, pupil, center, zoom).scale).toBeGreaterThan(1.02);
    expect(cameraAt(WARP.zoomFrom + 1.0, pupil, center, zoom).scale).toBeLessThan(2.2);
    expect(cameraAt(0.7, pupil, center, zoom).textOpacity).toBe(0);
  });

  it("has the pupil centred long before it enters it", () => {
    const cam = cameraAt(WARP.zoomFrom + 3.0, pupil, center, zoom);
    expect(cam.tx + cam.scale * pupil.x).toBeCloseTo(center.x);
    expect(cam.ty + cam.scale * pupil.y).toBeCloseTo(center.y);
  });

  it("enters the pupil on the sound's first bright hit (4.95 s), not earlier", () => {
    expect(WARP.blackAt).toBeCloseTo(4.95);
    // Half a second before it the eye is still being approached, not yet black.
    expect(cameraAt(WARP.blackAt - 0.5, pupil, center, zoom).scale).toBeLessThan(zoom.black / 2);
    expect(blackoutAt(WARP.blackAt - 0.5)).toBe(0);
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
    expect(WARP.flashEnd).toBeGreaterThan(WARP.flash);
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

describe("entry sound asset", () => {
  it("is the sound the timeline was cut to: the file's length matches WARP.end", async () => {
    const { statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { GATE_SOUND_URL } = await import("@/app/components/preload/gate-sound");
    const size = statSync(join(process.cwd(), "public", GATE_SOUND_URL)).size;
    // 128 kb/s constant bitrate: 16 000 bytes per second.
    expect(Math.abs(size / 16000 - WARP.end)).toBeLessThan(0.6);
  });

  it("never reuses the name of an older, shorter version of the sound", async () => {
    const { GATE_SOUND_URL } = await import("@/app/components/preload/gate-sound");
    expect(GATE_SOUND_URL).not.toBe("/sounds/gate-enter.mp3");
    expect(GATE_SOUND_URL).toMatch(/gate-enter-\d+s\.mp3$/);
  });
});
