import { describe, expect, it } from "vitest";
import { bucketIndex, rangeWindows, warsawDayKey } from "@/lib/modules/admin-overview";
import { bucketRowKey, coveredTotal, hourRowKey, makePeriod, previousBuckets, seriesOf, totalOf, dailyRange } from "@/lib/modules/admin-analytics";
import { createSwrCache } from "@/lib/modules/admin-analytics";
import { NOW } from "./fakes";

describe("buckets and the Europe/Warsaw day", () => {
  it("a beacon at 22:30 UTC in summer already belongs to the next Warsaw day", () => {
    const at = new Date("2026-10-04T22:30:00Z"); // 00:30 on 5 Oct in Warsaw (UTC+2)
    expect(warsawDayKey(at)).toBe("2026-10-05");
    const w = rangeWindows("today", NOW);
    expect(bucketIndex(w, at)).toBe(0);
    expect(bucketIndex(w, new Date("2026-10-04T21:59:00Z"))).toBe(-1);
  });

  it("in winter the day starts at 23:00 UTC", () => {
    const at = new Date("2026-01-15T23:30:00Z"); // 00:30 on 16 Jan in Warsaw (UTC+1)
    const p = makePeriod("today", "prev", at);
    expect(p.current.fromDay).toBe("2026-01-16");
    expect(p.current.toDay).toBe("2026-01-16");
    expect(p.previous?.fromDay).toBe("2026-01-09");
    expect(p.current.buckets).toHaveLength(1);
  });

  it("hour rows and hour buckets share a key", () => {
    const w = rangeWindows("today", NOW);
    const b = w.buckets[3];
    expect(bucketRowKey("hour", b)).toBe(hourRowKey(b.start.toISOString()));
    expect(bucketRowKey("day", rangeWindows("7d", NOW).buckets[0])).toBe("2026-09-29");
  });

  it("the comparison of days is the same number of days one period earlier", () => {
    const w = rangeWindows("7d", NOW);
    const prev = previousBuckets(w);
    expect(w.buckets.map((b) => b.key)).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"]);
    expect(prev.map((b) => b.key)).toEqual(["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28"]);
  });

  it("stays correct over the 25-hour day when summer time ends (25 Oct 2026)", () => {
    const now = new Date("2026-10-27T10:00:00Z");
    const w = rangeWindows("7d", now);
    expect(w.buckets.map((b) => b.key)).toEqual(["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"]);
    const dst = w.buckets[4];
    const next = w.buckets[5];
    expect(dst.start.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(next.start.toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect((next.start.getTime() - dst.start.getTime()) / 3_600_000).toBe(25);
    const prev = previousBuckets(w);
    expect(prev.map((b) => b.key)).toEqual(["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"]);
  });

  it("the hourly comparison is exactly one week earlier", () => {
    const w = rangeWindows("today", NOW);
    const prev = previousBuckets(w);
    expect(prev).toHaveLength(w.buckets.length);
    expect(w.buckets[5].start.getTime() - prev[5].start.getTime()).toBe(7 * 86_400_000);
  });

  it("'today' widens to 7 days for per-day quality screens", () => {
    expect(dailyRange("today")).toEqual({ range: "7d", widened: true });
    expect(dailyRange("28d")).toEqual({ range: "28d", widened: false });
  });
});

describe("series without fake zeros", () => {
  const w = rangeWindows("7d", NOW);
  const rows = [{ day: "2026-10-03", v: 5 }, { day: "2026-10-05", v: 7 }];

  it("a bucket before the first telemetry day is null, a quiet day inside coverage is 0", () => {
    const s = seriesOf("day", w.buckets, rows, (r) => r.day, (r) => r.v, "2026-10-02");
    expect(s).toEqual([null, null, null, 0, 5, 0, 7]);
  });

  it("no telemetry at all means everything is null", () => {
    expect(seriesOf("day", w.buckets, rows, (r) => r.day, (r) => r.v, null).every((v) => v === null)).toBe(true);
  });

  it("sums only whole measured periods", () => {
    expect(totalOf([1, 2, 3])).toBe(6);
    expect(totalOf([1, null, 3])).toBeNull();
    expect(coveredTotal([1, null, 3])).toEqual({ sum: 4, covered: 2 });
  });

  it("the first covered bucket counts from the start of the first Warsaw day", () => {
    // first data on 2026-10-04: that day is covered, 2026-10-03 is not
    const s = seriesOf("day", w.buckets, [], (r: { day: string }) => r.day, () => 1, "2026-10-04");
    expect(s.slice(4)).toEqual([null, 0, 0]);
  });
});

describe("stale-while-revalidate cache", () => {
  it("serves fresh, then stale while ONE refresh runs, keeps stale on failure, and is bounded", async () => {
    let t = 0;
    const cache = createSwrCache({ freshMs: 10, staleMs: 100, maxEntries: 2, now: () => t });
    let loads = 0;
    const load = async () => ++loads;
    expect(await cache.get("a", load)).toBe(1);
    expect(await cache.get("a", load)).toBe(1);
    t = 50; // stale: old value now, refresh in the background (only one even when asked twice)
    expect(await Promise.all([cache.get("a", load), cache.get("a", load)])).toEqual([1, 1]);
    await Promise.resolve();
    await Promise.resolve();
    expect(loads).toBe(2);
    expect(await cache.get("a", load)).toBe(2);

    t = 70;
    await cache.get("a", async () => 99); // stale -> background load
    t = 75;
    const failing = async (): Promise<number> => { throw new Error("db down"); };
    t = 120; // stale again
    expect(await cache.get("a", failing)).toBe(99);
    await Promise.resolve();
    expect(await cache.get("a", failing)).toBe(99); // refresh failed: still the stale value

    await cache.get("b", load);
    await cache.get("c", load);
    expect(cache.size()).toBe(2);
  });

  it("shares one cold load between simultaneous callers and propagates its failure", async () => {
    const cache = createSwrCache({ freshMs: 10, staleMs: 100 });
    let loads = 0;
    const slow = async () => { loads++; await new Promise((r) => setTimeout(r, 5)); return 7; };
    const [a, b] = await Promise.all([cache.get("k", slow), cache.get("k", slow)]);
    expect([a, b, loads]).toEqual([7, 7, 1]);
    await expect(cache.get("bad", async () => { throw new Error("x"); })).rejects.toThrow("x");
  });
});
