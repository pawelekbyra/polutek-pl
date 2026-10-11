/**
 * The entry warp's clock as a pure state machine (no DOM, no Web Audio objects): unit tested, used by
 * gate-sound.ts, which feeds it the wall clock and what the audio output is doing.
 *
 * The rule (owner report 2026-10-11: on a lagging computer the sound began late and apart from the
 * picture): the picture's time is DERIVED FROM THE SOUND. It does not run ahead on the wall clock
 * while the sound has not started:
 * - before the audio output is running and the first sample is audible, the picture holds on its first
 *   frame (time 0);
 * - from then on the picture's time is the wall clock (smooth, a frame per frame) steered onto the
 *   sound's position by at most {@link MAX_SLEW} of its speed, so a small drift never shows as a stop
 *   or a jump;
 * - a larger error is corrected at once: a sound that is behind makes the picture wait for it (never
 *   the other way round: time does not run backwards), a sound that is ahead moves the picture on;
 * - if the sound does not get going (or stops getting on) for {@link MAX_HOLD_S}, it is given up: the
 *   caller silences it (so it can never begin late and apart) and the picture goes on, silent, on the
 *   wall clock from that moment.
 */

/** Largest correction of the picture's speed while it is steered onto the sound (a share of 1). */
export const MAX_SLEW = 0.15;
/** An error (seconds) beyond which the picture is not steered gently but held or moved on at once. */
export const SNAP_ERROR_S = 0.35;
/** How long (seconds on the pausable wall clock) the picture waits for a sound that does not run. */
export const MAX_HOLD_S = 3;

/** What the audio output is doing now. */
export type AudioSample = {
  /** The output is rendering (the context runs and its clock has advanced since the sound was scheduled). */
  running: boolean;
  /** Seconds of the sound that have been heard so far (the output latency taken off); negative before it is audible. */
  heard: number;
};

export type WarpClock = {
  /**
   * The picture's time in seconds for the wall clock `wall` (seconds since the warp began, not counting
   * a hidden tab). `sample` is null when there is no sound (never was, was stopped or given up).
   * Never decreases.
   */
  tick: (wall: number, sample: AudioSample | null) => number;
  /** The sound was waited for in vain: the caller must silence it. */
  readonly gaveUp: boolean;
  /** The picture is steered by a sound (false: silent from the start, or given up). */
  readonly withSound: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function createWarpClock(withSound: boolean): WarpClock {
  let sound = withSound;
  let gaveUp = false;
  let started = !withSound;
  let t = 0;
  let lastWall = 0;
  let waited = 0;

  return {
    get gaveUp() {
      return gaveUp;
    },
    get withSound() {
      return sound;
    },
    tick(wall, sample) {
      const dt = Math.max(0, wall - lastWall);
      lastWall = Math.max(lastWall, wall);
      if (!sound || sample === null) {
        // Silent: the plain wall clock (also after the sound was stopped by a skip).
        t += dt;
        return t;
      }
      // Waiting for the sound: not running yet (or no longer), or running but not yet audible.
      const audible = sample.running && (started || sample.heard >= 0);
      if (!audible) {
        waited += dt;
        if (waited >= MAX_HOLD_S) {
          sound = false;
          gaveUp = true;
          t += dt;
        }
        return t;
      }
      waited = 0;
      if (!started) {
        // The sound has just become audible: the picture starts exactly here, at the sound's position.
        started = true;
        t = Math.max(t, sample.heard);
        return t;
      }
      const err = sample.heard - (t + dt);
      if (err > SNAP_ERROR_S) {
        t = sample.heard;
      } else if (err >= -SNAP_ERROR_S) {
        t += dt + clamp(err, -MAX_SLEW * dt, MAX_SLEW * dt);
      }
      // else the sound is far behind: the picture waits for it (time stands still).
      return t;
    },
  };
}
