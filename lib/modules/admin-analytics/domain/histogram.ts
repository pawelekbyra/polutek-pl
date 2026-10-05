/**
 * Fixed histogram of startup times (ms), shared in meaning with telemetry.startup_histogram() in the SQL
 * migration 20261005120000_analytics_rollups. Buckets can be summed across days and videos exactly, so a
 * percentile of any range is read from the merged histogram (error: at most one bucket width).
 * Bucket 0 is below the first edge, bucket k is [edge k-1, edge k), the last one is open ended.
 */
export const STARTUP_EDGES_MS = [250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000, 12000, 20000] as const;
export const STARTUP_BUCKETS = STARTUP_EDGES_MS.length + 1;
/** Upper bound assumed for the open last bucket when interpolating (a 20 s+ start is a failure anyway). */
export const STARTUP_CAP_MS = 30_000;

export const emptyHist = (): number[] => new Array<number>(STARTUP_BUCKETS).fill(0);

/** Same result as Postgres width_bucket(x, edges): 0 below the first edge, edges.length at or above the last. */
export function bucketOf(ms: number): number {
  let k = 0;
  while (k < STARTUP_EDGES_MS.length && ms >= STARTUP_EDGES_MS[k]) k++;
  return k;
}

export function histFromValues(values: number[]): number[] {
  const h = emptyHist();
  for (const v of values) h[bucketOf(v)]++;
  return h;
}

/** Element-wise sum; arrays of a wrong length (never expected) are ignored rather than corrupting the sum. */
export function sumHists(list: (number[] | null | undefined)[]): number[] {
  const out = emptyHist();
  for (const h of list) {
    if (!h || h.length !== STARTUP_BUCKETS) continue;
    for (let i = 0; i < STARTUP_BUCKETS; i++) out[i] += Number(h[i]) || 0;
  }
  return out;
}

export const histTotal = (h: number[]): number => h.reduce((a, b) => a + b, 0);

/**
 * q-quantile (0..1) by linear interpolation inside the bucket that holds the target rank; null when empty.
 * Example: 100 values, 90 below 1000 ms and 10 in [1000,1500): p95 = 1000 + (95-90)/10 * 500 = 1250 ms.
 */
export function histPercentile(h: number[], q: number): number | null {
  const total = histTotal(h);
  if (total <= 0) return null;
  const target = Math.min(1, Math.max(0, q)) * total;
  let cum = 0;
  for (let i = 0; i < h.length; i++) {
    const c = h[i];
    if (c > 0 && cum + c >= target) {
      const lo = i === 0 ? 0 : STARTUP_EDGES_MS[i - 1];
      const hi = i < STARTUP_EDGES_MS.length ? STARTUP_EDGES_MS[i] : STARTUP_CAP_MS;
      return lo + ((target - cum) / c) * (hi - lo);
    }
    cum += c;
  }
  return STARTUP_CAP_MS;
}
