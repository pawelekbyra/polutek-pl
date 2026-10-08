/**
 * "Świat" (docs/architecture/admin-world-map.md): visitors by country on a map, how many countries the site has
 * reached and when each of them appeared for the first time. Read only over the daily traffic rollup
 * (dimension "country", ISO alpha-2 from Cloudflare's CF-IPCountry); no new data is collected for it.
 * "Odwiedzający" keeps the panel's definition: the sum of daily uniques.
 */
import { fmtDate, fmtDateY, fmtInt, warsawDayKey, type CompareKey, type RangeKey } from "@/lib/modules/admin-overview";
import type { DimensionRow } from "../infrastructure/ports";
import type { KpiDto, WorldCountryDto, WorldOverview } from "../domain/types";
import { conquestSeries, conquestSteps, worldClassBreaks, worldClassLegend, worldClassOf } from "../domain/world";
import { cached, freshness, guardedTelemetry, kpi, needTelemetry, type Availability } from "./common";
import type { AnalyticsDeps } from "./deps";
import { makePeriod } from "./period";
import { countryLabel } from "./traffic";

/** The site's home country: "Spoza Polski" counts everyone else. */
export const HOME_COUNTRY = "PL";
/** At most this many days on the "kraje w czasie" line (the daily rollups keep 25 months). */
const MAX_SERIES_DAYS = 800;

const isKnown = (code: string) => /^[A-Z]{2}$/.test(code);
const DAY_MS = 86_400_000;

function knownOnly(rows: DimensionRow[]) {
  return rows.filter((r) => isKnown(r.value) && r.visitors > 0);
}

function outsideHomePct(rows: DimensionRow[]): number | null {
  const known = knownOnly(rows);
  const total = known.reduce((a, r) => a + r.visitors, 0);
  if (total <= 0) return null;
  const home = known.find((r) => r.value === HOME_COUNTRY)?.visitors ?? 0;
  return (100 * (total - home)) / total;
}

/** Warsaw days from `from` to `to` inclusive ("YYYY-MM-DD"). */
function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let t = Date.parse(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);
  while (t <= end && out.length < MAX_SERIES_DAYS + 1) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += DAY_MS;
  }
  return out;
}

const noon = (day: string) => `${day}T12:00:00Z`;

export function getWorldOverview(deps: AnalyticsDeps, input: { range: RangeKey; compare: CompareKey }): Promise<Availability<WorldOverview>> {
  return guardedTelemetry(() =>
    cached(deps, `world:${input.range}:${input.compare}`, async () => {
      const t = needTelemetry(deps);
      const now = deps.now();
      const period = makePeriod(input.range, input.compare, now);
      const fresh = await freshness(deps);
      const [cur, prev, firstSeen] = await Promise.all([
        t.countryTotals(period.current.fromDay, period.current.toDay),
        period.previous ? t.countryTotals(period.previous.fromDay, period.previous.toDay) : Promise.resolve(null),
        t.countryFirstSeen(),
      ]);

      const known = knownOnly(cur);
      const knownTotal = known.reduce((a, r) => a + r.visitors, 0);
      const unknownVisitors = cur.filter((r) => !isKnown(r.value)).reduce((a, r) => a + r.visitors, 0);
      const breaks = worldClassBreaks(Math.max(0, ...known.map((r) => r.visitors)));
      const first = new Map(firstSeen.filter((r) => isKnown(r.code)).map((r) => [r.code, r.firstDay]));
      const inside = (day: string | null | undefined, from: string, to: string) => !!day && day >= from && day <= to;
      const { fromDay, toDay } = period.current;

      const countries: WorldCountryDto[] = known.map((r) => ({
        code: r.value,
        name: countryLabel(r.value),
        visitors: r.visitors,
        pageviews: r.pageviews,
        share: knownTotal > 0 ? (100 * r.visitors) / knownTotal : 0,
        cls: worldClassOf(r.visitors, breaks),
        firstDay: first.get(r.value) ?? null,
        isNew: inside(first.get(r.value), fromDay, toDay),
      }));
      const inPeriod = new Set(countries.map((c) => c.code));
      const earlier = [...first.entries()]
        .filter(([code]) => !inPeriod.has(code))
        .map(([code, day]): WorldCountryDto => ({ code, name: countryLabel(code), visitors: 0, pageviews: 0, share: 0, cls: 0, firstDay: day, isNew: false }))
        .sort((a, b) => a.name.localeCompare(b.name, "pl"));

      // A comparison is only fair when the previous period was measured in full; "today" compares a part of
      // a day with a whole one, so counts of countries are not compared there.
      const prevSide = period.previous;
      const prevFair = !!prevSide && !!prev && period.windows.granularity === "day" && !!fresh.firstDay && fresh.firstDay <= prevSide.fromDay;
      const newCount = countries.filter((c) => c.isNew).length;
      const newPrev = prevFair && prevSide ? [...first.values()].filter((d) => inside(d, prevSide.fromDay, prevSide.toDay)).length : null;

      const kpis: KpiDto[] = [
        kpi({ key: "countries", label: "Kraje z ruchem", hint: "Kraje (i terytoria), z których był choć jeden odwiedzający w okresie. Bez nieznanego kraju (VPN, Tor).", value: known.length, format: "int", upIsGood: true }, prevFair && prev ? knownOnly(prev).length : null),
        kpi({ key: "new", label: "Nowe kraje", hint: "Kraje widziane w tym okresie po raz pierwszy od początku pomiaru.", value: newCount, format: "int", upIsGood: true }, newPrev),
        kpi({ key: "all", label: "Kraje od początku", hint: fresh.firstDay ? `Wszystkie kraje widziane od ${fmtDateY(noon(fresh.firstDay))} (agregaty dzienne trzymamy 25 miesięcy).` : "Wszystkie kraje widziane od początku pomiaru.", value: first.size, format: "int", upIsGood: true }, null),
        kpi({ key: "abroad", label: "Spoza Polski", hint: "Odsetek odwiedzających ze znanym krajem innym niż Polska.", value: outsideHomePct(cur), format: "pct", upIsGood: true }, prevFair && prev ? outsideHomePct(prev) : null),
      ];

      const steps = conquestSteps(firstSeen);
      const conquest = steps.map((s) => ({ day: s.day, label: fmtDateY(noon(s.day)), codes: s.codes, names: s.codes.map(countryLabel), total: s.total }));
      const today = warsawDayKey(now);
      const startDay = fresh.firstDay ?? steps[0]?.day ?? today;
      let days = daysBetween(startDay, today);
      if (days.length > MAX_SERIES_DAYS) days = days.slice(-MAX_SERIES_DAYS);

      const notes = [
        "Kraj pochodzi z nagłówka Cloudflare (CF-IPCountry), ustalanego po adresie IP. Panel nie zapisuje adresu IP ani miasta, tylko kod kraju w agregatach dziennych.",
        "Odwiedzający to suma dobowych unikalnych (ta sama osoba w dwóch dobach liczy się dwa razy). Boty i osoby z GPC/DNT nie są liczone.",
        "VPN, Tor i sieci bez lokalizacji dają „nieznany kraj”: te osoby są w liczbach, ale nie na mapie.",
        "Kolory rosną skokami 1, 2, 5, 10, 20, 50…, bo ruch z krajów jest bardzo nierówny (jeden kraj domowy, długi ogon pojedynczych wizyt).",
      ];
      if (fresh.coverageDays > 0 && fresh.coverageDays < 28) notes.push(`Telemetria zbiera dopiero od ${fresh.coverageDays} dni, więc „nowe kraje” na początku to po prostu pierwsze dni pomiaru.`);

      return {
        rangeLabel: period.windows.label,
        compareLabel: period.windows.compareLabel,
        freshness: fresh,
        kpis,
        countries: [...countries, ...earlier],
        classes: worldClassLegend(breaks, fmtInt).map(({ cls, label }) => ({ cls, label })),
        unknownVisitors,
        conquest,
        conquestSeries: { labels: days.map((d) => fmtDate(noon(d))), current: conquestSeries(steps, days, fresh.firstDay), previous: null },
        notes,
      } satisfies WorldOverview;
    }),
  );
}
