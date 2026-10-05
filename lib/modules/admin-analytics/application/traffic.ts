/**
 * Ruch i źródła (B1-B3): visitors, page views, sources, countries from the traffic rollups.
 * Definitions: docs/architecture/admin-phaseA.md. "Odwiedzający" is the sum of DAILY unique visitors
 * (a daily-salted hash, no cookies), so a person who returns on two days counts twice.
 */
import { warsawDayKey, type CompareKey, type RangeKey } from "@/lib/modules/admin-overview";
import { hourRowKey, seriesOf, totalOf } from "../domain/series";
import type { EdgeCheck, KpiDto, TrafficOverview } from "../domain/types";
import { buildAnnotations, cached, freshness, guardedTelemetry, kpi, needTelemetry, ranked, ratio, timeSeries, type Availability } from "./common";
import type { AnalyticsDeps } from "./deps";
import { edgeWwwDay } from "./edge";
import { makePeriod, type Side } from "./period";
import type { PlaybackDayRow, TrafficDayRow, TrafficExtraRow, TrafficHourRow } from "../infrastructure/ports";

const SOURCE_DIRECT = "Bezpośrednio lub bez strony odsyłającej";

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["pl"], { type: "region" });
  } catch {
    return null;
  }
})();

export function countryLabel(code: string): string {
  if (code === "??" || !/^[A-Z]{2}$/.test(code)) return "Nieznany";
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

export function sourceLabel(host: string): string {
  return host === "(direct)" ? SOURCE_DIRECT : host;
}

type SideData = { hourly: TrafficHourRow[]; daily: TrafficDayRow[]; extra: TrafficExtraRow[]; playback: PlaybackDayRow[] };

async function loadSide(deps: AnalyticsDeps, side: Side, hourly: boolean): Promise<SideData> {
  const t = needTelemetry(deps);
  const [h, daily, extra, playback] = await Promise.all([
    hourly ? t.trafficHourly(side.from, side.to) : Promise.resolve([]),
    t.trafficDaily(side.fromDay, side.toDay),
    t.trafficExtra(side.fromDay, side.toDay),
    t.playbackDaily(side.fromDay, side.toDay),
  ]);
  return { hourly: h, daily, extra, playback };
}

export function getTrafficOverview(deps: AnalyticsDeps, input: { range: RangeKey; compare: CompareKey }): Promise<Availability<TrafficOverview>> {
  return guardedTelemetry(() =>
    cached(deps, `traffic:${input.range}:${input.compare}`, async () => {
      const t = needTelemetry(deps);
      const period = makePeriod(input.range, input.compare, deps.now());
      const hourly = period.windows.granularity === "hour";
      const fresh = await freshness(deps);
      const [cur, prev, annotations] = await Promise.all([
        loadSide(deps, period.current, hourly),
        period.previous ? loadSide(deps, period.previous, hourly) : Promise.resolve(null),
        buildAnnotations(deps, period),
      ]);
      const g = period.windows.granularity;
      const first = fresh.firstDay;
      const series = (side: Side, d: SideData, pick: "pageviews" | "visitors") =>
        hourly
          ? seriesOf(g, side.buckets, d.hourly, (r) => hourRowKey(r.hour), (r) => r[pick], first)
          : seriesOf(g, side.buckets, d.daily, (r) => r.day, (r) => r[pick], first);
      const curV = series(period.current, cur, "visitors");
      const curP = series(period.current, cur, "pageviews");
      const prevV = prev && period.previous ? series(period.previous, prev, "visitors") : null;
      const prevP = prev && period.previous ? series(period.previous, prev, "pageviews") : null;

      // Totals come from the DAILY rows (exact distinct visitors); in "today" mode the comparison of visitors is
      // not offered (a full day last week against a part of today), page views are compared hour by hour.
      const dailyTotals = (side: Side, d: SideData, pick: "pageviews" | "visitors") =>
        totalOf(seriesOf("day", dayBuckets(side), d.daily, (r) => r.day, (r) => r[pick], first));
      const visitors = dailyTotals(period.current, cur, "visitors");
      const visitorsPrev = hourly || !prev || !period.previous ? null : dailyTotals(period.previous, prev, "visitors");
      const pageviews = hourly ? totalOf(curP) : dailyTotals(period.current, cur, "pageviews");
      const pageviewsPrev = !prev || !period.previous ? null : hourly ? totalOf(prevP ?? []) : dailyTotals(period.previous, prev, "pageviews");

      const extraSum = (rows: TrafficExtraRow[]) => ({ single: rows.reduce((a, r) => a + r.singleViewVisitors, 0), visitors: rows.reduce((a, r) => a + r.visitors, 0) });
      const e = extraSum(cur.extra);
      const ep = prev ? extraSum(prev.extra) : null;
      const bouncePct = e.visitors > 0 ? (100 * e.single) / e.visitors : null;
      const bouncePrev = ep && ep.visitors > 0 && !hourly ? (100 * ep.single) / ep.visitors : null;
      const views = sumViews(cur.playback);
      const viewsPrev = prev ? sumViews(prev.playback) : null;

      const kpis: KpiDto[] = [
        kpi({ key: "visitors", label: "Odwiedzający", hint: "Suma dobowych unikalnych odwiedzających (dzienny solony skrót, bez ciasteczek). Ta sama osoba w dwóch dobach liczy się dwa razy.", value: visitors, format: "int", upIsGood: true }, visitorsPrev),
        kpi({ key: "pageviews", label: "Odsłony", value: pageviews, format: "int", upIsGood: true }, pageviewsPrev),
        kpi({ key: "depth", label: "Odsłon na odwiedzającego", value: ratio(pageviews, visitors), format: "one", upIsGood: true }, ratio(pageviewsPrev, visitorsPrev)),
        kpi({ key: "single", label: "Tylko jedna odsłona", hint: "Odsetek odwiedzających z jedną odsłoną w dobie. To zastępnik „odrzuceń”: bez ciasteczek nie ma sesji.", value: bouncePct, format: "pct", upIsGood: false }, bouncePrev),
        kpi({ key: "views", label: "Obejrzenia", hint: "Starty odtwarzania z co najmniej 10 s oglądania (jak licznik wyświetleń strony).", value: views, format: "int", upIsGood: true }, viewsPrev),
      ];

      const dimDays = { from: period.current.fromDay, to: period.current.toDay };
      const [referrers, utm, countries] = await Promise.all([
        t.trafficDimension("referrer", dimDays.from, dimDays.to, 8),
        t.trafficDimension("utm_source", dimDays.from, dimDays.to, 8),
        t.trafficDimension("country", dimDays.from, dimDays.to, 8),
      ]);
      const total = visitors ?? 0;
      const edgeCheck = await edgeCheckFor(deps, cur.daily);

      const notes = [
        "Odwiedzający to suma dobowych unikalnych; odsłona to jedno załadowanie lub przejście strony. Wizyt (sesji) nie ma: bez ciasteczek nie da się ich złożyć.",
        "Bez ruchu botów i bez osób z włączonym GPC/DNT, więc liczby są niższe niż w Cloudflare (ruch krawędzi z botami: System → Domeny i Cloudflare).",
      ];
      if (hourly) notes.push("Dla „Dziś” odwiedzających nie porównujemy po godzinach: unikalność liczymy na dobę. Odsłony są porównane godzina po godzinie.");
      else notes.push("Dzisiejsza doba jest niepełna, więc porównanie lekko zaniża ostatni dzień.");
      if (fresh.coverageDays > 0 && fresh.coverageDays < 7) notes.push(`Telemetria zbiera dopiero od ${fresh.coverageDays} dni: dni sprzed pierwszego pomiaru są oznaczone „bez pomiaru”, a porównanie pojawi się, gdy poprzedni okres będzie w całości zmierzony.`);

      return {
        rangeLabel: period.windows.label,
        compareLabel: period.windows.compareLabel,
        granularity: g,
        freshness: fresh,
        kpis,
        visitors: timeSeries(period, curV, prevV),
        pageviews: timeSeries(period, curP, prevP),
        sources: ranked(referrers.map((r) => ({ label: sourceLabel(r.value), value: r.visitors })), total),
        campaigns: ranked(utm.map((r) => ({ label: r.value, value: r.visitors })), total),
        countries: ranked(countries.map((r) => ({ label: countryLabel(r.value), value: r.visitors })), total),
        annotations,
        notes,
        edgeCheck,
      } satisfies TrafficOverview;
    }),
  );
}

/** Day buckets for totals, also in "today" mode (one Warsaw day: today, or the same weekday last week). */
function dayBuckets(side: Side) {
  const days = side.buckets;
  if (days.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(days[0].key)) return days;
  const key = side.fromDay;
  return [{ key, start: side.from, label: key }];
}

function sumViews(rows: PlaybackDayRow[]): number | null {
  return rows.length === 0 ? null : rows.reduce((a, r) => a + r.views, 0);
}

async function edgeCheckFor(deps: AnalyticsDeps, ownDaily: TrafficDayRow[]): Promise<EdgeCheck> {
  const edge = await edgeWwwDay(deps);
  if (!edge.available) return { available: false, reason: edge.reason };
  const own = ownDaily.find((r) => r.day === edge.day) ?? null;
  const today = warsawDayKey(deps.now());
  if (!own) return { available: false, reason: `Brak własnych odsłon dla doby ${edge.day} w wybranym okresie, więc nie ma z czym porównać danych Cloudflare.` };
  if (edge.day === today) return { available: false, reason: "Dane Cloudflare dotyczą niepełnej doby; porównanie robimy dla doby zakończonej." };
  const deviation = edge.documentRequests > 0 ? (100 * (own.pageviews - edge.documentRequests)) / edge.documentRequests : 0;
  return {
    available: true,
    fetchedAt: edge.fetchedAt,
    ownPageviews: own.pageviews,
    edgeRequests: edge.documentRequests,
    deviationPct: deviation,
    withinTolerance: Math.abs(deviation) <= deps.config.edgeTolerancePct,
    tolerancePct: deps.config.edgeTolerancePct,
  };
}
