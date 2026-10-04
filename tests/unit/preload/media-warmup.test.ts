/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MEDIA_WARMUP_DWELL_MS,
  MEDIA_WARMUP_MAX_ACTIVE,
  MEDIA_WARMUP_TIMEOUT_MS,
  MediaWarmup,
  capLevelForPlayerSize,
  mediaWarmupAllowed,
  type ConnectionLike,
} from "@/app/components/preload/media-warmup";

const EVENTS = { MANIFEST_PARSED: "manifestParsed", FRAG_LOADED: "fragLoaded", ERROR: "error" };

type FakeHls = {
  config: Record<string, unknown>;
  listeners: Map<string, (event: string, data: unknown) => void>;
  source?: string;
  media?: HTMLMediaElement;
  startedAt?: number;
  destroyed: boolean;
  levels: unknown[];
  autoLevelCapping: number;
  emit(event: string, data?: unknown): void;
};

function setup(options: { connection?: ConnectionLike; supported?: boolean; size?: { width: number; height: number } | null } = {}) {
  const instances: FakeHls[] = [];
  const getMaxLevelByMediaSize = vi.fn((_levels: unknown[], width: number) => (width >= 1000 ? 2 : 1));
  class Hls {
    static isSupported = () => options.supported ?? true;
    static Events = EVENTS;
    static DefaultConfig = {
      manifestLoadPolicy: { default: {} },
      playlistLoadPolicy: { default: {} },
      fragLoadPolicy: { default: {} },
      capLevelController: { getMaxLevelByMediaSize },
    };
    config: Record<string, unknown>;
    listeners = new Map<string, (event: string, data: unknown) => void>();
    source?: string;
    media?: HTMLMediaElement;
    startedAt?: number;
    destroyed = false;
    levels = [{}, {}, {}];
    autoLevelCapping = -1;
    constructor(config: Record<string, unknown>) {
      this.config = config;
      instances.push(this as unknown as FakeHls);
    }
    on(event: string, listener: (event: string, data: unknown) => void) { this.listeners.set(event, listener); }
    loadSource(url: string) { this.source = url; }
    attachMedia(media: HTMLMediaElement) { this.media = media; }
    startLoad(position: number) { this.startedAt = position; }
    destroy() { this.destroyed = true; }
    emit(event: string, data?: unknown) { this.listeners.get(event)?.(event, data); }
  }
  const warmup = new MediaWarmup({
    loadHls: async () => ({ default: Hls as never }),
    connection: () => options.connection,
    playerSize: () => (options.size === undefined ? { width: 640, height: 360 } : options.size),
    createMediaElement: () => document.createElement("video"),
  });
  return { warmup, instances, getMaxLevelByMediaSize };
}

const url = (id: string) => `https://video.example/h/9.sig/${id}/v1/master.m3u8`;

/** Runs the deferred hls.destroy() (fake timers give a 0 ms timer set inside a timer 1 ms). */
async function flush() {
  await vi.advanceTimersByTimeAsync(1);
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("media warm-up policy", () => {
  it("never warms on Data Saver or slow networks, and on touch only with a known fast connection", () => {
    expect(mediaWarmupAllowed("mouse", undefined)).toBe(true);
    expect(mediaWarmupAllowed("mouse", { saveData: true, effectiveType: "4g" })).toBe(false);
    expect(mediaWarmupAllowed("keyboard", { effectiveType: "3g" })).toBe(false);
    expect(mediaWarmupAllowed("touch", undefined)).toBe(false);
    expect(mediaWarmupAllowed("touch", { effectiveType: "3g" })).toBe(false);
    expect(mediaWarmupAllowed("touch", { effectiveType: "4g" })).toBe(true);
  });
});

describe("MediaWarmup", () => {
  it("after the dwell, loads the stream like the player and stops after the first media segment", async () => {
    const { warmup, instances } = setup();
    warmup.intend("a", "mouse");
    warmup.provide("a", url("a"));
    await flush();
    expect(instances).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(MEDIA_WARMUP_DWELL_MS);
    expect(instances).toHaveLength(1);
    const hls = instances[0];
    expect(hls.source).toBe(url("a"));
    expect(hls.media).toBeInstanceOf(HTMLVideoElement);
    expect(hls.media?.muted).toBe(true);
    expect(hls.config).toMatchObject({ autoStartLoad: false, capLevelToPlayerSize: false, enableWorker: false });

    hls.emit(EVENTS.MANIFEST_PARSED);
    expect(hls.startedAt).toBe(-1);

    hls.emit(EVENTS.FRAG_LOADED, { frag: { sn: "initSegment" } });
    await flush();
    expect(hls.destroyed).toBe(false);
    hls.emit(EVENTS.FRAG_LOADED, { frag: { sn: 1 } });
    await flush();
    expect(hls.destroyed).toBe(true);
    expect(warmup.activeCount()).toBe(0);

    // One warm-up per video: a second hover does nothing.
    warmup.intend("a", "mouse");
    warmup.provide("a", url("a"));
    await vi.advanceTimersByTimeAsync(MEDIA_WARMUP_DWELL_MS);
    expect(instances).toHaveLength(1);
  });

  it("caps the start rung to the player slot like the player's own cap controller", async () => {
    const { warmup, instances, getMaxLevelByMediaSize } = setup({ size: { width: 640, height: 360 } });
    Object.defineProperty(window, "devicePixelRatio", { value: 2, configurable: true });
    warmup.intend("a", "mouse");
    warmup.provide("a", url("a"));
    await vi.advanceTimersByTimeAsync(MEDIA_WARMUP_DWELL_MS);
    instances[0].emit(EVENTS.MANIFEST_PARSED);
    expect(getMaxLevelByMediaSize).toHaveBeenCalledWith(instances[0].levels, 1280, 720);
    expect(instances[0].autoLevelCapping).toBe(2);
  });

  it("warms nothing when the pointer leaves or the tile is picked before the dwell ends", async () => {
    const { warmup, instances } = setup();
    warmup.intend("a", "mouse");
    warmup.provide("a", url("a"));
    warmup.release("a");
    warmup.intend("b", "mouse");
    warmup.provide("b", url("b"));
    warmup.select("b");
    await vi.advanceTimersByTimeAsync(MEDIA_WARMUP_DWELL_MS * 2);
    expect(instances).toHaveLength(0);
  });

  it("warms nothing without a playable plan's URL", async () => {
    const { warmup, instances } = setup();
    warmup.intend("denied", "mouse");
    await vi.advanceTimersByTimeAsync(MEDIA_WARMUP_DWELL_MS * 2);
    expect(instances).toHaveLength(0);
  });

  it("respects the network policy and unsupported browsers", async () => {
    const saver = setup({ connection: { saveData: true } });
    saver.warmup.intend("a", "mouse");
    saver.warmup.provide("a", url("a"));
    await vi.advanceTimersByTimeAsync(MEDIA_WARMUP_DWELL_MS);
    expect(saver.instances).toHaveLength(0);

    const touchUnknown = setup({ connection: undefined });
    touchUnknown.warmup.intend("a", "touch");
    touchUnknown.warmup.provide("a", url("a"));
    await vi.advanceTimersByTimeAsync(MEDIA_WARMUP_DWELL_MS);
    expect(touchUnknown.instances).toHaveLength(0);

    const unsupported = setup({ supported: false });
    unsupported.warmup.intend("a", "mouse");
    unsupported.warmup.provide("a", url("a"));
    await vi.advanceTimersByTimeAsync(MEDIA_WARMUP_DWELL_MS);
    expect(unsupported.instances).toHaveLength(0);
  });

  it(`runs at most ${MEDIA_WARMUP_MAX_ACTIVE} at once and cancels the oldest`, async () => {
    const { warmup, instances } = setup();
    for (const id of ["a", "b", "c"]) {
      warmup.intend(id, "mouse");
      warmup.provide(id, url(id));
      await vi.advanceTimersByTimeAsync(MEDIA_WARMUP_DWELL_MS);
    }
    await flush();
    expect(instances.map((hls) => hls.destroyed)).toEqual([true, false, false]);
    expect(warmup.activeCount()).toBe(2);
  });

  it("on a pick, stops the other videos' warm-ups but lets the picked one finish", async () => {
    const { warmup, instances } = setup();
    for (const id of ["a", "b"]) {
      warmup.intend(id, "mouse");
      warmup.provide(id, url(id));
    }
    await vi.advanceTimersByTimeAsync(MEDIA_WARMUP_DWELL_MS);
    warmup.select("b");
    await flush();
    expect(instances.map((hls) => hls.destroyed)).toEqual([true, false]);
  });

  it("ends on an error or after the timeout", async () => {
    const { warmup, instances } = setup();
    warmup.intend("a", "mouse");
    warmup.provide("a", url("a"));
    warmup.intend("b", "mouse");
    warmup.provide("b", url("b"));
    await vi.advanceTimersByTimeAsync(MEDIA_WARMUP_DWELL_MS);
    instances[0].emit(EVENTS.ERROR, { fatal: false });
    await flush();
    expect(instances[0].destroyed).toBe(true);
    expect(instances[1].destroyed).toBe(false);
    await vi.advanceTimersByTimeAsync(MEDIA_WARMUP_TIMEOUT_MS);
    await flush();
    expect(instances[1].destroyed).toBe(true);
  });
});

describe("capLevelForPlayerSize", () => {
  it("means no cap without a known size or with a single rung", () => {
    const helper = vi.fn(() => 0);
    const Hls = { DefaultConfig: { capLevelController: { getMaxLevelByMediaSize: helper } } } as never;
    expect(capLevelForPlayerSize(Hls, [{}, {}], null, 1)).toBe(-1);
    expect(capLevelForPlayerSize(Hls, [{}], { width: 100, height: 50 }, 1)).toBe(-1);
    expect(helper).not.toHaveBeenCalled();
  });
});
