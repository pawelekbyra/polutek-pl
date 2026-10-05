/**
 * Audience retention from the daily rollup. retention[k] = play attempts that watched the k-th 1% of the
 * video (a bitmap "watched at least once", so a replayed fragment counts once per attempt). The curve is the
 * share of STARTED attempts that reached each percent; several days merge by summing counts, which is exact.
 * Method: the same "share of viewers still watching a moment" as Wistia, Mux and YouTube retention graphs.
 */
import { LOW_N_ATTEMPTS } from "./qoe";

export const RETENTION_POINTS = 100;

export type RetentionRow = { started: number; retention: number[] };
export type RetentionCurve = {
  /** Percent of started attempts (0..100) that watched the k-th percent of the video, k = 0..99. */
  percent: number[];
  starts: number;
  /** Mean share of the video that an attempt watched. */
  avgWatchedPct: number;
  /** Share that reached 25 / 50 / 75 / 90 percent of the video and the last percent ("do końca"). */
  milestones: { at: number; pct: number }[];
  lowSample: boolean;
};

export function mergeRetention(rows: RetentionRow[]): { counts: number[]; starts: number } {
  const counts = new Array<number>(RETENTION_POINTS).fill(0);
  let starts = 0;
  for (const r of rows) {
    if (!Array.isArray(r.retention) || r.retention.length !== RETENTION_POINTS) continue;
    starts += Number(r.started) || 0;
    for (let k = 0; k < RETENTION_POINTS; k++) counts[k] += Number(r.retention[k]) || 0;
  }
  return { counts, starts };
}

export function retentionCurve(rows: RetentionRow[]): RetentionCurve | null {
  const { counts, starts } = mergeRetention(rows);
  if (starts <= 0) return null;
  // An attempt can reach a bucket without a "started" flag (beacons arrive out of order): clamp at 100.
  const percent = counts.map((c) => Math.min(100, (100 * c) / starts));
  const avg = percent.reduce((a, b) => a + b, 0) / RETENTION_POINTS;
  const at = (k: number) => percent[Math.min(RETENTION_POINTS - 1, k - 1)];
  return {
    percent,
    starts,
    avgWatchedPct: avg,
    milestones: [25, 50, 75, 90, 100].map((p) => ({ at: p, pct: at(p) })),
    lowSample: starts < LOW_N_ATTEMPTS,
  };
}

const quantile = (sorted: number[], q: number): number => {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

/**
 * "Typowy film kanału": per percent of the video, the 25th..75th percentile of the retention of the OTHER
 * videos that have enough starts. Needs at least 3 such videos; otherwise null (no fake band).
 */
export function typicalBand(others: RetentionCurve[], minVideos = 3): { lo: number[]; hi: number[]; videos: number } | null {
  const usable = others.filter((c) => !c.lowSample);
  if (usable.length < minVideos) return null;
  const lo: number[] = [];
  const hi: number[] = [];
  for (let k = 0; k < RETENTION_POINTS; k++) {
    const col = usable.map((c) => c.percent[k]).sort((a, b) => a - b);
    lo.push(quantile(col, 0.25));
    hi.push(quantile(col, 0.75));
  }
  return { lo, hi, videos: usable.length };
}

/** Position of the largest one-step drop between neighbouring percents (where viewers leave), if notable. */
export function biggestDrop(percent: number[], minDrop = 5): { at: number; drop: number } | null {
  let best: { at: number; drop: number } | null = null;
  // Compare 5%-wide steps so a noisy single percent does not win.
  for (let k = 5; k < percent.length; k += 1) {
    const drop = percent[k - 5] - percent[k];
    if (drop >= minDrop && (!best || drop > best.drop)) best = { at: k, drop };
  }
  return best;
}
