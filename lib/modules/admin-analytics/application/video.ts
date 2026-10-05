/** Analityka filmu: the "Analityka" tab of one film (the "Jakość" tab is getQualityOverview with videoId). */
import type { CompareKey, RangeKey } from "@/lib/modules/admin-overview";
import type { KpiDto, VideoAnalytics } from "../domain/types";
import { buildAnnotations, cached, freshness, guardedTelemetry, kpi, timeSeries, type Availability } from "./common";
import type { AnalyticsDeps } from "./deps";
import { makePeriod } from "./period";
import { hoursOf, playbackSeries, totalsOf } from "./playback-common";
import { buildRetention, loadPlayback } from "./watch";
import type { VideoInfo } from "../infrastructure/ports";

export function getVideoInfo(deps: AnalyticsDeps, key: string): Promise<VideoInfo | null> {
  return deps.app.videoBySlugOrId(key);
}

export function getVideoAnalytics(deps: AnalyticsDeps, video: VideoInfo, input: { range: RangeKey; compare: CompareKey }): Promise<Availability<VideoAnalytics>> {
  return guardedTelemetry(() =>
    cached(deps, `video:${video.id}:${input.range}:${input.compare}`, async () => {
      const period = makePeriod(input.range, input.compare, deps.now());
      const hourly = period.windows.granularity === "hour";
      const fresh = await freshness(deps);
      const [cur, prev, retention, annotations, others] = await Promise.all([
        loadPlayback(deps, period.current, hourly, video.id),
        period.previous ? loadPlayback(deps, period.previous, hourly, video.id) : Promise.resolve(null),
        buildRetention(deps, period, video),
        buildAnnotations(deps, period),
        deps.telemetry!.videoTotals(period.current.fromDay, period.current.toDay, 50),
      ]);
      const first = fresh.firstDay;
      const totals = totalsOf(cur.days);
      const pt = prev && prev.days.length ? totalsOf(prev.days) : null;
      const has = cur.days.length > 0;
      const viewers = has ? cur.days.reduce((a, r) => a + r.visitors, 0) : null;
      const startsAll = others.reduce((a, r) => a + r.started, 0);
      const typical = startsAll > 0 ? Math.min(100, others.reduce((a, r) => a + r.retentionSum, 0) / startsAll) : null;
      const kpis: KpiDto[] = [
        kpi({ key: "views", label: "Obejrzenia", hint: "Starty z co najmniej 10 s oglądania.", value: has ? totals.views : null, format: "int", upIsGood: true }, pt?.views ?? null),
        kpi({ key: "starts", label: "Starty odtwarzania", value: has ? totals.started : null, format: "int", upIsGood: true }, pt?.started ?? null),
        kpi({ key: "watch", label: "Czas oglądania", value: has ? hoursOf(totals.watchMs) : null, unit: "h", format: "one", upIsGood: true }, pt ? hoursOf(pt.watchMs) : null),
        kpi({ key: "viewers", label: "Widzowie", hint: "Suma dobowych unikalnych widzów tego filmu.", value: viewers, format: "int", upIsGood: true }, prev && prev.days.length ? prev.days.reduce((a, r) => a + r.visitors, 0) : null),
        kpi({ key: "avgpct", label: "Śr. % obejrzenia", value: retention ? retention.avgWatchedPct : null, unit: "%", format: "int", upIsGood: true }, null),
        kpi({ key: "complete", label: "Doszło do końca", hint: "Odsetek startów, które obejrzały ostatni procent filmu.", value: retention ? (retention.milestones.find((m) => m.at === 100)?.pct ?? null) : null, unit: "%", format: "int", upIsGood: true }, null),
      ];
      const notes = [
        "Obejrzenie to start z co najmniej 10 s oglądania. Retencja pokazuje, jaki odsetek startów obejrzał dany moment filmu (powtórki liczą się raz).",
        "Dla filmu bez wystarczającej liczby startów wykresy są orientacyjne: ostrzeżenie „Mała próba” pojawia się poniżej 30 startów.",
      ];
      return {
        videoId: video.id,
        title: video.title,
        rangeLabel: period.windows.label,
        compareLabel: period.windows.compareLabel,
        freshness: fresh,
        kpis,
        views: timeSeries(
          period,
          playbackSeries(period, period.current, first, cur.days, cur.hours, (r) => r.views, (r) => r.views),
          prev && period.previous ? playbackSeries(period, period.previous, first, prev.days, prev.hours, (r) => r.views, (r) => r.views) : null,
        ),
        retention,
        typicalAvgPct: typical,
        annotations,
        notes,
      } satisfies VideoAnalytics;
    }),
  );
}
