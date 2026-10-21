// experiment: premium-pass (docs/experiments/premium-pass.md)
// The offer the browser gets inside a PASS_REQUIRED playback plan and from /api/user/premium-pass. Offer data, never
// access data: it carries no source, token or session. Pure, safe on the client.
import {
  PATRON_ACCESS_DAYS,
  PATRON_CURRENCY,
  PATRON_DEFAULT_MINOR,
  PATRON_MAX_MINOR,
  PATRON_MIN_MINOR,
  PATRON_SUGGESTED_MINOR,
  PATRON_VAT_RATE_PERCENT,
} from "./config";
import { readPremiumPaymentsDto, type PremiumPaymentsDto } from "./payments-mode";

export type PremiumPassOffer = {
  currency: typeof PATRON_CURRENCY;
  vatRatePercent: number;
  /** Days of access one payment grants. */
  accessDays: number;
  minMinor: number;
  maxMinor: number;
  suggestedMinor: number[];
  defaultMinor: number;
  /** Number of videos in the patron zone (for "All patron videos (2)"). */
  premiumCount: number;
  signedIn: boolean;
  /** The viewer's own access ended on this date (ISO): shows the "expired" banner. */
  expiredAt?: string;
  /** Demo or Stripe (and the "Tryb testowy" flag); the server decides, the browser only displays it. */
  payments: PremiumPaymentsDto;
};

export function buildPremiumPassOffer(args: {
  signedIn: boolean;
  premiumCount: number;
  expiredAt?: string | null;
  payments?: PremiumPaymentsDto;
}): PremiumPassOffer {
  return {
    currency: PATRON_CURRENCY,
    vatRatePercent: PATRON_VAT_RATE_PERCENT,
    accessDays: PATRON_ACCESS_DAYS,
    minMinor: PATRON_MIN_MINOR,
    maxMinor: PATRON_MAX_MINOR,
    suggestedMinor: [...PATRON_SUGGESTED_MINOR],
    defaultMinor: PATRON_DEFAULT_MINOR,
    premiumCount: args.premiumCount,
    signedIn: args.signedIn,
    ...(args.expiredAt ? { expiredAt: args.expiredAt } : {}),
    payments: args.payments ?? { mode: "demo" },
  };
}

function minorList(value: unknown, fallback: readonly number[]): number[] {
  const list = Array.isArray(value) ? value.filter((n): n is number => Number.isInteger(n) && n > 0) : [];
  return list.length > 0 ? list : [...fallback];
}

/** Only well-formed offers reach the UI (a plan is parsed defensively, like every plan field). */
export function readPremiumPassOffer(value: unknown): PremiumPassOffer | null {
  if (!value || typeof value !== "object") return null;
  const offer = value as Partial<PremiumPassOffer>;
  if (!offer.payments || typeof offer.payments !== "object" || !Number.isInteger(offer.minMinor) || !Number.isInteger(offer.maxMinor)) return null;
  const base = buildPremiumPassOffer({ signedIn: offer.signedIn === true, premiumCount: typeof offer.premiumCount === "number" ? offer.premiumCount : 0 });
  return {
    ...base,
    vatRatePercent: typeof offer.vatRatePercent === "number" ? offer.vatRatePercent : base.vatRatePercent,
    accessDays: Number.isInteger(offer.accessDays) && (offer.accessDays as number) > 0 ? (offer.accessDays as number) : base.accessDays,
    minMinor: offer.minMinor as number,
    maxMinor: offer.maxMinor as number,
    suggestedMinor: minorList(offer.suggestedMinor, base.suggestedMinor),
    defaultMinor: Number.isInteger(offer.defaultMinor) ? (offer.defaultMinor as number) : base.defaultMinor,
    ...(typeof offer.expiredAt === "string" ? { expiredAt: offer.expiredAt } : {}),
    payments: readPremiumPaymentsDto(offer.payments),
  };
}

/** `25,00 zł` (pl), `PLN 25.00` (en), local format elsewhere. `intlLocale` comes from lib/i18n/ui. */
export function formatPassPrice(priceMinor: number, locale: string, currency: string = PATRON_CURRENCY): string {
  const whole = priceMinor % 100 === 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(priceMinor / 100);
}
