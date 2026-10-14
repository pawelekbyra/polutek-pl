import { describe, expect, it } from "vitest";
import {
  addPlayback,
  averagePctViewed,
  audienceSplit,
  buildReachCurve,
  emptyPlayback,
  fillDays,
  msToSeconds,
  sampleState,
  subscriberFlow,
  subscriberSeries,
} from "@/lib/modules/creator-analytics/domain/aggregate";
import { buildPeriod, parseRange } from "@/lib/modules/creator-analytics/domain/period";
import { MIN_SAMPLE_VIEWS, RETENTION_POINTS } from "@/lib/modules/creator-analytics/domain/types";

describe("period", () => {
  it("accepts only 7, 28 and 90 (default 28) and rejects everything else", () => {
    expect(parseRange(null)).toBe(28);
    expect(parseRange("")).toBe(28);
    expect(parseRange("7")).toBe(7);
    expect(parseRange("90")).toBe(90);
    expect(parseRange("30")).toBeNull();
    expect(parseRange("-1")).toBeNull();
    expect(parseRange("28; DROP TABLE")).toBeNull();
  });

  it("covers N UTC days ending today, with the day before the period as the baseline", () => {
    const now = new Date("2026-10-14T15:30:00.000Z");
    const p = buildPeriod(7, now);
    expect(p.days).toHaveLength(7);
    expect(p.days[0]).toBe("2026-10-08");
    expect(p.days[6]).toBe("2026-10-14");
    expect(p.from.toISOString()).toBe("2026-10-08T00:00:00.000Z");
    expect(p.to).toEqual(now);
    expect(p.baselineDay).toBe("2026-10-07");
  });

  it("handles the start of the period exactly at midnight and month boundaries", () => {
    const p = buildPeriod(28, new Date("2026-03-01T00:00:00.000Z"));
    expect(p.days[27]).toBe("2026-03-01");
    expect(p.days[0]).toBe("2026-02-02");
    expect(p.baselineDay).toBe("2026-02-01");
  });
});

describe("aggregation", () => {
  it("withholds values below the sample threshold instead of rounding them into a figure", () => {
    expect(sampleState(0)).toBe("no_data");
    expect(sampleState(MIN_SAMPLE_VIEWS - 1)).toBe("low_sample");
    expect(sampleState(MIN_SAMPLE_VIEWS)).toBe("ok");
  });

  it("fills missing days with zero and ignores days outside the period", () => {
    const days = ["2026-10-12", "2026-10-13", "2026-10-14"];
    expect(fillDays(days, [])).toEqual([0, 0, 0]);
    expect(fillDays(days, [{ day: "2026-10-13", value: 4 }, { day: "2026-09-01", value: 99 }])).toEqual([0, 4, 0]);
  });

  it("averages the share watched only with enough sessions and clamps to 0..100", () => {
    expect(averagePctViewed(emptyPlayback())).toEqual({ value: null, state: "no_data" });
    expect(averagePctViewed({ sessions: 5, watchMs: 1, pctSessions: 5, pctSum: 2.5 })).toEqual({ value: null, state: "low_sample" });
    expect(averagePctViewed({ sessions: 20, watchMs: 1, pctSessions: 20, pctSum: 10 })).toEqual({ value: 50, state: "ok" });
    expect(averagePctViewed({ sessions: 10, watchMs: 1, pctSessions: 10, pctSum: 99 }).value).toBe(100);
  });

  it("adds playback sums and rounds milliseconds to seconds", () => {
    const sum = addPlayback({ sessions: 1, watchMs: 1500, pctSessions: 1, pctSum: 0.5 }, { sessions: 2, watchMs: 500, pctSessions: 1, pctSum: 1 });
    expect(sum).toEqual({ sessions: 3, watchMs: 2000, pctSessions: 2, pctSum: 1.5 });
    expect(msToSeconds(1499)).toBe(1);
    expect(msToSeconds(-5)).toBe(0);
  });
});

describe("subscriber flow", () => {
  it("is exact when the baseline exists: net, gained and the loss of earlier subscribers", () => {
    const flow = subscriberFlow({ current: 110, baseline: { day: "2026-10-07", subscribers: 100 }, gained: 15 });
    expect(flow).toMatchObject({ net: 10, gained: 15, lost: 5, baselineDay: "2026-10-07" });
  });

  it("leaves net and loss unknown (null) without a baseline snapshot, never zero", () => {
    const flow = subscriberFlow({ current: 110, baseline: null, gained: 15 });
    expect(flow.net).toBeNull();
    expect(flow.lost).toBeNull();
    expect(flow.gained).toBe(15);
  });

  it("never reports a negative loss when counts drifted", () => {
    expect(subscriberFlow({ current: 130, baseline: { day: "d", subscribers: 100 }, gained: 10 }).lost).toBe(0);
  });

  it("keeps days without a snapshot as gaps and shows the live count for today", () => {
    const days = ["2026-10-12", "2026-10-13", "2026-10-14"];
    expect(subscriberSeries(days, [{ day: "2026-10-12", subscribers: 90 }], "2026-10-14", 95)).toEqual([90, null, 95]);
  });
});

describe("reach curve", () => {
  it("is withheld below the threshold", () => {
    const r = buildReachCurve([{ bucket: 20, sessions: MIN_SAMPLE_VIEWS - 1 }]);
    expect(r.state).toBe("low_sample");
    expect(r.points).toBeNull();
  });

  it("reports the share of views that reached each 5% step, monotonically falling from 100", () => {
    const r = buildReachCurve([
      { bucket: 0, sessions: 2 }, // left within the first 5%
      { bucket: 10, sessions: 8 }, // got to the middle
      { bucket: 20, sessions: 10 }, // watched to the end
    ]);
    expect(r.state).toBe("ok");
    expect(r.sessions).toBe(20);
    expect(r.points).toHaveLength(RETENTION_POINTS);
    expect(r.points![0]).toEqual({ atPct: 0, reachedPct: 100 });
    expect(r.points![1].reachedPct).toBe(90);
    expect(r.points![10].reachedPct).toBe(90);
    expect(r.points![11].reachedPct).toBe(50);
    expect(r.points![20]).toEqual({ atPct: 100, reachedPct: 50 });
    const values = r.points!.map((p) => p.reachedPct);
    expect([...values].sort((a, b) => b - a)).toEqual(values);
  });

  it("clamps out-of-range buckets instead of dropping sessions", () => {
    const r = buildReachCurve([{ bucket: 99, sessions: 10 }, { bucket: -3, sessions: 0 }]);
    expect(r.sessions).toBe(10);
    expect(r.points![20].reachedPct).toBe(100);
  });
});

describe("audience split", () => {
  it("hides the split for a small sample and derives guests otherwise", () => {
    expect(audienceSplit({ views: 3, signedIn: 1, subscribers: 1 })).toMatchObject({ state: "low_sample", guestViews: null, signedInViews: null });
    expect(audienceSplit({ views: 0, signedIn: 0, subscribers: 0 }).state).toBe("no_data");
    expect(audienceSplit({ views: 40, signedIn: 15, subscribers: 6 })).toMatchObject({ state: "ok", guestViews: 25, signedInViews: 15, subscriberViews: 6 });
  });
});
