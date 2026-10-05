import { describe, expect, it } from "vitest";
import {
  getEdgeSnapshot, getFunnel, getQualityOverview, getTrafficOverview, getVideoAnalytics, getWatchOverview, histFromValues, TELEMETRY_OFF_REASON, workerLimitForecast,
} from "@/lib/modules/admin-analytics";
import { parseDurationText } from "@/lib/modules/admin-analytics";
import { deps, fakeApp, fakeTelemetry, NOW, playbackDay, VIDEO_A, VIDEO_B } from "./fakes";

const days7 = ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"];
const prev7 = ["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28"];

describe("traffic overview (B1-B3)", () => {
  const traffic = [
    ...days7.map((day, i) => ({ day, pageviews: 100 + i * 10, visitors: 40 + i })),
    ...prev7.map((day) => ({ day, pageviews: 80, visitors: 30 })),
  ];
  const base = () =>
    fakeTelemetry({
      trafficDaily: traffic,
      trafficExtra: days7.map((day) => ({ day, visitors: 40, singleViewVisitors: 10 })),
      dimensions: {
        referrer: [{ value: "(direct)", pageviews: 200, visitors: 180 }, { value: "google.com", pageviews: 90, visitors: 70 }],
        country: [{ value: "PL", pageviews: 300, visitors: 250 }, { value: "??", pageviews: 5, visitors: 5 }],
        utm_source: [],
      },
      playbackDaily: days7.map((day) => playbackDay(day, { views: 3 })),
      deploys: [{ at: new Date("2026-10-02T08:00:00Z"), job: "deploy", detail: "abc123 (ghcr): ok" }],
    });

  it("sums the daily numbers, compares with the previous period and annotates deploys", async () => {
    const r = await getTrafficOverview(deps(base(), fakeApp({ published: [{ at: new Date("2026-10-04T18:00:00Z"), title: "Kulisy" }] })), { range: "7d", compare: "prev" });
    expect(r.available).toBe(true);
    if (!r.available) return;
    const k = Object.fromEntries(r.data.kpis.map((x) => [x.key, x]));
    expect(k.visitors.value).toBe(40 + 41 + 42 + 43 + 44 + 45 + 46);
    expect(k.visitors.previous).toBe(210);
    expect(k.pageviews.value).toBe(100 + 110 + 120 + 130 + 140 + 150 + 160);
    expect(k.pageviews.previous).toBe(560);
    expect(k.single.value).toBeCloseTo(25);
    expect(k.views.value).toBe(21);
    expect(r.data.visitors.current).toEqual([40, 41, 42, 43, 44, 45, 46]);
    expect(r.data.visitors.previous).toEqual(new Array(7).fill(30));
    expect(r.data.sources[0]).toMatchObject({ label: "Bezpośrednio lub bez strony odsyłającej", value: 180 });
    expect(r.data.countries.map((c) => c.label)).toEqual(["Polska", "Nieznany"]);
    expect(r.data.annotations.map((a) => a.kind)).toEqual(["deploy", "publish"]);
    expect(r.data.annotations[0].index).toBe(3);
    expect(r.data.edgeCheck.available).toBe(false);
  });

  it("shows no comparison when it is switched off", async () => {
    const r = await getTrafficOverview(deps(base()), { range: "7d", compare: "none" });
    if (!r.available) throw new Error("expected data");
    expect(r.data.visitors.previous).toBeNull();
    expect(r.data.kpis.every((x) => x.previous === null)).toBe(true);
  });

  it("marks days before the first telemetry as 'bez pomiaru' and refuses a partial comparison", async () => {
    const t = fakeTelemetry({ firstDay: "2026-10-03", trafficDaily: traffic.filter((r) => r.day >= "2026-10-03") });
    const r = await getTrafficOverview(deps(t), { range: "7d", compare: "prev" });
    if (!r.available) throw new Error("expected data");
    expect(r.data.visitors.current.slice(0, 4)).toEqual([null, null, null, null]);
    expect(r.data.visitors.current.slice(4)).toEqual([44, 45, 46]);
    const visitors = r.data.kpis.find((x) => x.key === "visitors")!;
    expect(visitors.value).toBeNull();
    expect(visitors.previous).toBeNull();
    expect(r.data.notes.some((n) => n.includes("dni sprzed pierwszego pomiaru"))).toBe(true);
  });

  it("'Dziś' is hourly; visitors are not compared hour by hour, page views are", async () => {
    const h = (iso: string, pageviews: number, visitors: number) => ({ hour: new Date(iso), pageviews, visitors });
    const t = fakeTelemetry({
      trafficDaily: [{ day: "2026-10-05", pageviews: 30, visitors: 12 }, { day: "2026-09-28", pageviews: 500, visitors: 100 }],
      trafficHourly: [h("2026-10-04T22:00:00Z", 10, 5), h("2026-10-04T23:00:00Z", 20, 8), h("2026-09-27T22:00:00Z", 6, 3), h("2026-09-27T23:00:00Z", 4, 2)],
    });
    const r = await getTrafficOverview(deps(t), { range: "today", compare: "prev" });
    if (!r.available) throw new Error("expected data");
    expect(r.data.granularity).toBe("hour");
    expect(r.data.visitors.current.slice(0, 2)).toEqual([5, 8]);
    expect(r.data.visitors.previous?.slice(0, 2)).toEqual([3, 2]);
    const k = Object.fromEntries(r.data.kpis.map((x) => [x.key, x]));
    expect(k.visitors.value).toBe(12);
    expect(k.visitors.previous).toBeNull();
    expect(k.pageviews.value).toBe(30);
    expect(k.pageviews.previous).toBe(10);
  });

  it("cross-checks own page views against Cloudflare document requests", async () => {
    const snap = (documentRequests: number) => ({ "cloudflare:edge_www_daily": { fetchedAt: new Date("2026-10-05T09:45:00Z"), payload: { day: "2026-10-03", documentRequests } } });
    const ok = await getTrafficOverview(deps(fakeTelemetry({ trafficDaily: traffic, snapshots: snap(160) })), { range: "7d", compare: "none" });
    const bad = await getTrafficOverview(deps(fakeTelemetry({ trafficDaily: traffic, snapshots: snap(1000) })), { range: "7d", compare: "none" });
    if (!ok.available || !bad.available) throw new Error("expected data");
    expect(ok.data.edgeCheck).toMatchObject({ available: true, ownPageviews: 140, edgeRequests: 160, withinTolerance: true });
    expect(bad.data.edgeCheck).toMatchObject({ available: true, withinTolerance: false });
  });

  it("says why when telemetry is not connected or fails, never returns zeros", async () => {
    const off = await getTrafficOverview(deps(null), { range: "7d", compare: "prev" });
    expect(off).toEqual({ available: false, reason: TELEMETRY_OFF_REASON });
    const broken = fakeTelemetry();
    broken.coverage = async () => { throw new Error("connection refused"); };
    const r = await getTrafficOverview(deps(broken), { range: "7d", compare: "prev" });
    expect(r.available).toBe(false);
    if (!r.available) expect(r.reason).toContain("Odczyt telemetrii nie powiódł się");
  });
});

describe("quality overview (C7-C10)", () => {
  const hist = histFromValues([300, 400, 600, 900, 1200, 1800, 2500, 3500, 5000, 7000]);
  const rows = days7.map((day) =>
    playbackDay(day, {
      attempts: 40, started: 36, exitsBeforeStart: 4, errors: 2, fatalErrors: 1, watchMs: 900_000, rebufferMs: 100_000, rebufferCount: 9, rebufferedAttempts: 6,
      startupN: 10, startupScoreSum: 10 * 80, smoothnessSum: 36 * 90, smoothnessN: 36, bitrateSum: 36 * 2000, bitrateN: 36, switches: 18, startupHist: hist, views: 30,
    }),
  );

  it("merges histograms for p50/p95, averages the per-attempt scores and lists error classes and the ladder", async () => {
    const t = fakeTelemetry({
      playbackDaily: [...rows, ...prev7.map((day) => playbackDay(day, { attempts: 10, started: 10, startupN: 10, startupHist: histFromValues([300, 300, 300, 300, 300, 300, 300, 300, 300, 500]) }))],
      errors: [{ code: "hls:networkError:manifestLoadError", attempts: 9, fatal: 3 }],
      ladder: [{ height: 480, attempts: 100 }, { height: 720, attempts: 100 }],
    });
    const r = await getQualityOverview(deps(t), { range: "7d", compare: "prev" });
    if (!r.available) throw new Error("expected data");
    const d = r.data;
    expect(d.summary.attempts).toBe(280);
    expect(d.summary.sample).toBe("ok");
    expect(d.summary.exitBeforeStartPct).toBeCloseTo(10);
    expect(d.summary.errorPct).toBeCloseTo(5);
    expect(d.summary.rebufferPct).toBeCloseTo(10);
    expect(d.summary.startupScore).toBeCloseTo(80);
    expect(d.startupN).toBe(70);
    expect(d.startupP95Ms).toBeGreaterThan(d.startupP50Ms!);
    expect(d.startupP95PreviousMs).toBeLessThan(d.startupP95Ms!);
    expect(d.startupP95Series.current).toHaveLength(7);
    expect(d.startupP95Series.current.every((v) => v !== null && v > 0)).toBe(true);
    expect(d.errorRateSeries.current[0]).toBeCloseTo(5);
    expect(d.errors[0]).toMatchObject({ label: "Odtwarzacz HLS, sieć: manifestLoadError", attempts: 9, fatal: 3 });
    expect(d.ladder.map((l) => [l.label, l.share])).toEqual([["do 480p", 50], ["do 720p", 50]]);
  });

  it("warns about a small sample and reports 'bez pomiaru' when nothing was played", async () => {
    const small = await getQualityOverview(deps(fakeTelemetry({ playbackDaily: [playbackDay("2026-10-05", { attempts: 9, started: 9, startupN: 9, startupHist: histFromValues([500]) })] })), { range: "7d", compare: "none" });
    if (!small.available) throw new Error("expected data");
    expect(small.data.summary.sample).toBe("low");
    expect(small.data.notes[0]).toContain("Mała próba: n = 9");
    // days without any attempt have nothing to compute a percentile from: null, never 0
    expect(small.data.startupP95Series.current.slice(0, 6).every((v) => v === null)).toBe(true);

    const none = await getQualityOverview(deps(fakeTelemetry()), { range: "7d", compare: "none" });
    if (!none.available) throw new Error("expected data");
    expect(none.data.summary.sample).toBe("none");
    expect(none.data.summary.experienceScore).toBeNull();
    expect(none.data.startupP95Ms).toBeNull();
    expect(none.data.notes[0]).toContain("Bez pomiaru");
  });

  it("widens 'Dziś' to 7 days and says so", async () => {
    const r = await getQualityOverview(deps(fakeTelemetry()), { range: "today", compare: "none" });
    if (!r.available) throw new Error("expected data");
    expect(r.data.startupP95Series.labels).toHaveLength(7);
    expect(r.data.notes.some((n) => n.includes("ostatnie 7 dni"))).toBe(true);
  });

  it("filters by film", async () => {
    const t = fakeTelemetry({ playbackDaily: [{ ...playbackDay("2026-10-05", { attempts: 50, started: 50 }), videoId: "va" }, { ...playbackDay("2026-10-05", { attempts: 70, started: 70 }), videoId: "vb" }] });
    const r = await getQualityOverview(deps(t), { range: "7d", compare: "none", videoId: "vb" });
    if (!r.available) throw new Error("expected data");
    expect(r.data.summary.attempts).toBe(70);
  });
});

describe("watching and retention (C1, C2, per film)", () => {
  const ret = (reached: number, started: number) => new Array<number>(100).fill(0).map((_, k) => (k < reached ? started : 0));
  const tel = () =>
    fakeTelemetry({
      playbackDaily: days7.map((day) => ({ ...playbackDay(day, { attempts: 40, started: 36, views: 30, watchMs: 3_600_000, visitors: 20 }), videoId: "va" })),
      videoTotals: [
        { videoId: "va", attempts: 280, started: 252, views: 210, watchMs: 25_200_000, retentionSum: 252 * 60 },
        { videoId: "vb", attempts: 100, started: 90, views: 70, watchMs: 3_600_000, retentionSum: 90 * 40 },
      ],
      retentionDays: [{ videoId: "va", day: "2026-10-05", started: 60, retention: ret(100, 60).map((v, k) => (k < 50 ? 60 : 30 * (k < 100 ? 1 : 0))) }],
      retentionByVideo: [
        { videoId: "vb", started: 90, retention: ret(40, 90) },
        { videoId: "vc", started: 80, retention: ret(60, 80) },
        { videoId: "vd", started: 70, retention: ret(80, 70) },
        { videoId: "ve", started: 3, retention: ret(10, 3) },
      ],
    });
  const app = fakeApp({ videos: [VIDEO_A, VIDEO_B] });

  it("totals, per-film table, retention of the top film and the band of the others", async () => {
    const r = await getWatchOverview(deps(tel(), app), { range: "7d", compare: "none" });
    if (!r.available) throw new Error("expected data");
    const k = Object.fromEntries(r.data.kpis.map((x) => [x.key, x]));
    expect(k.views.value).toBe(210);
    expect(k.starts.value).toBe(252);
    expect(k.watch.value).toBe(7);
    expect(k.viewers.value).toBe(140);
    expect(r.data.videos[0]).toMatchObject({ title: "Cześć", slug: "czesc", views: 210, avgWatchedPct: 60 });
    expect(r.data.typicalAvgPct).toBeCloseTo((252 * 60 + 90 * 40) / 342);
    expect(r.data.retention?.title).toBe("Cześć");
    expect(r.data.retention?.percent[0]).toBe(100);
    expect(r.data.retention?.percent[60]).toBe(50);
    expect(r.data.retention?.band?.videos).toBe(3); // the film with 3 starts is not enough
    expect(r.data.views.current).toEqual(new Array(7).fill(30));
  });

  it("selects the film by slug and reports no curve without starts", async () => {
    const r = await getWatchOverview(deps(tel(), app), { range: "7d", compare: "none", video: "kulisy" });
    if (!r.available) throw new Error("expected data");
    expect(r.data.retention).toBeNull();
  });

  it("per-film analytics", async () => {
    const r = await getVideoAnalytics(deps(tel(), app), VIDEO_A, { range: "7d", compare: "prev" });
    if (!r.available) throw new Error("expected data");
    const k = Object.fromEntries(r.data.kpis.map((x) => [x.key, x]));
    expect(k.views.value).toBe(210);
    expect(k.viewers.value).toBe(140);
    expect(k.complete.value).toBe(50);
    expect(r.data.retention?.durationSeconds).toBe(600);
    expect(r.data.views.previous).toHaveLength(7);
  });
});

describe("funnel (B6, B7)", () => {
  const app = fakeApp({
    cohort: { accounts: 20, commenters: 8, tippers: 2 },
    accounts: [new Date("2026-10-05T07:00:00Z"), new Date("2026-10-03T07:00:00Z")],
    payments: [new Date("2026-10-04T07:00:00Z")],
  });

  it("builds a cohort funnel from database counts and says attribution is not measured", async () => {
    const t = fakeTelemetry({ trafficDaily: [{ day: "2026-10-05", pageviews: 900, visitors: 400 }] });
    const r = await getFunnel(deps(t, app), { range: "7d", compare: "prev" });
    if (!r.available) throw new Error("expected data");
    expect(r.data.steps.map((s) => s.count)).toEqual([400, 20, 8, 2]);
    expect(r.data.steps[1].pctOfPrevious).toBeCloseTo(5);
    expect(r.data.steps[3].pctOfPrevious).toBeCloseTo(25);
    expect(r.data.sample).toBe("low");
    expect(r.data.attribution.available).toBe(false);
    expect(r.data.accounts.current.reduce((a, v) => a + (v ?? 0), 0)).toBe(2);
    expect(r.data.tips.current.reduce((a, v) => a + (v ?? 0), 0)).toBe(1);
    expect(r.data.lossHint).toContain("Nowe konta");
  });

  it("keeps the database steps when telemetry is off, with the first step 'bez pomiaru'", async () => {
    const r = await getFunnel(deps(null, app), { range: "28d", compare: "none" });
    if (!r.available) throw new Error("expected data");
    expect(r.data.steps[0].count).toBeNull();
    expect(r.data.steps[1].count).toBe(20);
    expect(r.data.steps[1].pctOfPrevious).toBeNull();
  });
});

describe("edge snapshots (C14, C15)", () => {
  it("is 'bez pomiaru' until a collector writes snapshots", async () => {
    const r = await getEdgeSnapshot(deps(fakeTelemetry()));
    expect(r.available).toBe(false);
    if (!r.available) expect(r.reason).toContain("external_snapshot");
  });

  it("reads valid payloads and ignores malformed ones", async () => {
    const t = fakeTelemetry({
      snapshots: {
        "cloudflare:hls_worker_hourly": { fetchedAt: new Date("2026-10-05T09:45:00Z"), payload: { day: "2026-10-05", requests: 60_000, hourly: [{ hour: "07", requests: 6000 }, { hour: "08", requests: 9000 }, { hour: "09", requests: 12_000 }] } },
        "cloudflare:edge_video_daily": { fetchedAt: new Date("2026-10-05T09:45:00Z"), payload: { nonsense: true } },
      },
    });
    const r = await getEdgeSnapshot(deps(t));
    if (!r.available) throw new Error("expected data");
    expect(r.workerRequests).toBe(60_000);
    expect(r.cacheHitPct).toBeNull();
    const f = workerLimitForecast(r, new Date("2026-10-05T10:00:00Z"))!;
    expect(f.used).toBe(60_000);
    // remaining 40 000 at 9 000/h = 4.44 h: runs out at ~14:27 UTC, before the end of the day
    expect(f.exhaustAt?.toISOString().slice(0, 13)).toBe("2026-10-05T14");
  });
});

describe("helpers", () => {
  it("parses film durations", () => {
    expect(parseDurationText("12:45")).toBe(765);
    expect(parseDurationText("1:02:03")).toBe(3723);
    expect(parseDurationText("abc")).toBeNull();
    expect(parseDurationText(null)).toBeNull();
  });
});
