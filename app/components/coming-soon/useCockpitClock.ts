"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AUDIO_PRE_ROLL, CUES, LOOP_SECONDS, type Cue, type CueType } from "./cockpit-timeline";

/*
 * One clock for the whole cockpit: the position (phase, seconds) inside the audio loop.
 * While the loop is audible the phase is read from the AudioContext clock, so every
 * visual cue lands on its sound; without audio (muted, not yet allowed, reduced motion)
 * the same timeline runs on performance.now(), so the picture is identical either way.
 * Switching between the two never jumps: audio is always (re)started at the current
 * visual phase.
 */

const SOUND_SOURCES = ["/sounds/cockpit-loop.m4a", "/sounds/cockpit-loop.mp3"];
const SOUND_PREF_KEY = "cockpit-sound";
const VOLUME = 0.5;

type FrameCallback = (phase: number) => void;

export type CockpitClock = {
  phase: () => number;
  onFrame: (cb: FrameCallback) => () => void;
};

const wrap = (t: number) => ((t % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;

function readSoundPref(): boolean {
  try {
    return window.localStorage.getItem(SOUND_PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function useCockpitClock({ running, initialPhase = 0 }: { running: boolean; initialPhase?: number }) {
  const [soundOn, setSoundOnState] = useState(true);
  const [audible, setAudible] = useState(false);

  const subs = useRef(new Set<FrameCallback>());
  const perf = useRef({ base: initialPhase, start: 0, ticking: false });
  const audio = useRef<{
    ctx: AudioContext | null;
    buffer: AudioBuffer | null;
    source: AudioBufferSourceNode | null;
    gain: GainNode | null;
    start: number;
  }>({ ctx: null, buffer: null, source: null, gain: null, start: 0 });

  const phase = useCallback(() => {
    const a = audio.current;
    if (a.source && a.ctx && a.ctx.state === "running") {
      const latency = (a.ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
      return wrap(a.ctx.currentTime - a.start - latency);
    }
    const p = perf.current;
    return wrap(p.ticking ? p.base + (performance.now() - p.start) / 1000 : p.base);
  }, []);

  // eslint-disable-next-line react-hooks/refs -- intentional render-time ref sync for the cockpit clock/audio timeline; an effect would desync picture and sound (CLAUDE.md coming-soon entry)
  const clock = useRef<CockpitClock>({
    phase,
    onFrame: (cb) => {
      subs.current.add(cb);
      return () => {
        subs.current.delete(cb);
      };
    },
  }).current;

  useEffect(() => {
    setSoundOnState(readSoundPref());
  }, []);

  const setSoundOn = useCallback((on: boolean) => {
    setSoundOnState(on);
    try {
      window.localStorage.setItem(SOUND_PREF_KEY, on ? "on" : "off");
    } catch {
      /* preference just won't persist */
    }
  }, []);

  // Perf clock: runs while the cockpit runs, freezes (keeping its phase) otherwise.
  useEffect(() => {
    const p = perf.current;
    if (running) {
      p.start = performance.now();
      p.ticking = true;
    } else {
      p.base = phase();
      p.ticking = false;
    }
  }, [running, phase]);

  // Frame loop.
  useEffect(() => {
    if (!running) {
      const now = phase();
      subs.current.forEach((cb) => cb(now));
      return;
    }
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = phase();
      subs.current.forEach((cb) => cb(now));
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, phase]);

  // Audio: plays only while running and not muted; always joins at the current phase.
  useEffect(() => {
    if (!running || !soundOn) return;
    let cancelled = false;
    const a = audio.current;

    const stopSource = () => {
      if (!a.source || !a.ctx || !a.gain) return;
      const src = a.source;
      const at = phase();
      a.source = null;
      const perfClock = perf.current;
      perfClock.base = at;
      perfClock.start = performance.now();
      perfClock.ticking = true;
      const now = a.ctx.currentTime;
      a.gain.gain.cancelScheduledValues(now);
      a.gain.gain.setValueAtTime(a.gain.gain.value, now);
      a.gain.gain.linearRampToValueAtTime(0, now + 0.25);
      try {
        src.stop(now + 0.3);
      } catch {
        /* already stopped */
      }
      setAudible(false);
    };

    const startSource = () => {
      if (cancelled || !a.ctx || !a.buffer || a.source || a.ctx.state !== "running") return;
      const at = phase();
      const src = a.ctx.createBufferSource();
      src.buffer = a.buffer;
      src.loop = true;
      src.loopStart = AUDIO_PRE_ROLL;
      src.loopEnd = AUDIO_PRE_ROLL + LOOP_SECONDS;
      if (!a.gain) {
        a.gain = a.ctx.createGain();
        a.gain.connect(a.ctx.destination);
      }
      const now = a.ctx.currentTime;
      a.gain.gain.cancelScheduledValues(now);
      a.gain.gain.setValueAtTime(0, now);
      a.gain.gain.linearRampToValueAtTime(VOLUME, now + 1.2);
      src.connect(a.gain);
      src.start(now, AUDIO_PRE_ROLL + at);
      const latency = (a.ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
      a.start = now - at - latency;
      a.source = src;
      setAudible(true);
    };

    const tryResume = () => {
      if (!a.ctx) return;
      if (a.ctx.state === "running") startSource();
      else a.ctx.resume().then(startSource).catch(() => undefined);
    };

    const onGesture = () => tryResume();
    window.addEventListener("pointerdown", onGesture, true);
    window.addEventListener("keydown", onGesture, true);

    (async () => {
      try {
        if (!a.ctx) {
          const Ctx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!Ctx) return;
          a.ctx = new Ctx();
        }
        if (!a.buffer) {
          for (const src of SOUND_SOURCES) {
            try {
              const res = await fetch(src);
              if (!res.ok) continue;
              a.buffer = await a.ctx.decodeAudioData(await res.arrayBuffer());
              break;
            } catch {
              /* try the next format */
            }
          }
        }
        if (!cancelled) tryResume();
      } catch {
        /* no audio: the visual timeline keeps running on the perf clock */
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
      stopSource();
    };
  }, [running, soundOn, phase]);

  // Release the audio device when the cockpit goes away.
  useEffect(() => {
    const a = audio.current;
    return () => {
      a.ctx?.close().catch(() => undefined);
      a.ctx = null;
      a.gain = null;
    };
  }, []);

  // eslint-disable-next-line react-hooks/refs -- intentional render-time ref sync for the cockpit clock/audio timeline; an effect would desync picture and sound (CLAUDE.md coming-soon entry)
  return { clock, soundOn, setSoundOn, audible };
}

/* ---------- cue helpers ---------- */

const BY_TYPE = CUES.reduce<Record<string, Cue[]>>((acc, cue) => {
  (acc[cue.type] ??= []).push(cue);
  return acc;
}, {});

export const cuesOf = (type: CueType): Cue[] => BY_TYPE[type] ?? [];

/** Index of the last cue of this type that has started at `phase` (−1 if none yet this loop). */
export function lastIndex(type: CueType, phase: number): number {
  const list = cuesOf(type);
  let i = -1;
  while (i + 1 < list.length && list[i + 1].t <= phase) i++;
  return i;
}

/** Progress 0..1 of the cue of this type that is playing at `phase`, or −1. */
export function activeProgress(type: CueType, phase: number): number {
  for (const cue of cuesOf(type)) {
    if (phase >= cue.t && phase < cue.t + cue.dur) return (phase - cue.t) / cue.dur;
  }
  return -1;
}

/** Seconds since the most recent cue of this type started (Infinity if none this loop). */
export function sinceLast(type: CueType, phase: number): number {
  const i = lastIndex(type, phase);
  return i < 0 ? Infinity : phase - cuesOf(type)[i].t;
}

/** React state derived from the clock, updated only when the derived value changes. */
export function useClockValue<T>(clock: CockpitClock, derive: (phase: number) => T): T {
  const deriveRef = useRef(derive);
  // eslint-disable-next-line react-hooks/refs -- intentional render-time ref sync for the cockpit clock/audio timeline; an effect would desync picture and sound (CLAUDE.md coming-soon entry)
  deriveRef.current = derive;
  const [value, setValue] = useState<T>(() => derive(clock.phase()));
  useEffect(
    () =>
      clock.onFrame((p) => {
        const next = deriveRef.current(p);
        setValue((prev) => (Object.is(prev, next) ? prev : next));
      }),
    [clock],
  );
  return value;
}
