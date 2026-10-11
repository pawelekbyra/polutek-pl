/**
 * The entry sound (public/sounds/gate-enter-12s.mp3) through Web Audio, so the warp animation can run
 * on the audio clock and stay in sync with it.
 *
 * - Loaded and DECODED while the gate is still loading (the gate waits for it, see PageRevealGate),
 *   with an OfflineAudioContext: no live AudioContext exists before the click, so browsers neither
 *   warn about it nor hold an audio session for a page that may never be entered.
 * - The live AudioContext is created on the PRESS that precedes the click (`primeGateSound`, a
 *   pointerdown/keydown on the gate: creating it costs tens of milliseconds, which would otherwise
 *   be a stutter in the warp's first frames) and started INSIDE the click (a user gesture: iOS and
 *   Chrome let it run at once). Without a press (a programmatic click) it is created in the click.
 * - The picture never waits for the sound: it starts on the wall clock at the click and is steered
 *   gently (±15 % speed) onto the audio clock, so it is in sync within a second or two without a
 *   frozen or jumping frame. Any failure means a silent warp on the wall clock.
 */

/**
 * The file name carries the sound's length on purpose: the file is cached for hours (and a browser
 * keeps a copy far longer), and the animation timeline is cut to this exact sound. A new version of
 * the sound gets a NEW name, never the old one overwritten (an overwritten file was served to returning
 * visitors as the old, shorter sound while the picture ran the new timeline: the sound stopped halfway).
 */
export const GATE_SOUND_URL = "/sounds/gate-enter-12s.mp3";

type AudioContextCtor = typeof AudioContext;
type OfflineCtor = typeof OfflineAudioContext;

let buffer: AudioBuffer | null = null;
let loading: Promise<boolean> | null = null;
let primed: AudioContext | null = null;

function ctors(): { live: AudioContextCtor | null; offline: OfflineCtor | null } {
  if (typeof window === "undefined") return { live: null, offline: null };
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
    OfflineAudioContext?: OfflineCtor;
    webkitOfflineAudioContext?: OfflineCtor;
  };
  return { live: w.AudioContext ?? w.webkitAudioContext ?? null, offline: w.OfflineAudioContext ?? w.webkitOfflineAudioContext ?? null };
}

/** Fetches and decodes the sound once. Resolves true when it is ready to play. */
export function preloadGateSound(): Promise<boolean> {
  if (loading) return loading;
  const { live, offline } = ctors();
  if (!live || !offline) return (loading = Promise.resolve(false));
  loading = (async () => {
    try {
      const response = await fetch(GATE_SOUND_URL);
      if (!response.ok) return false;
      const data = await response.arrayBuffer();
      const decoder = new offline(2, 1, 44100);
      buffer = await new Promise<AudioBuffer>((resolve, reject) => decoder.decodeAudioData(data, resolve, reject));
      return true;
    } catch {
      buffer = null;
      return false;
    }
  })();
  return loading;
}

/** Creates the live AudioContext ahead of the click (call on the press). Idempotent, never throws. */
export function primeGateSound(): void {
  if (primed || !buffer) return;
  const { live } = ctors();
  if (!live) return;
  try {
    primed = new live({ latencyHint: "interactive" });
  } catch {
    try {
      // Older Safari (webkitAudioContext) takes no options.
      primed = new live();
    } catch {
      primed = null;
    }
  }
  // A mouse press already counts as a user gesture: the audio output wakes up now, so at the click
  // the sound starts at once instead of after the output's start-up. (A touch press does not count;
  // then this is a no-op and the click wakes it.)
  void primed?.resume().catch(() => undefined);
}

/** True once the sound is decoded (the click can start it at once). */
export function isGateSoundReady(): boolean {
  return buffer !== null;
}

export type GateClock = {
  /** Seconds since the warp started, steered onto the audio clock when there is sound. */
  now: () => number;
  /** Fades the sound out (skip, unmount) and releases the audio device. */
  stop: (fadeSeconds?: number) => void;
  withSound: boolean;
};

/** Largest correction of the picture's speed while it is steered onto the audio clock. */
const MAX_SLEW = 0.15;

/**
 * Starts the sound (call synchronously from the click handler) and returns the clock the animation
 * follows. Without a decoded sound (or Web Audio) the clock is the wall clock from the click.
 */
export function startGateSound(): GateClock {
  const t0 = performance.now();
  const wallSeconds = () => (performance.now() - t0) / 1000;
  const silent: GateClock = { now: wallSeconds, stop: () => undefined, withSound: false };
  const { live } = ctors();
  if (!live || !buffer) return silent;
  // iOS: Web Audio follows the ring/silent switch unless the page asks for playback audio (Safari 17+);
  // the hero video plays through the switch anyway, so the entry sound should too.
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
  } catch {
    /* not supported */
  }
  primeGateSound();
  const ctx = primed;
  primed = null;
  if (!ctx) return silent;
  try {
    void ctx.resume();
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.connect(gain).connect(ctx.destination);
    const startAt = ctx.currentTime;
    source.start(startAt);
    const latency = () => (ctx as AudioContext & { outputLatency?: number }).outputLatency || ctx.baseLatency || 0;

    let offset = 0;
    let lastWall = 0;
    let last = 0;
    let stopped = false;
    return {
      withSound: true,
      now: () => {
        const wall = wallSeconds();
        const dt = Math.max(0, wall - lastWall);
        lastWall = wall;
        if (ctx.state === "running") {
          // Where the sound is, as heard (minus the output latency); the picture's offset drifts
          // towards it by at most MAX_SLEW seconds per second, so it never stops or jumps.
          const heard = ctx.currentTime - startAt - latency();
          const want = heard - wall;
          const step = MAX_SLEW * dt;
          offset += Math.max(-step, Math.min(step, want - offset));
        }
        last = Math.max(last, wall + offset);
        return last;
      },
      stop: (fadeSeconds = 0.25) => {
        if (stopped) return;
        stopped = true;
        try {
          const now = ctx.currentTime;
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
          source.stop(now + fadeSeconds + 0.05);
        } catch {
          /* already stopped */
        }
        // Give the audio device back once the fade is over.
        window.setTimeout(() => void ctx.close().catch(() => undefined), (fadeSeconds + 0.2) * 1000);
      },
    };
  } catch {
    void ctx.close().catch(() => undefined);
    return silent;
  }
}

/** Drops the decoded sound (a few MB) once the entry is over; the gate does not come back in this tab. */
export function releaseGateSound(): void {
  buffer = null;
}

/** @internal tests */
export function resetGateSoundForTests() {
  buffer = null;
  loading = null;
  primed = null;
}
