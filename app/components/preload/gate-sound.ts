/**
 * The entry sound (public/sounds/gate-enter-12s.mp3) through Web Audio, so the warp animation can run on
 * the audio clock and stay in sync with it. Loaded while the viewer looks at the rabbit (after the
 * page is ready, so it never competes with the video for the first bytes), started inside the click
 * that enters (browsers allow sound only from a gesture). Any failure means a silent warp.
 */

/**
 * The file name carries the sound's length on purpose: the file is cached for hours (and a browser
 * keeps a copy far longer), and the animation timeline is cut to this exact sound. A new version of
 * the sound gets a NEW name, never the old one overwritten (an overwritten file was served to returning
 * visitors as the old, shorter sound while the picture ran the new timeline: the sound stopped halfway).
 */
export const GATE_SOUND_URL = "/sounds/gate-enter-12s.mp3";

type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let loading: Promise<void> | null = null;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Fetches and decodes the sound once (no-op when Web Audio is missing). */
export function preloadGateSound(): Promise<void> {
  if (loading) return loading;
  const Ctor = audioContextCtor();
  if (!Ctor) return (loading = Promise.resolve());
  loading = (async () => {
    try {
      // Created suspended (no gesture yet); resumed by the click.
      context = context ?? new Ctor();
      const response = await fetch(GATE_SOUND_URL);
      if (!response.ok) return;
      const data = await response.arrayBuffer();
      buffer = await new Promise<AudioBuffer>((resolve, reject) => context!.decodeAudioData(data, resolve, reject));
    } catch {
      buffer = null;
    }
  })();
  return loading;
}

export type GateClock = {
  /** Seconds since the warp started, as heard (output latency compensated when known). */
  now: () => number;
  /** Fades the sound out quickly (skip) and releases it. */
  stop: (fadeSeconds?: number) => void;
  withSound: boolean;
};

/**
 * Starts the sound (call synchronously from the click handler) and returns the clock the animation
 * follows. Without a decoded sound the clock is `performance.now()`.
 */
export function startGateSound(): GateClock {
  const t0 = performance.now();
  const fallback: GateClock = { now: () => (performance.now() - t0) / 1000, stop: () => undefined, withSound: false };
  const ctx = context;
  if (!ctx || !buffer) return fallback;
  try {
    void ctx.resume();
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.connect(gain).connect(ctx.destination);
    const startAt = ctx.currentTime + 0.02;
    source.start(startAt);
    const latency = (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? ctx.baseLatency ?? 0;
    let stopped = false;
    let last = 0;
    return {
      withSound: true,
      // In sync with what is heard once the context runs. A context still waking up (resume()
      // pending) reports a frozen time: the picture waits for it up to 350 ms, then follows the wall
      // clock; if the sound starts later, the picture holds until the sound catches up. Never runs
      // backwards.
      now: () => {
        let value: number;
        if (ctx.state === "running") {
          value = ctx.currentTime - startAt - latency;
        } else {
          const wall = (performance.now() - t0) / 1000;
          value = wall < 0.35 ? 0 : wall - 0.35;
        }
        last = Math.max(last, value);
        return last;
      },
      stop: (fadeSeconds = 0.25) => {
        if (stopped) return;
        stopped = true;
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
        try {
          source.stop(now + fadeSeconds + 0.05);
        } catch {
          /* already stopped */
        }
      },
    };
  } catch {
    return fallback;
  }
}

/** @internal tests */
export function resetGateSoundForTests() {
  context = null;
  buffer = null;
  loading = null;
}
