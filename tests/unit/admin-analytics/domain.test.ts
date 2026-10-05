import { describe, expect, it } from "vitest";
import {
  bucketOf, emptyHist, histFromValues, histPercentile, histTotal, STARTUP_BUCKETS, STARTUP_EDGES_MS, sumHists,
  addTotals, emptyTotals, errorClassLabel, ladderLabel, rebufferRatio, sampleLevel, smoothnessScore, startupScore, summarizeQoe,
  biggestDrop, mergeRetention, retentionCurve, typicalBand, buildFunnel, biggestLoss,
} from "@/lib/modules/admin-analytics";

describe("startup histogram", () => {
  it("buckets like Postgres width_bucket: 0 below the first edge, last bucket open", () => {
    expect(bucketOf(0)).toBe(0);
    expect(bucketOf(249)).toBe(0);
    expect(bucketOf(250)).toBe(1);
    expect(bucketOf(999)).toBe(3);
    expect(bucketOf(1000)).toBe(4);
    expect(bucketOf(19_999)).toBe(11);
    expect(bucketOf(20_000)).toBe(12);
    expect(bucketOf(10_000_000)).toBe(12);
    expect(STARTUP_BUCKETS).toBe(STARTUP_EDGES_MS.length + 1);
  });

  it("sums exactly across days and ignores malformed arrays", () => {
    const a = histFromValues([100, 300, 1200]);
    const b = histFromValues([100, 100, 25_000]);
    const s = sumHists([a, b, [1, 2, 3], null, undefined]);
    expect(histTotal(s)).toBe(6);
    expect(s[0]).toBe(3);
    expect(s[12]).toBe(1);
  });

  it("reads percentiles by interpolation inside the bucket", () => {
    // 90 values below 1000 ms (bucket 0..3), 10 in [1000, 1500): p95 = 1000 + (95-90)/10 * 500 = 1250
    const h = emptyHist();
    h[2] = 90; // [500, 750)
    h[4] = 10; // [1000, 1500)
    expect(histPercentile(h, 0.95)).toBeCloseTo(1250, 6);
    // the median (rank 50 of 100) is the 50th of the 90 values inside [500, 750): 500 + 50/90 * 250
    expect(histPercentile(h, 0.5)).toBeCloseTo(500 + (50 / 90) * 250, 6);
    expect(histPercentile(emptyHist(), 0.95)).toBeNull();
  });

  it("is bounded for the open last bucket", () => {
    const h = emptyHist();
    h[12] = 4;
    expect(histPercentile(h, 1)).toBe(30_000);
    expect(histPercentile(h, 0.5)).toBeCloseTo(25_000, 6);
  });
});

describe("QoE formulas (Mux Data)", () => {
  it("startup score 8/(8+s): 95 at 0.4 s, 80 at 2 s, 50 at 8 s, 29 at 20 s", () => {
    expect(Math.round(startupScore(0.4))).toBe(95);
    expect(Math.round(startupScore(2))).toBe(80);
    expect(Math.round(startupScore(8))).toBe(50);
    expect(Math.round(startupScore(20))).toBe(29);
    expect(startupScore(-3)).toBe(100);
  });

  it("smoothness score is 100 without rebuffering and falls with count and share", () => {
    expect(smoothnessScore(0, 0)).toBe(100);
    // 2 rebuffers, 5% of the time: (100/sqrt(2) + 100*e^-0.5) / 2
    expect(smoothnessScore(2, 0.05)).toBeCloseTo((100 / Math.SQRT2 + 100 * Math.exp(-0.5)) / 2, 9);
    expect(smoothnessScore(10, 0.5)).toBeLessThan(smoothnessScore(2, 0.05));
  });

  it("rebuffer ratio is rebuffer/(watch+rebuffer) and 0 for nothing played", () => {
    expect(rebufferRatio(1000, 9000)).toBeCloseTo(0.1);
    expect(rebufferRatio(0, 0)).toBe(0);
  });

  it("summarises totals, with null for what was not measured", () => {
    const empty = summarizeQoe(emptyTotals());
    expect(empty.sample).toBe("none");
    expect(empty.experienceScore).toBeNull();
    expect(empty.errorPct).toBeNull();
    expect(empty.rebufferPct).toBeNull();

    const t = addTotals(emptyTotals(), {
      attempts: 40, started: 36, exitsBeforeStart: 4, errors: 2, fatalErrors: 1, watchMs: 900_000, rebufferMs: 100_000, startupN: 36,
      startupScoreSum: 36 * 80, smoothnessSum: 36 * 90, smoothnessN: 36, bitrateSum: 36 * 2000, bitrateN: 36, switches: 18,
    });
    const s = summarizeQoe(t);
    expect(s.sample).toBe("ok");
    expect(s.exitBeforeStartPct).toBeCloseTo(10);
    expect(s.errorPct).toBeCloseTo(5);
    expect(s.fatalErrorPct).toBeCloseTo(2.5);
    expect(s.rebufferPct).toBeCloseTo(10);
    expect(s.startupScore).toBeCloseTo(80);
    expect(s.smoothnessScore).toBeCloseTo(90);
    expect(s.playbackSuccessScore).toBeCloseTo(97.5);
    expect(s.experienceScore).toBeCloseTo((80 + 90 + 97.5) / 3);
    expect(s.avgBitrateKbps).toBe(2000);
    expect(s.switchesPerAttempt).toBeCloseTo(0.5);
  });

  it("flags small samples", () => {
    expect(sampleLevel(0)).toBe("none");
    expect(sampleLevel(29)).toBe("low");
    expect(sampleLevel(30)).toBe("ok");
  });

  it("labels error classes and ladder classes in Polish", () => {
    expect(errorClassLabel("hls:networkError:manifestLoadError")).toBe("Odtwarzacz HLS, sieć: manifestLoadError");
    expect(errorClassLabel("media:3")).toBe("Błąd przeglądarki (3)");
    expect(errorClassLabel("x")).toBe("x");
    expect(ladderLabel(0)).toBe("bez danych o jakości");
    expect(ladderLabel(720)).toBe("do 720p");
  });
});

describe("retention curve", () => {
  const curveOf = (reached: number, started: number) => ({ started, retention: new Array<number>(100).fill(0).map((_, k) => (k < reached ? started : 0)) });

  it("is the share of started attempts that reached each percent; days merge by summing", () => {
    const day1 = { started: 10, retention: new Array<number>(100).fill(10) };
    const day2 = { started: 10, retention: new Array<number>(100).fill(0).map((_, k) => (k < 50 ? 10 : 0)) };
    const merged = mergeRetention([day1, day2]);
    expect(merged.starts).toBe(20);
    const c = retentionCurve([day1, day2])!;
    expect(c.percent[0]).toBe(100);
    expect(c.percent[49]).toBe(100);
    expect(c.percent[50]).toBe(50);
    expect(c.percent[99]).toBe(50);
    expect(c.avgWatchedPct).toBeCloseTo(75);
    expect(c.milestones.find((m) => m.at === 25)?.pct).toBe(100);
    expect(c.milestones.find((m) => m.at === 75)?.pct).toBe(50);
    expect(c.milestones.find((m) => m.at === 100)?.pct).toBe(50);
    expect(c.lowSample).toBe(true);
  });

  it("returns null without starts, clamps at 100% and skips malformed rows", () => {
    expect(retentionCurve([])).toBeNull();
    expect(retentionCurve([{ started: 0, retention: new Array<number>(100).fill(0) }])).toBeNull();
    const c = retentionCurve([{ started: 2, retention: new Array<number>(100).fill(5) }, { started: 9, retention: [1, 2] }])!;
    expect(c.starts).toBe(2);
    expect(Math.max(...c.percent)).toBe(100);
  });

  it("builds the typical band only from 3+ videos with enough starts", () => {
    const mk = (reached: number) => retentionCurve([curveOf(reached, 50)])!;
    expect(typicalBand([mk(40), mk(60)])).toBeNull();
    expect(typicalBand([mk(40), mk(60), retentionCurve([curveOf(80, 5)])!])).toBeNull();
    const band = typicalBand([mk(20), mk(60), mk(100)])!;
    expect(band.videos).toBe(3);
    // percent at k=30: curves have 0, 100, 100 -> sorted [0,100,100]: q25 = 50, q75 = 100
    expect(band.lo[30]).toBeCloseTo(50);
    expect(band.hi[30]).toBeCloseTo(100);
    expect(band.lo[0]).toBe(100);
  });

  it("finds the biggest drop over 5% steps", () => {
    const p = new Array<number>(100).fill(100).map((v, k) => (k >= 40 ? 60 : v));
    const d = biggestDrop(p)!;
    expect(d.drop).toBe(40);
    expect(d.at).toBeGreaterThanOrEqual(40);
    expect(d.at).toBeLessThan(45);
    expect(biggestDrop(new Array<number>(100).fill(90))).toBeNull();
  });
});

describe("funnel", () => {
  it("computes pass rates and never divides by an unknown step", () => {
    const steps = buildFunnel([
      { key: "a", label: "A", count: 1000 },
      { key: "b", label: "B", count: 50 },
      { key: "c", label: "C", count: null },
      { key: "d", label: "D", count: 2 },
    ]);
    expect(steps[0].pctOfPrevious).toBe(100);
    expect(steps[1].pctOfPrevious).toBeCloseTo(5);
    expect(steps[2].pctOfPrevious).toBeNull();
    expect(steps[3].pctOfPrevious).toBeNull();
    expect(steps[3].pctOfFirst).toBeCloseTo(0.2);
    expect(biggestLoss(steps)).toEqual({ index: 1, lostPct: 95 });
  });

  it("has no percentage when the first step is missing or zero", () => {
    const steps = buildFunnel([{ key: "a", label: "A", count: null }, { key: "b", label: "B", count: 5 }]);
    expect(steps[0].pctOfPrevious).toBeNull();
    expect(steps[1].pctOfPrevious).toBeNull();
    expect(steps[1].pctOfFirst).toBeNull();
  });
});
