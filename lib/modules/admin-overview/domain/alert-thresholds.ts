/**
 * Alert thresholds of the host limits (Ustawienia → Progi alertów): the percentages at which disk, RAM and
 * swap turn amber ("warn") and red ("crit") in the health centre, the top-bar dot and "Dzisiaj".
 * Defaults are the fixed values of phase 1 (LIMITS). Pure functions: parsing and validation only.
 */
import { LIMITS } from "./rules";

export type Threshold = { warnAt: number; critAt: number };
export type LimitThresholds = { disk: Threshold; memoryUsed: Threshold; swap: Threshold };

export const ALERT_THRESHOLDS_SETTING_KEY = "admin_alert_thresholds";

export const THRESHOLD_FIELDS = [
  { key: "disk", label: "Dysk", hint: "zajęte miejsce na dysku serwera" },
  { key: "memoryUsed", label: "RAM", hint: "zajęta pamięć (bez pamięci podręcznej)" },
  { key: "swap", label: "Swap", hint: "zajęty swap; stałe używanie oznacza za mało RAM" },
] as const;

export type ThresholdKey = (typeof THRESHOLD_FIELDS)[number]["key"];

export const DEFAULT_LIMIT_THRESHOLDS: LimitThresholds = {
  disk: { ...LIMITS.disk },
  memoryUsed: { ...LIMITS.memoryUsed },
  swap: { ...LIMITS.swap },
};

const isPercent = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 100;

/** Field-level problems in Polish, keyed like `disk.warnAt`; an empty object = valid. */
export function validateThresholds(input: LimitThresholds): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const { key } of THRESHOLD_FIELDS) {
    const t = input[key];
    if (!isPercent(t?.warnAt)) errors[`${key}.warnAt`] = "Liczba całkowita od 1 do 100.";
    if (!isPercent(t?.critAt)) errors[`${key}.critAt`] = "Liczba całkowita od 1 do 100.";
    if (isPercent(t?.warnAt) && isPercent(t?.critAt) && t.warnAt >= t.critAt) errors[`${key}.critAt`] = "Próg błędu musi być wyższy niż próg ostrzeżenia.";
  }
  return errors;
}

/** Reads the stored JSON; anything missing or broken falls back to the default of that single field. */
export function parseStoredThresholds(raw: string | null | undefined): LimitThresholds {
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, Partial<Threshold> | undefined>;
  const merged = Object.fromEntries(
    THRESHOLD_FIELDS.map(({ key }) => {
      const candidate = { warnAt: obj[key]?.warnAt, critAt: obj[key]?.critAt };
      const ok = isPercent(candidate.warnAt) && isPercent(candidate.critAt) && candidate.warnAt < candidate.critAt;
      return [key, ok ? (candidate as Threshold) : { ...DEFAULT_LIMIT_THRESHOLDS[key] }];
    }),
  ) as LimitThresholds;
  return merged;
}
