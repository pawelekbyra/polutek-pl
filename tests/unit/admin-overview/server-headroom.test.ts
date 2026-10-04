import { describe, expect, it } from "vitest";
import { SERVER_CAPACITY, computeServerHeadroom, dailyViewsAt, getServerHeadroom, recommendationFor, usageKind, type OverviewDeps, type ServerCapacity, type TelemetryPeaks } from "@/lib/modules/admin-overview";

const NOW = new Date("2026-10-05T12:00:00Z");
const CAP: ServerCapacity = { ...SERVER_CAPACITY, comfortablePerSec: 8, limitPerSec: 16, peakHourShare: 0.1 };
const peaks = (over: Partial<TelemetryPeaks> = {}): TelemetryPeaks => ({
  firstAt: new Date(NOW.getTime() - 3 * 86_400_000).toISOString(),
  views24h: 5000,
  peakMinute: { h1: 60, h24: 240, d7: 300 },
  peakSecond: { h1: 2, h24: 9, d7: 11 },
  ...over,
});

describe("thresholds", () => {
  it("green below half of the limit, yellow 50-80%, red above 80%", () => {
    expect(usageKind(0)).toBe("ok");
    expect(usageKind(0.4999)).toBe("ok");
    expect(usageKind(0.5)).toBe("warn");
    expect(usageKind(0.8)).toBe("warn");
    expect(usageKind(0.8001)).toBe("crit");
    expect(usageKind(1.4)).toBe("crit");
  });

  it("recommends upgrading before a premiere above half of the limit", () => {
    expect(recommendationFor("warn", true)).toMatch(/Powiększ serwer przed premierą/);
    expect(recommendationFor("crit", true)).toMatch(/teraz/);
    expect(recommendationFor("ok", false)).toMatch(/mniej niż z 24 godzin/);
  });
});

describe("computeServerHeadroom", () => {
  it("uses the busiest minute of the last 24 h as views per second", () => {
    const h = computeServerHeadroom(peaks(), CAP, NOW);
    if (h.state !== "ok") throw new Error("expected ok");
    expect(h.basis).toBe("h24");
    expect(h.peakPerSec).toBe(4); // 240 views in a minute
    expect(h.usage).toBe(0.25);
    expect(h.headroom).toBe(0.75);
    expect(h.kind).toBe("ok");
    expect(h.windows.d7.perSec).toBe(5);
    expect(h.enoughData).toBe(true);
  });

  it("a peak over the limit: no negative headroom, red", () => {
    const h = computeServerHeadroom(peaks({ peakMinute: { h1: 0, h24: 1200, d7: 1200 } }), CAP, NOW);
    if (h.state !== "ok") throw new Error("expected ok");
    expect(h.usage).toBe(1.25);
    expect(h.headroom).toBe(0);
    expect(h.kind).toBe("crit");
  });

  it("exactly half of the limit is yellow", () => {
    const h = computeServerHeadroom(peaks({ peakMinute: { h1: null, h24: 480, d7: 480 } }), CAP, NOW);
    if (h.state !== "ok") throw new Error("expected ok");
    expect(h.kind).toBe("warn");
  });

  it("says honestly when there is less than 24 h of telemetry", () => {
    const h = computeServerHeadroom(peaks({ firstAt: new Date(NOW.getTime() - 5 * 3_600_000).toISOString() }), CAP, NOW);
    if (h.state !== "ok") throw new Error("expected ok");
    expect(h.enoughData).toBe(false);
    expect(h.coverageHours).toBeCloseTo(5);
  });

  it("no views in 24 h falls back to 7 days; no views at all is 'no data', not zero", () => {
    const h = computeServerHeadroom(peaks({ peakMinute: { h1: null, h24: null, d7: 120 } }), CAP, NOW);
    if (h.state !== "ok") throw new Error("expected ok");
    expect(h.basis).toBe("d7");
    expect(h.peakPerSec).toBe(2);
    expect(computeServerHeadroom(peaks({ firstAt: null }), CAP, NOW).state).toBe("error");
  });

  it("converts to page views per day with the busiest hour at 10% of the day", () => {
    expect(dailyViewsAt(16, 0.1)).toBe(576_000);
    expect(dailyViewsAt(8, 0.1)).toBe(288_000);
    expect(dailyViewsAt(8, 0)).toBe(0);
    const h = computeServerHeadroom(peaks(), CAP, NOW);
    if (h.state === "ok") expect([h.dailyAtLimit, h.dailyComfortable]).toEqual([576_000, 288_000]);
  });

  it("capacity comes from the config file measured in the load test", () => {
    expect(SERVER_CAPACITY.comfortablePerSec).toBe(8);
    expect(SERVER_CAPACITY.limitPerSec).toBeGreaterThanOrEqual(16);
    expect(SERVER_CAPACITY.limitPerSec).toBeLessThanOrEqual(17);
    expect(SERVER_CAPACITY.source).toBe("docs/operations/LOAD-TEST.md");
  });
});

describe("getServerHeadroom", () => {
  const base = { now: () => NOW } as unknown as OverviewDeps;

  it("not configured when there is no telemetry reader", async () => {
    expect((await getServerHeadroom(base)).state).toBe("unconfigured");
    expect((await getServerHeadroom({ ...base, telemetry: async () => null })).state).toBe("unconfigured");
  });

  it("a failed or throwing read is an error state with a reason", async () => {
    expect(await getServerHeadroom({ ...base, telemetry: async () => ({ ok: false, reason: "x" }) })).toMatchObject({ state: "error", reason: "x" });
    expect((await getServerHeadroom({ ...base, telemetry: async () => { throw new Error("boom"); } })).state).toBe("error");
  });

  it("computes from the read peaks", async () => {
    const h = await getServerHeadroom({ ...base, telemetry: async () => ({ ok: true, peaks: peaks() }) }, CAP);
    expect(h).toMatchObject({ state: "ok", peakPerSec: 4 });
  });
});
