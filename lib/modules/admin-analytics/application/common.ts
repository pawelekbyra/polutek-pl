import { bucketIndex, fmtDateTime, warsawDayKey } from "@/lib/modules/admin-overview";
import { totalOf } from "../domain/series";
import type { Annotation, Freshness, KpiDto, RankedItem, TimeSeriesDto, Unavailable } from "../domain/types";
import type { AnalyticsDeps } from "./deps";
import { TELEMETRY_OFF_REASON } from "./deps";
import type { Period } from "./period";

export type Availability<T> = { available: true; data: T } | Unavailable;

export const unavailable = (reason: string): Unavailable => ({ available: false, reason });

/** Runs a use case body; any failure becomes an explicit "no measurement", never a crash or a zero. */
export async function guarded<T>(fn: () => Promise<T>): Promise<Availability<T>> {
  try {
    return { available: true, data: await fn() };
  } catch (error) {
    const name = error instanceof Error ? error.name : "błąd";
    return unavailable(`Odczyt telemetrii nie powiódł się (${name}). Spróbuj za chwilę; panel nie pokazuje wtedy liczb zastępczych.`);
  }
}

export function needTelemetry(deps: AnalyticsDeps) {
  if (!deps.telemetry) throw new TelemetryOff();
  return deps.telemetry;
}

export class TelemetryOff extends Error {
  constructor() {
    super(TELEMETRY_OFF_REASON);
    this.name = "TelemetryOff";
  }
}

/** Like `guarded`, but keeps the precise reason when telemetry is simply not configured. */
export async function guardedTelemetry<T>(fn: () => Promise<T>): Promise<Availability<T>> {
  try {
    return { available: true, data: await fn() };
  } catch (error) {
    if (error instanceof TelemetryOff) return unavailable(TELEMETRY_OFF_REASON);
    const name = error instanceof Error ? error.name : "błąd";
    return unavailable(`Odczyt telemetrii nie powiódł się (${name}). Spróbuj za chwilę; panel nie pokazuje wtedy liczb zastępczych.`);
  }
}

export async function cached<T>(deps: AnalyticsDeps, key: string, load: () => Promise<T>): Promise<T> {
  return deps.cache ? deps.cache.get(key, load) : load();
}

export async function freshness(deps: AnalyticsDeps): Promise<Freshness> {
  const t = needTelemetry(deps);
  const cov = await t.coverage();
  const today = warsawDayKey(deps.now());
  const coverageDays = cov.firstDay ? Math.max(1, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${cov.firstDay}T12:00:00Z`)) / 86_400_000) + 1) : 0;
  return { rollupAt: cov.rollupAt ? cov.rollupAt.toISOString() : null, firstDay: cov.firstDay, coverageDays };
}

export function timeSeries(period: Period, current: (number | null)[], previous: (number | null)[] | null): TimeSeriesDto {
  return { labels: period.current.buckets.map((b) => b.label), current, previous: period.compare === "none" ? null : previous };
}

/** KPI whose previous value is only shown when the whole comparison period was measured. */
export function kpi(base: Omit<KpiDto, "previous">, previous: number | null): KpiDto {
  return { ...base, previous };
}

/** "x / y" style ratio of two nullable totals; null when either is missing or the denominator is 0. */
export const ratio = (a: number | null, b: number | null): number | null => (a === null || b === null || b <= 0 ? null : a / b);

export const sumSeries = totalOf;

export function ranked(rows: { label: string; value: number; sub?: string }[], total: number): RankedItem[] {
  return rows.map((r) => ({ ...r, share: total > 0 ? Math.min(100, (100 * r.value) / total) : 0 }));
}

const cleanDetail = (text: string | null) => (text ?? "").replace(/\s+/g, " ").trim().slice(0, 80);

/**
 * Change timeline on charts: deploys (job_run) and video publications/premieres inside the current window.
 * At most 12, the earliest ones; text never contains secrets (job_run detail is "<tag> (<source>): <message>").
 */
export async function buildAnnotations(deps: AnalyticsDeps, period: Period): Promise<Annotation[]> {
  const { from, to } = period.current;
  const [deploys, published] = await Promise.all([
    deps.telemetry ? deps.telemetry.deploys(from, to, 40).catch(() => []) : Promise.resolve([]),
    deps.app.publishedVideos(from, to, 20).catch(() => []),
  ]);
  const items: Annotation[] = [];
  for (const d of deploys) {
    const index = bucketIndex(period.windows, d.at);
    if (index >= 0) items.push({ index, when: fmtDateTime(d.at, period.now), kind: "deploy", label: `Wdrożenie${d.job === "deploy-admin" ? " panelu" : ""}${d.detail ? `: ${cleanDetail(d.detail)}` : ""}` });
  }
  for (const v of published) {
    const index = bucketIndex(period.windows, v.at);
    if (index >= 0) items.push({ index, when: fmtDateTime(v.at, period.now), kind: "publish", label: `Publikacja: ${v.title.slice(0, 60)}` });
  }
  return items.sort((a, b) => a.index - b.index).slice(0, 12);
}
