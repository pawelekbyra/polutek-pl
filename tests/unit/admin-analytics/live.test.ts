import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLiveHub, fillMinutes, getLiveSnapshot, LIVE_WINDOW_MINUTES, resolveLiveTarget } from "@/lib/modules/admin-analytics";
import { createLiveStream, KEEP_ALIVE_MS, MAX_LIFETIME_MS } from "@admin/lib/live-stream";
import { deps, fakeApp, fakeTelemetry, NOW, VIDEO_A } from "./fakes";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const decode = new TextDecoder();
async function readText(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const r = await reader.read();
  return r.done ? null : decode.decode(r.value);
}

describe("live hub", () => {
  it("polls once for all listeners, never overlaps, and stops with the last listener", async () => {
    let polls = 0;
    const hub = createLiveHub({ poll: async () => ++polls, intervalMs: 3000, maxSubscribers: 2 });
    const a: number[] = [];
    const b: number[] = [];
    const unA = hub.subscribe((v) => a.push(v))!;
    await vi.advanceTimersByTimeAsync(0);
    const unB = hub.subscribe((v) => b.push(v))!;
    expect(b).toEqual([1]); // the late listener gets the latest value at once
    await vi.advanceTimersByTimeAsync(3000);
    await vi.advanceTimersByTimeAsync(3000);
    expect(polls).toBe(3);
    expect(a).toEqual([1, 2, 3]);
    expect(b).toEqual([1, 2, 3]);
    unA();
    unB();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(polls).toBe(3);
    expect(hub.subscribers()).toBe(0);
    expect(hub.latest()).toBeNull();
  });

  it("refuses more listeners than allowed and reports errors without stopping", async () => {
    let n = 0;
    const hub = createLiveHub<number>({
      poll: async () => {
        if (++n === 1) throw new Error("db");
        return n;
      },
      intervalMs: 1000,
      maxSubscribers: 1,
    });
    const errors: unknown[] = [];
    const values: number[] = [];
    const un = hub.subscribe((v) => values.push(v), (e) => errors.push(e))!;
    expect(hub.full()).toBe(true);
    expect(hub.subscribe(() => undefined)).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(errors).toHaveLength(1);
    expect(values).toEqual([2]);
    un();
  });
});

describe("SSE stream", () => {
  function makeHub(max = 4) {
    let n = 0;
    return createLiveHub({ poll: async () => ({ n: ++n }), intervalMs: 3000, maxSubscribers: max });
  }

  /** A fast consumer: collects every chunk until the stream ends. */
  function collect(stream: ReadableStream<Uint8Array>) {
    const chunks: string[] = [];
    const done = stream.pipeTo(new WritableStream({ write: (c) => void chunks.push(decode.decode(c)) }));
    return { chunks, done };
  }

  it("announces retry, sends a snapshot at once, then comments every 25 s so the tunnel never sees 100 s of silence", async () => {
    const ac = new AbortController();
    const { chunks, done } = collect(createLiveStream({ hub: makeHub(), signal: ac.signal })!);
    await vi.advanceTimersByTimeAsync(0);
    expect(chunks[0]).toBe("retry: 5000\n\n");
    expect(chunks[1]).toBe('event: snapshot\ndata: {"n":1}\n\n');
    await vi.advanceTimersByTimeAsync(KEEP_ALIVE_MS);
    expect(chunks.filter((c) => c === ": keep-alive\n\n")).toHaveLength(1);
    expect(chunks.filter((c) => c.startsWith("event: snapshot")).length).toBeGreaterThanOrEqual(8);
    // the whole 10 minutes the stream must survive through the tunnel: never 100 s without a byte
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(chunks.filter((c) => c === ": keep-alive\n\n").length).toBeGreaterThanOrEqual(24);
    ac.abort();
    await done;
  });

  it("releases timers and the hub subscription on abort (client went away)", async () => {
    const hub = makeHub();
    const ac = new AbortController();
    const { done } = collect(createLiveStream({ hub, signal: ac.signal })!);
    await vi.advanceTimersByTimeAsync(0);
    expect(hub.subscribers()).toBe(1);
    ac.abort();
    await done;
    expect(hub.subscribers()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ends by itself after its maximum lifetime so the browser reconnects (and the session is re-checked)", async () => {
    const hub = makeHub();
    const closed = vi.fn();
    const stream = createLiveStream({ hub, onClose: closed })!;
    const reader = stream.getReader();
    await vi.advanceTimersByTimeAsync(MAX_LIFETIME_MS + 1);
    let done = false;
    for (let i = 0; i < 400 && !done; i++) done = (await reader.read()).done;
    expect(done).toBe(true);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(hub.subscribers()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("drops snapshots instead of queueing without bound when the client reads slowly", async () => {
    const hub = makeHub();
    const stream = createLiveStream({ hub, queueSize: 3, keepAliveMs: 1_000_000 })!;
    await vi.advanceTimersByTimeAsync(3000 * 40); // 40 polls, nothing is read
    const reader = stream.getReader();
    let chunks = 0;
    for (;;) {
      const r = await Promise.race([reader.read(), Promise.resolve(null)]);
      if (!r || r.done) break;
      chunks++;
    }
    expect(chunks).toBeGreaterThan(0);
    expect(chunks).toBeLessThanOrEqual(4);
    await reader.cancel();
  });

  it("returns null when the hub is full", () => {
    const hub = makeHub(1);
    const first = createLiveStream({ hub })!;
    expect(first).not.toBeNull();
    expect(createLiveStream({ hub })).toBeNull();
  });
});

describe("live snapshot", () => {
  it("fills 30 minute slots with zeros inside a working window", () => {
    const m = fillMinutes(NOW, { viewers90s: 3, startupP95Ms: null, startupN: 0, attempts5m: 0, errorAttempts5m: 0, perMinute: [{ minute: new Date("2026-10-05T09:59:00Z"), viewers: 3, starts: 1, errors: 0 }], pageviewsPerMinute: [] });
    expect(m).toHaveLength(LIVE_WINDOW_MINUTES);
    expect(m[m.length - 1].minute).toBe("2026-10-05T10:00:00.000Z");
    expect(m[m.length - 2]).toMatchObject({ minute: "2026-10-05T09:59:00.000Z", viewers: 3, starts: 1 });
    expect(m[0].viewers).toBe(0);
  });

  it("combines telemetry, server load, tips and the Worker forecast, with honest notes", async () => {
    const t = fakeTelemetry({
      live: {
        viewers90s: 42, startupP95Ms: 1800, startupN: 12, attempts5m: 20, errorAttempts5m: 1,
        perMinute: [{ minute: new Date("2026-10-05T09:58:00Z"), viewers: 50, starts: 5, errors: 0 }, { minute: new Date("2026-10-05T09:59:00Z"), viewers: 45, starts: 2, errors: 2 }],
        pageviewsPerMinute: [{ minute: new Date("2026-10-05T09:59:00Z"), pageviews: 33 }],
      },
      snapshots: { "cloudflare:hls_worker_hourly": { fetchedAt: new Date("2026-10-05T09:50:00Z"), payload: { day: "2026-10-05", requests: 90_000, hourly: [{ hour: "08", requests: 9000 }, { hour: "09", requests: 9000 }] } } },
    });
    const s = await getLiveSnapshot(
      deps(t, fakeApp({ tips: { count: 3, totalMinor: 7500, currency: "pln" }, comments: 12 }), { host: async () => ({ cpuLoadPct: 40, memUsedPct: 60, swapUsedPct: 5 }) }),
      { video: VIDEO_A, since: new Date("2026-10-05T09:00:00Z") },
    );
    expect(s.viewersNow).toBe(42);
    expect(s.viewersPeak).toBe(50);
    expect(s.errorsLastMinute).toBe(2);
    expect(s.pageviewsLastMinute).toBe(33);
    expect(s.errorShare5mPct).toBeCloseTo(5);
    expect(s.server?.cpuLoadPct).toBe(40);
    expect(s.tips).toEqual({ count: 3, totalMinor: 7500, currency: "pln" });
    expect(s.comments).toEqual({ count: 12 });
    expect(s.workerForecast?.used).toBe(90_000);
    expect(s.workerForecast?.reason).toContain("Limit skończy się");
    expect(s.notes.some((n) => n.includes("12 startów"))).toBe(true);
  });

  it("everything is 'bez pomiaru' (null) without telemetry, never 0", async () => {
    const s = await getLiveSnapshot(deps(null), { video: null, since: null });
    expect(s.viewersNow).toBeNull();
    expect(s.startupP95Ms).toBeNull();
    expect(s.errorsLastMinute).toBeNull();
    expect(s.perMinute).toEqual([]);
    expect(s.tips).toBeNull();
    expect(s.workerForecast).toBeNull();
    expect(s.notes[0]).toContain("Telemetria nie odpowiada");
  });

  it("targets the asked film, else the nearest premiere, else the whole channel", async () => {
    const app = fakeApp({ videos: [VIDEO_A], premiere: { id: "va", title: "Cześć", slug: "czesc", premiereAt: new Date("2026-10-05T10:30:00Z") } });
    expect((await resolveLiveTarget(deps(null, app), "czesc")).video?.id).toBe("va");
    const p = await resolveLiveTarget(deps(null, app), null);
    expect(p.video?.id).toBe("va");
    expect(p.since?.toISOString()).toBe("2026-10-05T10:30:00.000Z");
    const none = await resolveLiveTarget(deps(null, fakeApp()), "unknown");
    expect(none.video).toBeNull();
    expect(none.reason).toContain("cały kanał");
  });
});
