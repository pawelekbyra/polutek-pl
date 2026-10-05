/**
 * Funnel steps with the share that passes from the previous step. A step without a measurement (null) is
 * shown as "bez pomiaru", and the steps after it get no percentage (it would divide by an unknown).
 */
export type FunnelInput = { key: string; label: string; count: number | null; hint?: string };
export type FunnelStep = FunnelInput & { pctOfPrevious: number | null; pctOfFirst: number | null };

export function buildFunnel(steps: FunnelInput[]): FunnelStep[] {
  const first = steps[0]?.count ?? null;
  return steps.map((s, i) => {
    const prev = i === 0 ? null : steps[i - 1].count;
    return {
      ...s,
      pctOfPrevious: i === 0 ? (s.count === null ? null : 100) : s.count !== null && prev !== null && prev > 0 ? (100 * s.count) / prev : null,
      pctOfFirst: s.count !== null && first !== null && first > 0 ? (100 * s.count) / first : null,
    };
  });
}

/** Where the biggest relative loss is: the step (index >= 1) with the lowest pass rate. */
export function biggestLoss(steps: FunnelStep[]): { index: number; lostPct: number } | null {
  let best: { index: number; lostPct: number } | null = null;
  steps.forEach((s, i) => {
    if (i === 0 || s.pctOfPrevious === null) return;
    const lost = 100 - s.pctOfPrevious;
    if (!best || lost > best.lostPct) best = { index: i, lostPct: lost };
  });
  return best;
}
