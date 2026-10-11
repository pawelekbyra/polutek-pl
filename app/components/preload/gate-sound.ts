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
 * - The click is not possible before the sound is decoded (PageRevealGate keeps the loading bar up,
 *   for the sound far longer than for the page; a sound that cannot load means the plain fade, never
 *   a half-silent animation). Still, the audio output may start late (the device waking up, a
 *   suspended context, a busy machine): the picture's time is therefore DERIVED FROM THE SOUND
 *   (gate-clock.ts). It holds on its first frame until the output is really running and the sound
 *   audible, then follows the wall clock steered gently (+-15 % speed) onto the sound's position; a
 *   sound that does not get going within a few seconds is silenced and the picture goes on silent,
 *   so sound and picture never begin seconds apart.
 * - A tab hidden mid-warp pauses both: the audio context is suspended and the picture's clock stops
 *   counting, and both go on together when the tab is back. (iOS suspends a hidden page's audio by
 *   itself while the wall clock ran on: sound and picture came back apart; elsewhere the intro played
 *   on unseen.)
 */

/**
 * The file name carries the sound's length on purpose: the file is cached for hours (and a browser
 * keeps a copy far longer), and the animation timeline is cut to this exact sound. A new version of
 * the sound gets a NEW name, never the old one overwritten (an overwritten file was served to returning
 * visitors as the old, shorter sound while the picture ran the new timeline: the sound stopped halfway).
 */
export const GATE_SOUND_URL = "/sounds/gate-enter-12s.mp3";

import { createWarpClock, type AudioSample } from "./gate-clock";

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
  /** Seconds since the warp started (not counting time the tab was hidden), derived from the audio clock when there is sound. */
  now: () => number;
  /** Fades the sound out (skip, unmount) and releases the audio device. */
  stop: (fadeSeconds?: number) => void;
  /** The warp is over: no more listening for the tab being hidden. */
  dispose: () => void;
  /** A sound is steering the picture (false: none was started, or it was given up and silenced). */
  readonly withSound: boolean;
};

/**
 * A wall clock in seconds from now that stops while the tab is hidden; `onHidden(hidden)` is told
 * about each change (the sound follows it).
 */
function pausableWallClock(onHidden?: (hidden: boolean) => void) {
  const t0 = performance.now();
  let pausedMs = 0;
  let hiddenSince: number | null = typeof document !== "undefined" && document.visibilityState === "hidden" ? t0 : null;
  const listener = () => {
    const hidden = document.visibilityState === "hidden";
    const now = performance.now();
    if (hidden && hiddenSince === null) hiddenSince = now;
    else if (!hidden && hiddenSince !== null) {
      pausedMs += now - hiddenSince;
      hiddenSince = null;
    } else return;
    onHidden?.(hidden);
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", listener);
  return {
    seconds: () => {
      const now = performance.now();
      return (now - t0 - pausedMs - (hiddenSince === null ? 0 : now - hiddenSince)) / 1000;
    },
    dispose: () => {
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", listener);
    },
  };
}

/**
 * Starts the sound (call synchronously from the click handler) and returns the clock the animation
 * follows. Without a decoded sound (or Web Audio) the clock is the silent wall clock from the click
 * and `withSound` is false (the caller then takes the plain fade instead of the warp).
 */
export function startGateSound(): GateClock {
  let audio: AudioContext | null = null;
  let audioStopped = false;
  const wall = pausableWallClock((hidden) => {
    if (!audio || audioStopped) return;
    void (hidden ? audio.suspend() : audio.resume()).catch(() => undefined);
  });
  const wallSeconds = wall.seconds;
  const silentClock = createWarpClock(false);
  const silent: GateClock = {
    now: () => silentClock.tick(wallSeconds(), null),
    stop: () => undefined,
    dispose: wall.dispose,
    withSound: false,
  };
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
  audio = ctx;
  try {
    void ctx.resume();
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.connect(gain).connect(ctx.destination);
    // A context that is still suspended reports 0 and starts counting only when its output runs: the
    // sound is then scheduled at 0 and begins the moment the output wakes up, however late that is.
    const startAt = ctx.currentTime;
    source.start(startAt);
    const latency = () => (ctx as AudioContext & { outputLatency?: number }).outputLatency || ctx.baseLatency || 0;

    const core = createWarpClock(true);
    let stopped = false;
    const stop = (fadeSeconds = 0.25) => {
      if (stopped) return;
      stopped = true;
      audioStopped = true;
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
    };
    const sample = (): AudioSample | null => {
      if (stopped) return null;
      const time = ctx.currentTime;
      // `running` also needs the output's clock to have advanced: a context can report "running" a
      // moment before it renders anything.
      return { running: ctx.state === "running" && time > startAt, heard: time - startAt - latency() };
    };
    return {
      get withSound() {
        return core.withSound;
      },
      dispose: wall.dispose,
      now: () => {
        const t = core.tick(wallSeconds(), sample());
        // The sound did not get going: silence it for good, so it cannot begin late and apart.
        if (core.gaveUp) stop(0.05);
        return t;
      },
      stop,
    };
  } catch {
    audioStopped = true;
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
