/**
 * The period of a screen: current buckets, the comparison buckets, and the queries' ranges for both.
 * Reuses the panel's global range windows (Europe/Warsaw, `?range=`, `?cmp=`).
 */
import { rangeWindows, warsawDayKey, type Bucket, type CompareKey, type RangeKey, type RangeWindows } from "@/lib/modules/admin-overview";
import { previousBuckets } from "../domain/series";

export type Side = {
  buckets: Bucket[];
  /** [from, to) instants, for hourly rollups. */
  from: Date;
  to: Date;
  /** Warsaw days (inclusive), for daily rollups. */
  fromDay: string;
  toDay: string;
};

export type Period = {
  range: RangeKey;
  compare: CompareKey;
  windows: RangeWindows;
  current: Side;
  previous: Side | null;
  now: Date;
};

const HOUR = 3_600_000;
const DAY = 86_400_000;

function sideOf(buckets: Bucket[], granularity: RangeWindows["granularity"]): Side {
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  const step = granularity === "hour" ? HOUR : DAY;
  // Day buckets are keyed by their Warsaw day; for hour buckets take the Warsaw day of the hour start.
  const dayOf = (b: Bucket) => (granularity === "day" ? b.key : warsawDayKey(b.start));
  return { buckets, from: first.start, to: new Date(last.start.getTime() + step), fromDay: dayOf(first), toDay: dayOf(last) };
}

export function makePeriod(range: RangeKey, compare: CompareKey, now: Date): Period {
  const windows = rangeWindows(range, now);
  const current = sideOf(windows.buckets, windows.granularity);
  const previous = compare === "none" ? null : sideOf(previousBuckets(windows), windows.granularity);
  return { range, compare, windows, current, previous, now };
}

/** Quality and retention are computed per day: "today" widens to the last 7 days (and says so). */
export function dailyRange(range: RangeKey): { range: RangeKey; widened: boolean } {
  return range === "today" ? { range: "7d", widened: true } : { range, widened: false };
}

export const DAY_MS = DAY;
