/**
 * Jakość odtwarzania (C7 czas startu p50/p95, C8 wyjścia przed startem, C9 błędy, C10 buforowanie i rendycje),
 * channel-wide or for one film. Per day, so "Dziś" widens to 7 days (and says so). Formulas: domain/qoe.ts.
 */
import type { CompareKey, RangeKey } from "@/lib/modules/admin-overview";
import { histPercentile, histTotal } from "../domain/histogram";
import { errorClassLabel, ladderLabel, lowSampleText, summarizeQoe } from "../domain/qoe";
import { seriesOf } from "../domain/series";
import type { QualityOverview } from "../domain/types";
import { buildAnnotations, cached, freshness, guardedTelemetry, needTelemetry, timeSeries, type Availability } from "./common";
import type { AnalyticsDeps } from "./deps";
import { dailyRange, makePeriod, type Period } from "./period";
import { histOfRows, totalsOf } from "./playback-common";
import type { PlaybackDayRow } from "../infrastructure/ports";

function perDay(period: Period, side: "current" | "previous", firstDay: string | null, rows: PlaybackDayRow[], pick: (r: PlaybackDayRow) => number | null): (number | null)[] {
  const s = side === "current" ? period.current : period.previous;
  if (!s) return [];
  const base = seriesOf("day", s.buckets, rows, (r) => r.day, () => 0, firstDay);
  const byDay = new Map(rows.map((r) => [r.day, r]));
  // A covered day without attempts has nothing to compute a percentile from: null ("bez pomiaru"), not 0.
  return s.buckets.map((b, i) => (base[i] === null ? null : (byDay.has(b.key) ? pick(byDay.get(b.key)!) : null)));
}

export function getQualityOverview(deps: AnalyticsDeps, input: { range: RangeKey; compare: CompareKey; videoId?: string }): Promise<Availability<QualityOverview>> {
  const eff = dailyRange(input.range);
  return guardedTelemetry(() =>
    cached(deps, `quality:${eff.range}:${input.compare}:${input.videoId ?? ""}`, async () => {
      const t = needTelemetry(deps);
      const period = makePeriod(eff.range, input.compare, deps.now());
      const fresh = await freshness(deps);
      const { fromDay, toDay } = period.current;
      const [curRows, prevRows, errors, ladder, annotations] = await Promise.all([
        t.playbackDaily(fromDay, toDay, input.videoId),
        period.previous ? t.playbackDaily(period.previous.fromDay, period.previous.toDay, input.videoId) : Promise.resolve(null),
        t.errorClasses(fromDay, toDay, input.videoId, 8),
        t.ladder(fromDay, toDay, input.videoId),
        buildAnnotations(deps, period),
      ]);
      const totals = totalsOf(curRows);
      const summary = summarizeQoe(totals);
      const hist = histOfRows(curRows);
      const prevSummary = prevRows && prevRows.length ? summarizeQoe(totalsOf(prevRows)) : null;
      const prevHist = prevRows ? histOfRows(prevRows) : null;
      const first = fresh.firstDay;
      const p95Day = (r: PlaybackDayRow) => (r.startupN > 0 ? (histPercentile(r.startupHist, 0.95) ?? null) : null);
      const errDay = (r: PlaybackDayRow) => (r.attempts > 0 ? (100 * r.errors) / r.attempts : null);
      const ladderTotal = ladder.reduce((a, r) => a + r.attempts, 0);

      const notes = [
        "Czas startu: od żądania odtworzenia do pierwszej klatki. Percentyle czytamy ze zsumowanego histogramu (13 przedziałów), więc są dokładne do szerokości przedziału.",
        "Wynik startu to 8/(8+s)·100 i wynik płynności to średnia z 1/√(1+(przerwy/2)²) oraz e^(−10·udział buforowania), według definicji Mux Data, uśredniane po próbach. Wynik ogólny to nasza średnia z trzech wyników (start, płynność, brak błędu krytycznego); wagi Mux są inne.",
        "Rendycja to najwyższa wysokość obrazu, jaką osiągnęła próba (nie czas oglądania w każdej jakości: odtwarzacz tego nie raportuje).",
      ];
      if (eff.widened) notes.push("Jakość liczymy na dobach, więc przy okresie „Dziś” pokazano ostatnie 7 dni.");
      if (summary.sample !== "ok") notes.unshift(summary.sample === "none" ? "Bez pomiaru: w tym okresie nie było prób odtwarzania." : lowSampleText(summary.attempts));
      if (hist.length && histTotal(hist) > 0 && histTotal(hist) < 20) notes.push("Percentyl p95 przy mniej niż 20 startach jest tylko orientacyjny.");

      return {
        rangeLabel: period.windows.label,
        compareLabel: period.windows.compareLabel,
        freshness: fresh,
        summary,
        previousSummary: prevSummary,
        startupP50Ms: histPercentile(hist, 0.5),
        startupP95Ms: histPercentile(hist, 0.95),
        startupP95PreviousMs: prevHist ? histPercentile(prevHist, 0.95) : null,
        startupN: totals.startupN,
        startupP95Series: timeSeries(period, perDay(period, "current", first, curRows, p95Day), prevRows ? perDay(period, "previous", first, prevRows, p95Day) : null),
        errorRateSeries: timeSeries(period, perDay(period, "current", first, curRows, errDay), prevRows ? perDay(period, "previous", first, prevRows, errDay) : null),
        errors: errors.map((e) => ({ code: e.code, label: errorClassLabel(e.code), attempts: e.attempts, fatal: e.fatal, share: totals.attempts > 0 ? (100 * e.attempts) / totals.attempts : 0 })),
        ladder: ladder.map((l) => ({ height: l.height, label: ladderLabel(l.height), attempts: l.attempts, share: ladderTotal > 0 ? (100 * l.attempts) / ladderTotal : 0 })),
        switchesPerAttempt: summary.switchesPerAttempt,
        avgBitrateKbps: summary.avgBitrateKbps,
        annotations,
        notes,
      } satisfies QualityOverview;
    }),
  );
}
