/**
 * Per-video fundraising goal (CLAUDE.md "Fundraising progress bar").
 *
 * Tips are not attributed to a video (the tip gate never sends one), so the
 * honest source is every successful tip on the channel, net of refunds, since
 * the goal's start (`fundraisingStartAt`, null = since the beginning). Tips in
 * other currencies are converted to the goal's currency with the approximate
 * display rates below; the public bar shows no numbers, so an approximate rate
 * only moves the bar slightly.
 *
 * Public DTOs only ever carry the resulting 0..1 fraction, never an amount.
 */
import {
  DISPLAY_EUR_TO_PLN_RATE,
  DISPLAY_USD_TO_PLN_RATE,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from "@/lib/constants";

export type FundraisingGoalFields = {
  fundraisingGoalMinor?: number | null;
  fundraisingGoalCurrency?: string | null;
  fundraisingStartAt?: Date | null;
};

/** Net successful tips in one currency (minor units). */
export type CurrencyTotal = { currency: string; netMinor: number };

function positiveRate(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Approximate value of one unit of each currency in PLN (display only). */
export function fundraisingRatesToPln(): Record<SupportedCurrency, number> {
  return {
    PLN: 1,
    EUR: DISPLAY_EUR_TO_PLN_RATE,
    USD: DISPLAY_USD_TO_PLN_RATE,
    CHF: positiveRate(process.env.DISPLAY_CHF_TO_PLN_RATE, 4.5),
    GBP: positiveRate(process.env.DISPLAY_GBP_TO_PLN_RATE, 4.9),
  };
}

function rateFor(currency: string, rates: Record<SupportedCurrency, number>): number | null {
  const code = currency.toUpperCase();
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code) ? rates[code as SupportedCurrency] : null;
}

/** True when the video has a usable goal (positive amount in a supported currency). */
export function hasFundraisingGoal(video: FundraisingGoalFields): boolean {
  return (
    typeof video.fundraisingGoalMinor === "number" &&
    video.fundraisingGoalMinor > 0 &&
    typeof video.fundraisingGoalCurrency === "string" &&
    rateFor(video.fundraisingGoalCurrency, fundraisingRatesToPln()) !== null
  );
}

/**
 * Fraction of the goal reached, 0..1, or null when there is no goal. Floored to
 * whole percents (so the bar is full only once the goal is really reached, and
 * the public value carries as little information as possible); any progress
 * above zero shows at least 1%.
 */
export function computeFundraisingProgress(
  video: FundraisingGoalFields,
  totals: CurrencyTotal[],
  rates: Record<SupportedCurrency, number> = fundraisingRatesToPln(),
): number | null {
  if (!hasFundraisingGoal(video)) return null;
  const goalMinor = video.fundraisingGoalMinor as number;
  const goalRate = rateFor(video.fundraisingGoalCurrency as string, rates) as number;

  let raisedInGoalMinor = 0;
  for (const total of totals) {
    const rate = rateFor(total.currency, rates);
    if (rate === null || !(total.netMinor > 0)) continue;
    raisedInGoalMinor += (total.netMinor * rate) / goalRate;
  }

  const raw = raisedInGoalMinor / goalMinor;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (raw >= 1) return 1;
  return Math.max(0.01, Math.floor(raw * 100) / 100);
}

/** Only the fundraising fields that are present, for a Prisma video update. */
export function pickFundraisingUpdate(input: FundraisingGoalFields): FundraisingGoalFields {
  const data: FundraisingGoalFields = {};
  if (input.fundraisingGoalMinor !== undefined) data.fundraisingGoalMinor = input.fundraisingGoalMinor;
  if (input.fundraisingGoalCurrency !== undefined) data.fundraisingGoalCurrency = input.fundraisingGoalCurrency;
  if (input.fundraisingStartAt !== undefined) data.fundraisingStartAt = input.fundraisingStartAt;
  return data;
}
