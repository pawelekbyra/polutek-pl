import {
  MIN_SAMPLE_VIEWS,
  RETENTION_POINTS,
  RETENTION_STEP_PCT,
  type AudienceCounts,
  type DayCount,
  type PlaybackSum,
  type RetentionBucket,
  type RetentionPoint,
  type SampleState,
  type SnapshotRow,
  type SubscriberFlow,
} from "./types";

/** Pure aggregation helpers. No I/O, so every rule is testable with plain numbers. */

export function sampleState(views: number, min = MIN_SAMPLE_VIEWS): SampleState {
  if (views <= 0) return "no_data";
  return views < min ? "low_sample" : "ok";
}

/** Puts sparse (day, value) rows on every day of the period; missing days are 0, days outside are ignored. */
export function fillDays(days: readonly string[], rows: readonly DayCount[]): number[] {
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.day, (byDay.get(r.day) ?? 0) + (Number(r.value) || 0));
  return days.map((d) => byDay.get(d) ?? 0);
}

export const emptyPlayback = (): PlaybackSum => ({ sessions: 0, watchMs: 0, pctSessions: 0, pctSum: 0 });

export function addPlayback(a: PlaybackSum, b: PlaybackSum): PlaybackSum {
  return {
    sessions: a.sessions + b.sessions,
    watchMs: a.watchMs + b.watchMs,
    pctSessions: a.pctSessions + b.pctSessions,
    pctSum: a.pctSum + b.pctSum,
  };
}

/**
 * Average share of a video watched per counted view (0..100, one decimal). The average is over sessions whose
 * video length is known; below the sample threshold the number is withheld, never rounded into a fake figure.
 */
export function averagePctViewed(p: PlaybackSum, min = MIN_SAMPLE_VIEWS): { value: number | null; state: SampleState } {
  const state = sampleState(p.pctSessions, min);
  if (state !== "ok") return { value: null, state };
  const value = Math.min(100, Math.max(0, (100 * p.pctSum) / p.pctSessions));
  return { value: Math.round(value * 10) / 10, state };
}

export const msToSeconds = (ms: number): number => Math.max(0, Math.round((Number(ms) || 0) / 1000));

/**
 * Subscribers gained and lost. `net` is exact (live count minus the closing count of the day before the period).
 * `gained` counts subscriptions made in the period that still exist, so `gained - net` is exactly the number of
 * subscribers from before the period who left. Without a baseline the net and the loss are unknown (null).
 */
export function subscriberFlow(args: {
  current: number;
  baseline: SnapshotRow | null;
  gained: number;
}): SubscriberFlow {
  const { current, baseline, gained } = args;
  if (!baseline) return { current, baseline: null, baselineDay: null, net: null, gained, lost: null };
  const net = current - baseline.subscribers;
  return {
    current,
    baseline: baseline.subscribers,
    baselineDay: baseline.day,
    net,
    gained,
    lost: Math.max(0, gained - net),
  };
}

/**
 * Daily subscriber series from snapshots. Days without a snapshot stay null (a gap, not zero); today shows the
 * live count because its snapshot is only written at the end of the day.
 */
export function subscriberSeries(
  days: readonly string[],
  snapshots: readonly SnapshotRow[],
  today: string,
  current: number,
): (number | null)[] {
  const byDay = new Map(snapshots.map((s) => [s.day, s.subscribers]));
  return days.map((d) => (d === today ? current : (byDay.get(d) ?? null)));
}

/**
 * Reach curve from the furthest position of each counted view. `point(k)` = share of views that got at least k % into
 * the video. It says where viewers stopped, not which parts they replayed or skipped.
 */
export function buildReachCurve(buckets: readonly RetentionBucket[], min = MIN_SAMPLE_VIEWS) {
  const counts = new Array<number>(RETENTION_POINTS).fill(0);
  let sessions = 0;
  for (const b of buckets) {
    const idx = Math.min(RETENTION_POINTS - 1, Math.max(0, Math.trunc(Number(b.bucket)) || 0));
    const n = Math.max(0, Number(b.sessions) || 0);
    counts[idx] += n;
    sessions += n;
  }
  const state = sampleState(sessions, min);
  if (state !== "ok") return { state, sessions, points: null as RetentionPoint[] | null };
  const points: RetentionPoint[] = [];
  let reached = sessions;
  for (let k = 0; k < RETENTION_POINTS; k++) {
    points.push({ atPct: k * RETENTION_STEP_PCT, reachedPct: Math.round((1000 * reached) / sessions) / 10 });
    reached -= counts[k];
  }
  return { state, sessions, points };
}

/** Viewer-type split; withheld below the threshold because tiny groups could point at one person. */
export function audienceSplit(c: AudienceCounts, min = MIN_SAMPLE_VIEWS) {
  const state = sampleState(c.views, min);
  if (state !== "ok") return { state, views: c.views, guestViews: null, signedInViews: null, subscriberViews: null };
  return {
    state,
    views: c.views,
    guestViews: Math.max(0, c.views - c.signedIn),
    signedInViews: c.signedIn,
    subscriberViews: c.subscribers,
  };
}
