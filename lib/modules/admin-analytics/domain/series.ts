/**
 * Time buckets for analytics charts: day rollups are keyed by the Europe/Warsaw day ("YYYY-MM-DD"), hour
 * rollups by the UTC hour (a Warsaw hour boundary too). A bucket before the first day with any telemetry is
 * `null` ("bez pomiaru"), never zero: a chart must not claim that nobody came before we started counting.
 */
import { startOfWarsawDay, warsawDayKey, type Bucket, type RangeWindows } from "@/lib/modules/admin-overview";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export type Granularity = RangeWindows["granularity"];

/** Row key of a bucket: the Warsaw day for day granularity, the epoch ms of the hour start for hours. */
export const bucketRowKey = (g: Granularity, b: Bucket): string => (g === "day" ? b.key : String(b.start.getTime()));
export const hourRowKey = (hour: Date | string): string => String(new Date(hour).getTime());

/** Buckets of the comparison period, 1:1 with the current ones (a week earlier for hours, one period for days). */
export function previousBuckets(w: RangeWindows): Bucket[] {
  if (w.granularity === "hour") {
    return w.buckets.map((b) => ({ ...b, key: `p${b.key}`, start: new Date(b.start.getTime() - 7 * DAY_MS) }));
  }
  const shift = w.buckets.length * DAY_MS;
  return w.buckets.map((b) => {
    const noon = new Date(b.start.getTime() - shift + 12 * HOUR_MS);
    return { key: warsawDayKey(noon), start: startOfWarsawDay(noon), label: b.label };
  });
}

/**
 * Values per bucket. Missing row inside the covered period = 0 (rollup rows exist only when something
 * happened); a bucket that starts before `firstDay` (Warsaw day of the first telemetry) = null.
 */
export function seriesOf<T>(
  g: Granularity,
  buckets: Bucket[],
  rows: T[],
  rowKey: (r: T) => string,
  value: (r: T) => number,
  firstDay: string | null,
): (number | null)[] {
  const byKey = new Map<string, number>();
  for (const r of rows) byKey.set(rowKey(r), (byKey.get(rowKey(r)) ?? 0) + value(r));
  return buckets.map((b) => {
    if (firstDay === null) return null;
    // A bucket is covered when it ends after the first telemetry day began.
    const endsAt = b.start.getTime() + (g === "day" ? DAY_MS : HOUR_MS);
    if (endsAt <= startOfWarsawDay(new Date(`${firstDay}T12:00:00Z`)).getTime()) return null;
    return byKey.get(bucketRowKey(g, b)) ?? 0;
  });
}

/** Sum of a series; null when any bucket has no measurement (a partial sum would mislead). */
export function totalOf(values: (number | null)[]): number | null {
  let sum = 0;
  for (const v of values) {
    if (v === null) return null;
    sum += v;
  }
  return sum;
}

/** Same as totalOf but ignores buckets without measurement and reports how many were counted. */
export function coveredTotal(values: (number | null)[]): { sum: number; covered: number } {
  let sum = 0;
  let covered = 0;
  for (const v of values) if (v !== null) { sum += v; covered++; }
  return { sum, covered };
}

/** Warsaw day range [from, to] of the buckets of a day-granularity window, for `day BETWEEN` queries. */
export function dayRange(buckets: Bucket[]): { from: string; to: string } {
  return { from: buckets[0].key, to: buckets[buckets.length - 1].key };
}
