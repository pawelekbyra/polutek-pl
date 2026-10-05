/**
 * Oglądalność (C1 obejrzenia, C2 czas oglądania) with the retention curve of one film and the table of films.
 * A "view" = a started attempt with >= 10 s watched (the site's own definition). Retention: see domain/retention.ts.
 */
import type { CompareKey, RangeKey } from "@/lib/modules/admin-overview";
import { biggestDrop, retentionCurve, typicalBand, type RetentionCurve } from "../domain/retention";
import { sampleLevel } from "../domain/qoe";
import type { KpiDto, RetentionDto, VideoRow, WatchOverview } from "../domain/types";
import { buildAnnotations, cached, freshness, guardedTelemetry, kpi, needTelemetry, timeSeries, type Availability } from "./common";
import type { AnalyticsDeps } from "./deps";
import { makePeriod, type Period, type Side } from "./period";
import { hoursOf, playbackSeries, totalsOf } from "./playback-common";
import type { PlaybackDayRow, PlaybackHourRow, VideoInfo } from "../infrastructure/ports";

export async function loadPlayback(deps: AnalyticsDeps, side: Side, hourly: boolean, videoId?: string): Promise<{ days: PlaybackDayRow[]; hours: PlaybackHourRow[] }> {
  const t = needTelemetry(deps);
  const [days, hours] = await Promise.all([t.playbackDaily(side.fromDay, side.toDay, videoId), hourly ? t.playbackHourly(side.from, side.to, videoId) : Promise.resolve([])]);
  return { days, hours };
}

export function retentionDto(video: { id: string; title: string; durationSeconds: number | null }, curve: RetentionCurve, band: RetentionDto["band"]): RetentionDto {
  return {
    videoId: video.id,
    title: video.title,
    starts: curve.starts,
    lowSample: curve.lowSample,
    percent: curve.percent,
    avgWatchedPct: curve.avgWatchedPct,
    milestones: curve.milestones,
    band,
    biggestDrop: biggestDrop(curve.percent),
    durationSeconds: video.durationSeconds,
  };
}

/** Retention of one film for the period plus the band of the other films' typical retention. */
export async function buildRetention(deps: AnalyticsDeps, period: Period, video: VideoInfo): Promise<RetentionDto | null> {
  const t = needTelemetry(deps);
  const { fromDay, toDay } = period.current;
  const [rows, others] = await Promise.all([t.retentionDays(video.id, fromDay, toDay), t.retentionByVideo(fromDay, toDay, 50)]);
  const curve = retentionCurve(rows);
  if (!curve) return null;
  const otherCurves = others
    .filter((o) => o.videoId !== video.id)
    .flatMap((o) => {
      const c = retentionCurve([{ started: o.started, retention: o.retention }]);
      return c ? [c] : [];
    });
  return retentionDto(video, curve, typicalBand(otherCurves));
}

export function getWatchOverview(deps: AnalyticsDeps, input: { range: RangeKey; compare: CompareKey; video?: string }): Promise<Availability<WatchOverview>> {
  return guardedTelemetry(() =>
    cached(deps, `watch:${input.range}:${input.compare}:${input.video ?? ""}`, async () => {
      const t = needTelemetry(deps);
      const period = makePeriod(input.range, input.compare, deps.now());
      const hourly = period.windows.granularity === "hour";
      const fresh = await freshness(deps);
      const [cur, prev, totalsRows, annotations] = await Promise.all([
        loadPlayback(deps, period.current, hourly),
        period.previous ? loadPlayback(deps, period.previous, hourly) : Promise.resolve(null),
        t.videoTotals(period.current.fromDay, period.current.toDay, 50),
        buildAnnotations(deps, period),
      ]);
      const first = fresh.firstDay;
      const viewsCur = playbackSeries(period, period.current, first, cur.days, cur.hours, (r) => r.views, (r) => r.views);
      const hoursCur = playbackSeries(period, period.current, first, cur.days, cur.hours, (r) => hoursOf(r.watchMs), (r) => hoursOf(r.watchMs));
      const viewsPrev = prev && period.previous ? playbackSeries(period, period.previous, first, prev.days, prev.hours, (r) => r.views, (r) => r.views) : null;
      const hoursPrev = prev && period.previous ? playbackSeries(period, period.previous, first, prev.days, prev.hours, (r) => hoursOf(r.watchMs), (r) => hoursOf(r.watchMs)) : null;

      const totals = totalsOf(cur.days);
      const prevTotals = prev ? totalsOf(prev.days) : null;
      const has = cur.days.length > 0;
      const visitors = has ? cur.days.reduce((a, r) => a + r.visitors, 0) : null;
      const visitorsPrev = prev && prev.days.length > 0 ? prev.days.reduce((a, r) => a + r.visitors, 0) : null;

      const infos = await deps.app.videosByIds(totalsRows.map((r) => r.videoId));
      const byId = new Map(infos.map((i) => [i.id, i]));
      const videos: VideoRow[] = totalsRows.map((r) => ({
        videoId: r.videoId,
        title: byId.get(r.videoId)?.title ?? "Film usunięty lub nieznany",
        slug: byId.get(r.videoId)?.slug ?? null,
        starts: r.started,
        views: r.views,
        watchHours: hoursOf(r.watchMs),
        avgWatchedPct: r.started > 0 ? Math.min(100, r.retentionSum / r.started) : null,
        attempts: r.attempts,
        sample: sampleLevel(r.attempts),
      }));
      const startsAll = totalsRows.reduce((a, r) => a + r.started, 0);
      const typicalAvgPct = startsAll > 0 ? Math.min(100, totalsRows.reduce((a, r) => a + r.retentionSum, 0) / startsAll) : null;

      let retention: RetentionDto | null = null;
      const pick = input.video ? await deps.app.videoBySlugOrId(input.video) : (infos.find((i) => i.id === totalsRows[0]?.videoId) ?? null);
      if (pick) retention = await buildRetention(deps, period, pick);

      const kpis: KpiDto[] = [
        kpi({ key: "views", label: "Obejrzenia", hint: "Starty z co najmniej 10 s oglądania (jak licznik wyświetleń strony).", value: has ? totals.views : null, format: "int", upIsGood: true }, prevTotals && prev && prev.days.length ? prevTotals.views : null),
        kpi({ key: "starts", label: "Starty odtwarzania", hint: "Próby odtworzenia, w których pojawiła się pierwsza klatka.", value: has ? totals.started : null, format: "int", upIsGood: true }, prevTotals && prev && prev.days.length ? prevTotals.started : null),
        kpi({ key: "watch", label: "Czas oglądania", value: has ? hoursOf(totals.watchMs) : null, unit: "h", format: "one", upIsGood: true }, prevTotals && prev && prev.days.length ? hoursOf(prevTotals.watchMs) : null),
        kpi({ key: "viewers", label: "Widzowie", hint: "Suma dobowych unikalnych widzów (dzienny solony skrót, bez ciasteczek).", value: visitors, format: "int", upIsGood: true }, visitorsPrev),
        kpi({ key: "avgpct", label: "Śr. % obejrzenia", hint: "Średnia część filmu obejrzana w jednej próbie (z krzywej retencji).", value: typicalAvgPct, unit: "%", format: "int", upIsGood: true }, null),
      ];

      const notes = [
        "Obejrzenie to start z co najmniej 10 s oglądania, tak jak licznik wyświetleń na stronie. Próba, która zaczęła się przed północą, jest liczona w dwóch dobach.",
        "Retencja: odsetek startów, w których widz obejrzał dany procent filmu (powtórki tego samego fragmentu liczą się raz). Szare pasmo to środek (25.–75. percentyl) innych filmów kanału, widoczne od 3 filmów z co najmniej 30 startami.",
      ];
      if (hourly) notes.push("Dla „Dziś” wykresy są godzinowe: próba należy do godziny pierwszego sygnału.");
      if (fresh.coverageDays > 0 && fresh.coverageDays < 7) notes.push(`Telemetria zbiera od ${fresh.coverageDays} dni: wcześniejsze dni są „bez pomiaru”.`);

      return {
        rangeLabel: period.windows.label,
        compareLabel: period.windows.compareLabel,
        freshness: fresh,
        kpis,
        views: timeSeries(period, viewsCur, viewsPrev),
        watchHours: timeSeries(period, hoursCur, hoursPrev),
        videos,
        typicalAvgPct,
        retention,
        annotations,
        notes,
      } satisfies WatchOverview;
    }),
  );
}
