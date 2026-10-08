import { describe, expect, it } from "vitest";
import {
  conquestSeries, conquestSteps, countriesWord, getWorldOverview, TELEMETRY_OFF_REASON, worldClassBreaks, worldClassLegend, worldClassOf, WORLD_MAX_CLASSES,
} from "@/lib/modules/admin-analytics";
import { deps, fakeApp, fakeTelemetry } from "./fakes";
import type { AnalyticsDeps } from "@/lib/modules/admin-analytics";

describe("world colour classes", () => {
  it("grows geometrically 1, 2, 5, 10 … and never exceeds the design system's steps", () => {
    expect(worldClassBreaks(0)).toEqual([1]);
    expect(worldClassBreaks(1)).toEqual([1]);
    expect(worldClassBreaks(3)).toEqual([1, 2]);
    expect(worldClassBreaks(60)).toEqual([1, 2, 5, 10, 20, 50]);
    for (const max of [7, 99, 1000, 123_456, 9_999_999]) {
      const b = worldClassBreaks(max);
      expect(b.length).toBeLessThanOrEqual(WORLD_MAX_CLASSES);
      expect(b[0]).toBe(1);
      expect([...b].sort((x, y) => x - y)).toEqual(b);
      expect(b[b.length - 1]).toBeLessThanOrEqual(max);
    }
  });

  it("puts 0 in the 'no visitors' class and the maximum in the top class", () => {
    const b = worldClassBreaks(1000);
    expect(worldClassOf(0, b)).toBe(0);
    expect(worldClassOf(1, b)).toBe(1);
    expect(worldClassOf(1000, b)).toBe(b.length);
    expect(worldClassOf(Number.NaN, b)).toBe(0);
  });

  it("labels the classes as closed ranges with an open last one", () => {
    expect(worldClassLegend([1, 2, 5, 10]).map((c) => c.label)).toEqual(["1", "2–4", "5–9", "10+"]);
    expect(worldClassLegend([1]).map((c) => c.label)).toEqual(["1+"]);
  });
});

describe("Polish plural of kraj", () => {
  it("follows the Polish rules, including the teens", () => {
    const form = (n: number) => countriesWord(n);
    expect([0, 1, 2, 4, 5, 11, 12, 14, 15, 21, 22, 25, 112, 114].map(form)).toEqual(["krajów", "kraj", "kraje", "kraje", "krajów", "krajów", "krajów", "krajów", "krajów", "krajów", "kraje", "krajów", "krajów", "krajów"]);
  });
});

describe("conquest timeline", () => {
  const rows = [
    { code: "PL", firstDay: "2026-09-01" },
    { code: "DE", firstDay: "2026-09-03" },
    { code: "CZ", firstDay: "2026-09-03" },
    { code: "??", firstDay: "2026-09-02" },
    { code: "US", firstDay: "not-a-day" },
  ];

  it("groups new countries by day with a running total and skips unknown codes", () => {
    expect(conquestSteps(rows)).toEqual([
      { day: "2026-09-01", codes: ["PL"], total: 1 },
      { day: "2026-09-03", codes: ["CZ", "DE"], total: 3 },
    ]);
  });

  it("gives a running total per day, null before the first measurement (never 0)", () => {
    const steps = conquestSteps(rows);
    expect(conquestSeries(steps, ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"], "2026-09-01")).toEqual([null, 1, 1, 3, 3]);
  });
});

describe("world overview (Analityka → Świat)", () => {
  const countryDays = [
    // Before the 7-day period (2026-09-29 … 2026-10-05): PL, DE, and a country only seen back then (FR).
    { day: "2026-09-01", value: "PL", visitors: 40, pageviews: 90 },
    { day: "2026-09-10", value: "DE", visitors: 2, pageviews: 3 },
    { day: "2026-09-12", value: "FR", visitors: 1, pageviews: 1 },
    { day: "2026-09-25", value: "PL", visitors: 30, pageviews: 60 },
    // Current period.
    { day: "2026-10-01", value: "PL", visitors: 50, pageviews: 120 },
    { day: "2026-10-02", value: "DE", visitors: 3, pageviews: 5 },
    { day: "2026-10-03", value: "JP", visitors: 1, pageviews: 2 },
    { day: "2026-10-04", value: "MT", visitors: 1, pageviews: 1 },
    { day: "2026-10-04", value: "??", visitors: 4, pageviews: 6 },
  ];
  const world = (over: Partial<AnalyticsDeps> = {}) => ({ ...deps(fakeTelemetry({ countryDays }), fakeApp()), ...over });

  it("lists the period's countries by visitors, then countries seen only earlier, with shares and new flags", async () => {
    const r = await getWorldOverview(world(), { range: "7d", compare: "prev" });
    if (!r.available) throw new Error(r.reason);
    const d = r.data;
    expect(d.countries.map((c) => c.code)).toEqual(["PL", "DE", "JP", "MT", "FR"]);
    const pl = d.countries[0];
    expect(pl).toMatchObject({ visitors: 50, pageviews: 120, firstDay: "2026-09-01", isNew: false });
    expect(pl.share).toBeCloseTo((100 * 50) / 55);
    expect(d.countries.find((c) => c.code === "JP")).toMatchObject({ isNew: true, firstDay: "2026-10-03" });
    expect(d.countries.find((c) => c.code === "FR")).toMatchObject({ visitors: 0, cls: 0, isNew: false, firstDay: "2026-09-12" });
    expect(d.unknownVisitors).toBe(4);
    expect(pl.cls).toBe(d.classes.length);
    expect(d.countries.find((c) => c.code === "JP")?.cls).toBe(1);
  });

  it("counts countries, new countries, all-time countries and the share from abroad, compared fairly", async () => {
    const r = await getWorldOverview(world(), { range: "7d", compare: "prev" });
    if (!r.available) throw new Error(r.reason);
    const k = Object.fromEntries(r.data.kpis.map((x) => [x.key, x]));
    expect(k.countries).toMatchObject({ value: 4, previous: 1 });
    expect(k.new).toMatchObject({ value: 2, previous: 0 });
    expect(k.all).toMatchObject({ value: 5, previous: null });
    expect(k.abroad.value).toBeCloseTo((100 * 5) / 55);
    expect(k.abroad.previous).toBeCloseTo(0);
  });

  it("does not compare 'today' with a whole day a week ago", async () => {
    const r = await getWorldOverview(world(), { range: "today", compare: "prev" });
    if (!r.available) throw new Error(r.reason);
    for (const k of r.data.kpis) expect(k.previous).toBeNull();
  });

  it("builds the conquest milestones and the running line from the first measured day", async () => {
    const r = await getWorldOverview(world(), { range: "7d", compare: "none" });
    if (!r.available) throw new Error(r.reason);
    expect(r.data.conquest.map((s) => [s.day, s.codes, s.total])).toEqual([
      ["2026-09-01", ["PL"], 1],
      ["2026-09-10", ["DE"], 2],
      ["2026-09-12", ["FR"], 3],
      ["2026-10-03", ["JP"], 4],
      ["2026-10-04", ["MT"], 5],
    ]);
    expect(r.data.conquest[0].names).toEqual(["Polska"]);
    const line = r.data.conquestSeries.current;
    expect(line.length).toBe(35); // 2026-09-01 … 2026-10-05
    expect(line[0]).toBe(1);
    expect(line[line.length - 1]).toBe(5);
    expect(r.data.conquestSeries.previous).toBeNull();
  });

  it("says 'bez pomiaru' instead of guessing when telemetry is not connected", async () => {
    const r = await getWorldOverview(world({ telemetry: null }), { range: "7d", compare: "prev" });
    expect(r).toEqual({ available: false, reason: TELEMETRY_OFF_REASON });
  });

  it("shows an empty map honestly when nothing was measured", async () => {
    const r = await getWorldOverview(deps(fakeTelemetry({ countryDays: [] }), fakeApp()), { range: "7d", compare: "prev" });
    if (!r.available) throw new Error(r.reason);
    expect(r.data.countries).toEqual([]);
    expect(r.data.conquest).toEqual([]);
    const k = Object.fromEntries(r.data.kpis.map((x) => [x.key, x]));
    expect(k.countries.value).toBe(0);
    expect(k.abroad.value).toBeNull();
  });
});
