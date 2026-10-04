import { describe, expect, it } from "vitest";
import {
  bucketIndex,
  deltaOf,
  fmtBytes,
  fmtRelative,
  isStale,
  minorToPln,
  netMinor,
  parseCompare,
  parseRange,
  rangeWindows,
  startOfWarsawDay,
  summarizeHealth,
  type HealthCheckDto,
} from "@/lib/modules/admin-overview";

describe("Warsaw time windows", () => {
  it("finds local midnight in summer and winter", () => {
    expect(startOfWarsawDay(new Date("2026-10-04T14:36:00Z")).toISOString()).toBe("2026-10-03T22:00:00.000Z");
    expect(startOfWarsawDay(new Date("2026-12-04T00:30:00Z")).toISOString()).toBe("2026-12-03T23:00:00.000Z");
  });

  it("handles the DST change day (25-hour 25 Oct 2026)", () => {
    const now = new Date("2026-10-25T22:30:00Z"); // 23:30 local, after the switch to CET
    expect(startOfWarsawDay(now).toISOString()).toBe("2026-10-24T22:00:00.000Z");
    const w = rangeWindows("today", now);
    expect(w.buckets).toHaveLength(25);
    expect(w.buckets[0].label).toBe("00:00");
    expect(w.buckets[24].label).toBe("23:00");
  });

  it("'today' compares with the same time a week ago and buckets by hour", () => {
    const now = new Date("2026-10-04T12:36:00Z"); // 14:36 Warsaw
    const w = rangeWindows("today", now);
    expect(w.buckets).toHaveLength(15);
    expect(w.previous.from.toISOString()).toBe("2026-09-26T22:00:00.000Z");
    expect(w.previous.to.toISOString()).toBe("2026-09-27T12:36:00.000Z");
    expect(bucketIndex(w, new Date("2026-10-04T12:10:00Z"))).toBe(14);
    expect(bucketIndex(w, new Date("2026-10-03T21:59:00Z"))).toBe(-1);
  });

  it("day ranges cover whole local days and shift back by one period", () => {
    const now = new Date("2026-10-04T12:36:00Z");
    const w = rangeWindows("7d", now);
    expect(w.buckets.map((b) => b.key)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(w.current.from.toISOString()).toBe("2026-09-27T22:00:00.000Z");
    expect(w.previous.to.getTime() - w.previous.from.getTime()).toBe(w.current.to.getTime() - w.current.from.getTime());
    expect(bucketIndex(w, new Date("2026-09-30T23:30:00Z"))).toBe(3); // 1 Oct 01:30 local
  });

  it("falls back to defaults for unknown URL values", () => {
    expect(parseRange("12m")).toBe("today");
    expect(parseRange("28d")).toBe("28d");
    expect(parseCompare("year")).toBe("prev");
    expect(parseCompare("none")).toBe("none");
  });
});

describe("one revenue definition", () => {
  it("counts the net amount after refunds, never below zero", () => {
    expect(netMinor({ amountMinor: 2000, refundedAmountMinor: 500 })).toBe(1500);
    expect(netMinor({ amountMinor: 2000, refundedAmountMinor: 9000 })).toBe(0);
  });
  it("converts known currencies and refuses to guess unknown ones", () => {
    expect(minorToPln(1000, "pln")).toBe(10);
    expect(minorToPln(1000, "CHF", { DISPLAY_CHF_TO_PLN_RATE: "4" })).toBe(40);
    expect(minorToPln(1000, "JPY")).toBeNull();
  });
});

describe("health summary", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  const check = (id: string, kind: HealthCheckDto["kind"]): HealthCheckDto => ({ id, label: id, kind, detail: "", measuredAt: now.toISOString(), source: "t", everyMin: 1 });

  it("is as bad as the worst check; missing data never turns it amber", () => {
    expect(summarizeHealth([check("a", "ok"), check("b", "info")], now)).toMatchObject({ kind: "ok", word: "OK" });
    expect(summarizeHealth([check("a", "ok"), check("disk", "warn")], now)).toMatchObject({ kind: "warn", headline: "Działa, uwaga: disk" });
    expect(summarizeHealth([check("db", "crit"), check("disk", "warn")], now)).toMatchObject({ kind: "crit", word: "Błąd" });
  });

  it("marks data older than twice its interval as stale", () => {
    expect(isStale(new Date(now.getTime() - 90_000).toISOString(), 1, now)).toBe(false);
    expect(isStale(new Date(now.getTime() - 3 * 60_000).toISOString(), 1, now)).toBe(true);
    expect(isStale(null, 1, now)).toBe(true);
  });
});

describe("formatting", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  it("speaks deltas with direction and whether they are good", () => {
    expect(deltaOf(150, 100)).toMatchObject({ tone: "good", direction: "up", text: "50%", spoken: "wzrost o 50% (korzystnie)" });
    expect(deltaOf(150, 100, false)).toMatchObject({ tone: "bad", spoken: "wzrost o 50% (niekorzystnie)" });
    expect(deltaOf(100, 100)).toMatchObject({ tone: "flat", text: "0%" });
    expect(deltaOf(5, 0)).toBeNull();
    expect(deltaOf(5, null)).toBeNull();
  });
  it("prints relative times and sizes in Polish", () => {
    expect(fmtRelative(new Date(now.getTime() - 30_000), now)).toBe("przed chwilą");
    expect(fmtRelative(new Date(now.getTime() - 5 * 60_000), now)).toBe("5 min temu");
    expect(fmtRelative(new Date(now.getTime() + 2 * 86_400_000 + 5 * 3600_000), now)).toBe("za 2 d 5 h");
    expect(fmtBytes(46 * 1024 ** 3)).toBe("46,0 GB");
    expect(fmtBytes(null)).toBe("—");
  });
});
