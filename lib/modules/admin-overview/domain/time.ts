/**
 * Time windows of the admin panel, always in Europe/Warsaw (DESIGN-SYSTEM.md: one time zone everywhere).
 * Pure functions: the clock is passed in, so tests pin "now".
 */
export const PANEL_TIME_ZONE = "Europe/Warsaw";

export const RANGE_KEYS = ["today", "7d", "28d", "90d"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];
export const COMPARE_KEYS = ["prev", "none"] as const;
export type CompareKey = (typeof COMPARE_KEYS)[number];

export const DEFAULT_RANGE: RangeKey = "today";
export const DEFAULT_COMPARE: CompareKey = "prev";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function parseRange(raw: string | null | undefined): RangeKey {
  return (RANGE_KEYS as readonly string[]).includes(raw ?? "") ? (raw as RangeKey) : DEFAULT_RANGE;
}

export function parseCompare(raw: string | null | undefined): CompareKey {
  return (COMPARE_KEYS as readonly string[]).includes(raw ?? "") ? (raw as CompareKey) : DEFAULT_COMPARE;
}

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PANEL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function warsawParts(date: Date) {
  const out: Record<string, number> = {};
  for (const p of partsFormatter.formatToParts(date)) if (p.type !== "literal") out[p.type] = Number(p.value);
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Offset of Warsaw from UTC at `date`, in minutes (+60 in winter, +120 in summer). */
export function warsawOffsetMinutes(date: Date): number {
  const p = warsawParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** The instant of local midnight (Warsaw) of the day containing `date`. Correct on DST change days. */
export function startOfWarsawDay(date: Date): Date {
  const p = warsawParts(date);
  const guess = Date.UTC(p.year, p.month - 1, p.day) - warsawOffsetMinutes(date) * 60000;
  // On a DST switch day midnight has the offset of the day before, not of `date`; correct once.
  const corrected = Date.UTC(p.year, p.month - 1, p.day) - warsawOffsetMinutes(new Date(guess)) * 60000;
  return new Date(corrected);
}

/** "YYYY-MM-DD" of the Warsaw calendar day (bucket key). */
export function warsawDayKey(date: Date): string {
  const p = warsawParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function warsawHour(date: Date): number {
  return warsawParts(date).hour;
}

export type Window = { from: Date; to: Date };
export type Bucket = { key: string; start: Date; label: string };

export type RangeWindows = {
  range: RangeKey;
  current: Window;
  /** Same length, shifted back: a week for "today" (A3: same time last week), one period otherwise. */
  previous: Window;
  granularity: "hour" | "day";
  buckets: Bucket[];
  /** Human context for deltas, e.g. "vs ta sama pora tydzień temu". */
  compareLabel: string;
  label: string;
};

const RANGE_DAYS: Record<Exclude<RangeKey, "today">, number> = { "7d": 7, "28d": 28, "90d": 90 };

const RANGE_LABEL: Record<RangeKey, string> = {
  today: "dziś do teraz",
  "7d": "ostatnie 7 dni",
  "28d": "ostatnie 28 dni",
  "90d": "ostatnie 90 dni",
};

const dayLabel = new Intl.DateTimeFormat("pl-PL", { timeZone: PANEL_TIME_ZONE, day: "numeric", month: "short" });

export function rangeWindows(range: RangeKey, now: Date): RangeWindows {
  if (range === "today") {
    const from = startOfWarsawDay(now);
    // Real elapsed hours since local midnight (23 or 25 on DST days), labelled with the local hour.
    const hours = Math.max(1, Math.ceil((now.getTime() - from.getTime() + 1) / HOUR_MS));
    const buckets: Bucket[] = [];
    for (let h = 0; h < hours; h++) {
      const start = new Date(from.getTime() + h * HOUR_MS);
      buckets.push({ key: `h${h}`, start, label: `${String(warsawHour(start)).padStart(2, "0")}:00` });
    }
    return {
      range,
      current: { from, to: now },
      previous: { from: new Date(from.getTime() - 7 * DAY_MS), to: new Date(now.getTime() - 7 * DAY_MS) },
      granularity: "hour",
      buckets,
      compareLabel: "vs ta sama pora tydzień temu",
      label: RANGE_LABEL[range],
    };
  }
  const days = RANGE_DAYS[range];
  const todayStart = startOfWarsawDay(now);
  // Whole Warsaw days: today (so far) plus the days before it; 12:00 keeps DST days unambiguous.
  const buckets: Bucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const noon = new Date(todayStart.getTime() - i * DAY_MS + 12 * HOUR_MS);
    const start = startOfWarsawDay(noon);
    buckets.push({ key: warsawDayKey(noon), start, label: dayLabel.format(noon) });
  }
  const from = buckets[0].start;
  const span = now.getTime() - from.getTime();
  return {
    range,
    current: { from, to: now },
    previous: { from: new Date(from.getTime() - days * DAY_MS), to: new Date(from.getTime() - days * DAY_MS + span) },
    granularity: "day",
    buckets,
    compareLabel: `vs poprzednie ${days} dni`,
    label: RANGE_LABEL[range],
  };
}

/** Index of the bucket an instant falls into (-1 when outside the window). */
export function bucketIndex(windows: RangeWindows, at: Date): number {
  if (at < windows.current.from || at > windows.current.to) return -1;
  if (windows.granularity === "hour") {
    return Math.min(windows.buckets.length - 1, Math.floor((at.getTime() - windows.current.from.getTime()) / HOUR_MS));
  }
  const key = warsawDayKey(at);
  return windows.buckets.findIndex((b) => b.key === key);
}
