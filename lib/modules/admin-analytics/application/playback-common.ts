import { hourRowKey, seriesOf } from "../domain/series";
import { addTotals, emptyTotals, type QoeTotals } from "../domain/qoe";
import { sumHists } from "../domain/histogram";
import type { PlaybackDayRow, PlaybackHourRow } from "../infrastructure/ports";
import type { Period, Side } from "./period";

export function totalsOf(rows: PlaybackDayRow[]): QoeTotals {
  return rows.reduce(
    (acc, r) =>
      addTotals(acc, {
        attempts: r.attempts, started: r.started, views: r.views, exitsBeforeStart: r.exitsBeforeStart, errors: r.errors, fatalErrors: r.fatalErrors,
        watchMs: r.watchMs, rebufferMs: r.rebufferMs, rebufferCount: r.rebufferCount, rebufferedAttempts: r.rebufferedAttempts, switches: r.switches,
        bitrateSum: r.bitrateSum, bitrateN: r.bitrateN, startupN: r.startupN, startupScoreSum: r.startupScoreSum, smoothnessSum: r.smoothnessSum,
        smoothnessN: r.smoothnessN,
      }),
    emptyTotals(),
  );
}

export const histOfRows = (rows: PlaybackDayRow[]) => sumHists(rows.map((r) => r.startupHist));

/** A metric per bucket from day rows or hour rows (hour rows only for the "today" granularity). */
export function playbackSeries(
  period: Period,
  side: Side,
  firstDay: string | null,
  days: PlaybackDayRow[],
  hours: PlaybackHourRow[],
  pickDay: (r: PlaybackDayRow) => number,
  pickHour: (r: PlaybackHourRow) => number,
): (number | null)[] {
  const g = period.windows.granularity;
  return g === "hour"
    ? seriesOf(g, side.buckets, hours, (r) => hourRowKey(r.hour), pickHour, firstDay)
    : seriesOf(g, side.buckets, days, (r) => r.day, pickDay, firstDay);
}

/** The value of one metric of a total where "no attempts at all" means "bez pomiaru" (null), not 0. */
export const orNull = (n: number, has: boolean): number | null => (has ? n : null);

export const hoursOf = (ms: number): number => ms / 3_600_000;
