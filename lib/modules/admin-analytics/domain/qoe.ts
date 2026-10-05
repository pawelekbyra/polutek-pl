/**
 * Quality-of-experience formulas (docs/architecture/admin-phaseA.md, section "Definicje metryk"). The two
 * scores are Mux Data's published per-view formulas
 * (https://www.mux.com/docs/guides/data-startup-time-metric, https://www.mux.com/docs/guides/data-smoothness-metric).
 * The rollup stores the per-attempt scores summed (same formulas in SQL), the panel only divides.
 */

/** Below this many attempts every QoE number carries the "Mała próba" warning. */
export const LOW_N_ATTEMPTS = 30;
/** A "view" is a started attempt with at least this much watch time: the site's own definition of a view. */
export const VIEW_MIN_WATCH_MS = 10_000;

/** Startup time score, 0..100: 8/(8+s). 0.4 s: 95, 2 s: 80, 8 s: 50, 20 s: 29. */
export function startupScore(seconds: number): number {
  return (100 * 8) / (8 + Math.max(0, seconds));
}

/** Rebuffering share of the viewing time: rebuffer / (watch + rebuffer), 0 when nothing was played. */
export function rebufferRatio(rebufferMs: number, watchMs: number): number {
  const total = rebufferMs + watchMs;
  return total > 0 ? rebufferMs / total : 0;
}

/**
 * Smoothness score of ONE attempt, 0..100: the mean of 1/sqrt(1+(count/2)^2) and exp(-10 * rebufferRatio).
 * The SQL rollup sums exactly this per started attempt.
 */
export function smoothnessScore(rebufferCount: number, ratio: number): number {
  const byCount = 100 / Math.sqrt(1 + Math.pow(Math.max(0, rebufferCount) / 2, 2));
  const byTime = 100 * Math.exp(-10 * Math.max(0, ratio));
  return (byCount + byTime) / 2;
}

export type SampleLevel = "none" | "low" | "ok";

/** Honest sample size: "none" (no measurement) is never rendered as zero. */
export function sampleLevel(n: number, min = LOW_N_ATTEMPTS): SampleLevel {
  return n <= 0 ? "none" : n < min ? "low" : "ok";
}

export const lowSampleText = (n: number): string => `Mała próba: n = ${n}. Traktuj liczby jako orientacyjne.`;

const safeDiv = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export type QoeTotals = {
  attempts: number;
  started: number;
  views: number;
  exitsBeforeStart: number;
  errors: number;
  fatalErrors: number;
  watchMs: number;
  rebufferMs: number;
  rebufferCount: number;
  rebufferedAttempts: number;
  switches: number;
  bitrateSum: number;
  bitrateN: number;
  startupN: number;
  startupScoreSum: number;
  smoothnessSum: number;
  smoothnessN: number;
};

export const emptyTotals = (): QoeTotals => ({
  attempts: 0, started: 0, views: 0, exitsBeforeStart: 0, errors: 0, fatalErrors: 0, watchMs: 0, rebufferMs: 0, rebufferCount: 0,
  rebufferedAttempts: 0, switches: 0, bitrateSum: 0, bitrateN: 0, startupN: 0, startupScoreSum: 0, smoothnessSum: 0, smoothnessN: 0,
});

export function addTotals(a: QoeTotals, b: Partial<QoeTotals>): QoeTotals {
  const out = { ...a };
  for (const k of Object.keys(out) as (keyof QoeTotals)[]) out[k] = a[k] + (b[k] ?? 0);
  return out;
}

export type QoeSummary = {
  attempts: number;
  sample: SampleLevel;
  /** Share of attempts that left before the first frame; null = no attempts. */
  exitBeforeStartPct: number | null;
  /** Share of attempts that ended with an error (any, fatal or recovered). */
  errorPct: number | null;
  fatalErrorPct: number | null;
  /** Rebuffering as a share of viewing time. */
  rebufferPct: number | null;
  rebufferedAttemptsPct: number | null;
  startupScore: number | null;
  smoothnessScore: number | null;
  /** Share of started attempts without a fatal error, 0..100. */
  playbackSuccessScore: number | null;
  /** Equal-weight mean of the three scores above; our own composite, not Mux's weighted one. */
  experienceScore: number | null;
  avgBitrateKbps: number | null;
  switchesPerAttempt: number | null;
};

export function summarizeQoe(t: QoeTotals): QoeSummary {
  const startup = safeDiv(t.startupScoreSum, t.startupN);
  const smooth = safeDiv(t.smoothnessSum, t.smoothnessN);
  const success = t.attempts > 0 ? 100 * (1 - Math.min(1, t.fatalErrors / t.attempts)) : null;
  const parts = [startup, smooth, success].filter((v): v is number => v !== null);
  const pct = (a: number, b: number) => (b > 0 ? (100 * a) / b : null);
  return {
    attempts: t.attempts,
    sample: sampleLevel(t.attempts),
    exitBeforeStartPct: pct(t.exitsBeforeStart, t.attempts),
    errorPct: pct(t.errors, t.attempts),
    fatalErrorPct: pct(t.fatalErrors, t.attempts),
    rebufferPct: t.watchMs + t.rebufferMs > 0 ? 100 * rebufferRatio(t.rebufferMs, t.watchMs) : null,
    rebufferedAttemptsPct: pct(t.rebufferedAttempts, t.started),
    startupScore: startup,
    smoothnessScore: smooth,
    playbackSuccessScore: success,
    experienceScore: parts.length === 3 ? parts.reduce((a, b) => a + b, 0) / 3 : null,
    avgBitrateKbps: safeDiv(t.bitrateSum, t.bitrateN),
    switchesPerAttempt: safeDiv(t.switches, t.started),
  };
}

/** Error classes written by the player as "hls:<type>:<details>" or "media:<code>"; the label is for people. */
export function errorClassLabel(code: string): string {
  if (code.startsWith("media:")) return `Błąd przeglądarki (${code.slice(6)})`;
  if (code.startsWith("hls:")) {
    const [, type = "", details = ""] = code.split(":");
    const t = ({ networkError: "sieć", mediaError: "dekodowanie", otherError: "inny", muxError: "mux" } as Record<string, string>)[type] ?? type;
    return `Odtwarzacz HLS, ${t}${details ? `: ${details}` : ""}`;
  }
  return code;
}

/** Ladder class (rendition height) shown as "720p"; 0 means the player did not report a height. */
export const ladderLabel = (height: number): string => (height === 0 ? "bez danych o jakości" : `do ${height}p`);
