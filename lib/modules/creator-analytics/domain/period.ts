import { ANALYTICS_RANGES, DEFAULT_RANGE, type AnalyticsRange } from "./types";

const DAY_MS = 86_400_000;

export interface AnalyticsPeriod {
  range: AnalyticsRange;
  /** Start of the first UTC day of the period (inclusive). */
  from: Date;
  /** The moment of the request (inclusive); nothing after it exists yet. */
  to: Date;
  /** Every UTC day of the period, oldest first, `YYYY-MM-DD`; the last one is today. */
  days: string[];
  /** The UTC day just before the period: its closing subscriber count is the baseline of the change. */
  baselineDay: string;
}

export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** `YYYY-MM-DD` as the UTC midnight Date (what a Postgres `date` column maps to). */
export function dayKeyToDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Accepts only the offered ranges; anything else is rejected (null), an absent value is the default. */
export function parseRange(raw: string | null | undefined): AnalyticsRange | null {
  if (raw === null || raw === undefined || raw === "") return DEFAULT_RANGE;
  const n = Number(raw);
  return (ANALYTICS_RANGES as readonly number[]).includes(n) ? (n as AnalyticsRange) : null;
}

export function buildPeriod(range: AnalyticsRange, now: Date): AnalyticsPeriod {
  const today = startOfUtcDay(now);
  const from = new Date(today.getTime() - (range - 1) * DAY_MS);
  const days: string[] = [];
  for (let i = 0; i < range; i++) days.push(utcDayKey(new Date(from.getTime() + i * DAY_MS)));
  return { range, from, to: now, days, baselineDay: utcDayKey(new Date(from.getTime() - DAY_MS)) };
}
