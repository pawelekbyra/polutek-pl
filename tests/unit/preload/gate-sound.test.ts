/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isGateSoundReady,
  preloadGateSound,
  primeGateSound,
  resetGateSoundForTests,
  startGateSound,
} from "@/app/components/preload/gate-sound";

let visibility: DocumentVisibilityState = "visible";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  visibility = "visible";
  resetGateSoundForTests();
  const w = window as unknown as Record<string, unknown>;
  delete w.AudioContext;
  delete w.OfflineAudioContext;
});

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("the warp's clock", () => {
  it("stops counting while the tab is hidden, so sound and picture go on together when it is back", () => {
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const clock = startGateSound();
    expect(clock.withSound).toBe(false); // jsdom: no Web Audio, the silent wall clock
    now += 2000;
    expect(clock.now()).toBeCloseTo(2, 5);
    setVisibility("hidden");
    now += 30000;
    expect(clock.now()).toBeCloseTo(2, 5);
    setVisibility("visible");
    now += 500;
    expect(clock.now()).toBeCloseTo(2.5, 5);
    clock.dispose();
    // Disposed: no longer follows the tab.
    setVisibility("hidden");
    now += 1000;
    expect(clock.now()).toBeCloseTo(3.5, 5);
  });
});

/** A Web Audio stand-in whose output state and clock the test drives by hand. */
class FakeAudioContext {
  static last: FakeAudioContext | null = null;
  state: "suspended" | "running" | "closed" = "suspended";
  currentTime = 0;
  baseLatency = 0;
  outputLatency = 0;
  destination = {};
  source = { buffer: null as unknown, connect: (node: unknown) => node, start: vi.fn(), stop: vi.fn() };
  resume = vi.fn(() => Promise.resolve());
  suspend = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());
  constructor() {
    FakeAudioContext.last = this;
  }
  createBufferSource() {
    return this.source;
  }
  createGain() {
    return { gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: (node: unknown) => node };
  }
}

class FakeOfflineAudioContext {
  decodeAudioData(_data: ArrayBuffer, ok: (buffer: unknown) => void) {
    ok({ duration: 12.3 });
  }
}

function installWebAudio() {
  const w = window as unknown as Record<string, unknown>;
  w.AudioContext = FakeAudioContext;
  w.OfflineAudioContext = FakeOfflineAudioContext;
  FakeAudioContext.last = null;
}

describe("the entry sound and the warp's clock together", () => {
  it("is not ready before the sound is decoded, and a failed fetch means no sound at all", async () => {
    installWebAudio();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    expect(isGateSoundReady()).toBe(false);
    expect(await preloadGateSound()).toBe(false);
    expect(isGateSoundReady()).toBe(false);
    expect(startGateSound().withSound).toBe(false);
  });

  it("starts the picture from the moment the audio really starts: no offset when the output wakes up late", async () => {
    installWebAudio();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    expect(await preloadGateSound()).toBe(true);
    expect(isGateSoundReady()).toBe(true);
    primeGateSound();
    const ctx = FakeAudioContext.last!;
    const clock = startGateSound();
    expect(clock.withSound).toBe(true);
    expect(ctx.source.start).toHaveBeenCalledTimes(1);

    // A lagging machine: the output is still suspended 1.5 s after the click. The picture holds its
    // first frame instead of running ahead on the wall clock.
    for (let i = 0; i < 30; i++) {
      now += 50;
      expect(clock.now()).toBe(0);
    }
    // The output wakes up: the sound is at 20 ms, the picture starts there, not at 1.5 s.
    ctx.state = "running";
    ctx.currentTime = 0.02;
    now += 16;
    expect(clock.now()).toBeCloseTo(0.02, 2);
    // One second later both are one second further, in step.
    now += 1000;
    ctx.currentTime = 1.02;
    expect(clock.now()).toBeCloseTo(1.02, 1);
    expect(clock.withSound).toBe(true);
    clock.dispose();
  });

  it("silences a sound that never gets going, so it cannot begin late and apart", async () => {
    installWebAudio();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    await preloadGateSound();
    const clock = startGateSound();
    const ctx = FakeAudioContext.last!;
    for (let i = 0; i < 70; i++) {
      now += 50;
      clock.now();
    }
    expect(clock.withSound).toBe(false);
    expect(ctx.source.stop).toHaveBeenCalled();
    // The picture goes on, silent, from where it stood.
    const a = clock.now();
    now += 1000;
    expect(clock.now() - a).toBeCloseTo(1, 5);
    clock.dispose();
  });
});
