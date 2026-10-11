import { describe, expect, it } from "vitest";
import { MAX_HOLD_S, MAX_SLEW, SNAP_ERROR_S, createWarpClock, type AudioSample } from "@/app/components/preload/gate-clock";

/** Steps the clock in 50 ms frames from `from` to `to` (wall seconds); returns the last picture time. */
function run(clock: ReturnType<typeof createWarpClock>, from: number, to: number, sample: (wall: number) => AudioSample | null) {
  let t = 0;
  for (let wall = from; wall <= to + 1e-9; wall += 0.05) t = clock.tick(wall, sample(wall));
  return t;
}

describe("the warp's clock", () => {
  it("is the plain wall clock when there is no sound", () => {
    const clock = createWarpClock(false);
    expect(clock.withSound).toBe(false);
    expect(run(clock, 0, 4, () => null)).toBeCloseTo(4, 5);
  });

  it("follows a sound that runs from the click, to within the gentle correction", () => {
    const clock = createWarpClock(true);
    const t = run(clock, 0, 5, (wall) => ({ running: true, heard: wall }));
    expect(t).toBeCloseTo(5, 1);
  });

  it("holds the first frame while the audio output is not running, then starts at the sound's position (offset 0)", () => {
    const clock = createWarpClock(true);
    // The output wakes up 2 s after the click: the picture must not have run ahead on the wall clock.
    const during = run(clock, 0, 1.95, () => ({ running: false, heard: 0 }));
    expect(during).toBe(0);
    expect(clock.withSound).toBe(true);
    // The sound is now playing from its start: heard counts from 0 at wall = 2.
    const t = run(clock, 2, 6, (wall) => ({ running: true, heard: wall - 2 }));
    expect(t).toBeCloseTo(4, 1);
    // The picture is the sound's time, not the wall clock's (6 s): no offset of seconds.
    expect(Math.abs(t - 4)).toBeLessThan(0.1);
  });

  it("holds until the sound is audible after the output latency, then starts exactly with it", () => {
    const clock = createWarpClock(true);
    const latency = 0.3;
    // Running, but nothing audible for the first 0.3 s.
    const held = run(clock, 0, 0.25, (wall) => ({ running: true, heard: wall - latency }));
    expect(held).toBe(0);
    const t = run(clock, 0.3, 3, (wall) => ({ running: true, heard: wall - latency }));
    expect(t).toBeCloseTo(2.7, 1);
  });

  it("gives a sound that never starts up after the hold limit: silent from then on, on the wall clock", () => {
    const clock = createWarpClock(true);
    const held = run(clock, 0, MAX_HOLD_S - 0.1, () => ({ running: false, heard: 0 }));
    expect(held).toBe(0);
    expect(clock.gaveUp).toBe(false);
    run(clock, MAX_HOLD_S - 0.05, MAX_HOLD_S + 0.05, () => ({ running: false, heard: 0 }));
    expect(clock.gaveUp).toBe(true);
    expect(clock.withSound).toBe(false);
    // From the moment it was given up the picture runs on, silent, from where it stood (nothing skipped).
    const before = clock.tick(MAX_HOLD_S + 0.1, null);
    const after = clock.tick(MAX_HOLD_S + 2.1, null);
    expect(after - before).toBeCloseTo(2, 5);
    expect(before).toBeLessThan(0.3);
  });

  it("steers a small drift gently: never faster or slower than the slew allows", () => {
    const clock = createWarpClock(true);
    run(clock, 0, 1, (wall) => ({ running: true, heard: wall }));
    // The sound slips 0.2 s behind: below the snap error, so it is eased in, not jumped.
    let prev = clock.tick(1.05, { running: true, heard: 0.85 });
    for (let wall = 1.1; wall <= 3; wall += 0.05) {
      const t = clock.tick(wall, { running: true, heard: wall - 0.2 });
      const speed = (t - prev) / 0.05;
      expect(speed).toBeGreaterThanOrEqual(1 - MAX_SLEW - 1e-6);
      expect(speed).toBeLessThanOrEqual(1 + MAX_SLEW + 1e-6);
      prev = t;
    }
    expect(prev).toBeCloseTo(2.8, 1);
  });

  it("makes the picture wait for a sound that is far behind, and never runs backwards", () => {
    const clock = createWarpClock(true);
    run(clock, 0, 2, (wall) => ({ running: true, heard: wall }));
    const at = clock.tick(2.05, { running: true, heard: 2.05 });
    // The sound stutters 1 s behind: the picture stands still until the sound is back near it.
    const stood = clock.tick(2.1, { running: true, heard: 1.1 });
    expect(stood).toBeGreaterThanOrEqual(at);
    expect(stood - at).toBeLessThan(0.06);
    const later = clock.tick(2.6, { running: true, heard: 1.6 });
    expect(later).toBeCloseTo(stood, 5);
    const resumed = clock.tick(3.7, { running: true, heard: 3.65 });
    expect(resumed).toBeGreaterThan(later);
  });

  it("moves the picture on at once when the sound is far ahead", () => {
    const clock = createWarpClock(true);
    run(clock, 0, 1, (wall) => ({ running: true, heard: wall }));
    const t = clock.tick(1.05, { running: true, heard: 1.05 + SNAP_ERROR_S + 0.5 });
    expect(t).toBeCloseTo(1.05 + SNAP_ERROR_S + 0.5, 5);
  });

  it("stands still while the output is suspended mid-warp and goes on together with it", () => {
    const clock = createWarpClock(true);
    run(clock, 0, 2, (wall) => ({ running: true, heard: wall }));
    const frozen = run(clock, 2.05, 3, () => ({ running: false, heard: 2 }));
    expect(frozen).toBeCloseTo(2, 1);
    const t = run(clock, 3.05, 4, (wall) => ({ running: true, heard: wall - 1 }));
    expect(t).toBeCloseTo(3, 1);
  });

  it("goes on silent on the wall clock once the sound is stopped (a skip)", () => {
    const clock = createWarpClock(true);
    run(clock, 0, 2, (wall) => ({ running: true, heard: wall }));
    const a = clock.tick(2.05, null);
    const b = clock.tick(3.05, null);
    expect(b - a).toBeCloseTo(1, 5);
  });

  it("never decreases whatever the audio does", () => {
    const clock = createWarpClock(true);
    let prev = 0;
    for (let wall = 0; wall < 8; wall += 0.05) {
      const jitter = Math.sin(wall * 3) * 0.2;
      const t = clock.tick(wall, { running: wall > 0.4, heard: wall - 0.4 + jitter });
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });
});
