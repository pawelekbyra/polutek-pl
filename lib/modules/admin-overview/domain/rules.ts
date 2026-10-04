/**
 * Pure rules of the overview: one revenue definition, health classification and thresholds.
 * Kept free of I/O so tests pin them down exactly.
 */
import { DISPLAY_EUR_TO_PLN_RATE, DISPLAY_USD_TO_PLN_RATE } from "@/lib/constants";
import type { HealthCheckDto, HealthSummary, StateKind } from "./types";

/**
 * Revenue = tips with status SUCCEEDED or PARTIALLY_REFUNDED, net of what was refunded
 * (admin-panel.md, module 5, F1: "jedną definicją"). DISPUTED/REFUNDED/FAILED/PENDING never count.
 */
export const REVENUE_STATUSES = ["SUCCEEDED", "PARTIALLY_REFUNDED"] as const;

export function netMinor(p: { amountMinor: number; refundedAmountMinor: number }): number {
  return Math.max(0, p.amountMinor - Math.max(0, p.refundedAmountMinor));
}

function positiveRate(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Approximate PLN value of a minor amount, with the same display rates as the fundraising bar
 * (DISPLAY_*_TO_PLN_RATE). Unknown currencies return null and are listed separately, never guessed.
 */
export function minorToPln(minor: number, currency: string, env: Record<string, string | undefined> = process.env): number | null {
  const code = currency.toUpperCase();
  const rates: Record<string, number> = {
    PLN: 1,
    EUR: DISPLAY_EUR_TO_PLN_RATE,
    USD: DISPLAY_USD_TO_PLN_RATE,
    CHF: positiveRate(env.DISPLAY_CHF_TO_PLN_RATE, 4.5),
    GBP: positiveRate(env.DISPLAY_GBP_TO_PLN_RATE, 4.9),
  };
  const rate = rates[code];
  return rate === undefined ? null : (minor / 100) * rate;
}

export const STATE_WORD: Record<StateKind, string> = { ok: "OK", warn: "Uwaga", crit: "Błąd", info: "Info" };

const RANK: Record<StateKind, number> = { crit: 3, warn: 2, info: 1, ok: 0 };

export function worstKind(kinds: StateKind[]): StateKind {
  return kinds.reduce<StateKind>((acc, k) => (RANK[k] > RANK[acc] ? k : acc), "ok");
}

/** Stale = older than twice the expected interval (DESIGN-SYSTEM.md: "Wiek danych"). */
export function isStale(measuredAt: string | null, everyMin: number, now: Date): boolean {
  if (!measuredAt) return true;
  return now.getTime() - new Date(measuredAt).getTime() > everyMin * 2 * 60_000;
}

export function summarizeHealth(checks: HealthCheckDto[], now: Date): HealthSummary {
  const counts = { ok: 0, warn: 0, crit: 0, info: 0 };
  for (const c of checks) counts[c.kind] += 1;
  // "info" (= not measured yet) never turns the dot amber: missing data is shown, not alarmed.
  const kind = worstKind(checks.map((c) => c.kind).filter((k) => k !== "info"));
  const worst = checks.filter((c) => c.kind === kind && kind !== "ok");
  const headline =
    kind === "ok"
      ? `Działa: ${counts.ok} z ${counts.ok + counts.warn + counts.crit} kontroli OK`
      : `${kind === "crit" ? "Problem" : "Działa, uwaga"}: ${worst.map((c) => c.label).slice(0, 2).join(", ")}${worst.length > 2 ? ` i ${worst.length - 2} więcej` : ""}`;
  return { kind, word: STATE_WORD[kind], headline, counts, checks, measuredAt: now.toISOString() };
}

/** Percent thresholds of the host limits (Ustawienia → alerty come in phase 4; until then fixed). */
export const LIMITS = {
  disk: { warnAt: 80, critAt: 90 },
  memoryUsed: { warnAt: 85, critAt: 95 },
  swap: { warnAt: 25, critAt: 60 },
} as const;

export function levelFor(percent: number | null, t: { warnAt: number; critAt: number }): StateKind {
  if (percent === null) return "info";
  if (percent >= t.critAt) return "crit";
  if (percent >= t.warnAt) return "warn";
  return "ok";
}

/** An encode job is stuck when it says RUNNING but its heartbeat is older than this. */
export const ENCODER_HEARTBEAT_STALE_MS = 2 * 60_000;
/** A queued job waiting longer than this without any running job means the encoder is not pulling. */
export const ENCODE_QUEUE_STALL_MS = 10 * 60_000;
/** PENDING tips are closed by the 24 h reconciliation; older ones mean the cron does not run. */
export const PAYMENT_PENDING_STALE_MS = 25 * 60 * 60_000;
/** A Stripe event still PROCESSING after this was abandoned mid-way. */
export const STRIPE_EVENT_STUCK_MS = 10 * 60_000;
