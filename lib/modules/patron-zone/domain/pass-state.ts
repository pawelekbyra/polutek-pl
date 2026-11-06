// patron zone (docs/architecture/patron-zone.md)
// The patron-zone access grant of one account and its state. Pure: no I/O, safe on the client.
import { z } from "zod";
import { PATRON_CURRENCIES, PATRON_CURRENCY, PATRON_MAX_AHEAD_DAYS, PLAN_DURATIONS, type PatronProduct, type PlanDuration } from "./config";

/** Methods the demo checkout offers (the Stripe flow uses Stripe's own method ids, any string). */
export const PASS_METHODS = ["blik", "card", "apple_pay", "google_pay", "p24"] as const;
export type PassMethod = (typeof PASS_METHODS)[number];

/** The draft terms version recorded with the consent (the real terms come with a lawyer, plan section 9). */
export const PASS_TERMS_VERSION = "patron-2026-10-draft";

const consents = z.object({ termsVersion: z.string(), waiverAt: z.string().datetime() });

/**
 * One AppSetting row per account (`xp.premium_pass:<User.id>`); only the account id, never e-mail or name. This is
 * ONLY the access mapping ("who may watch, until when"): the money itself lives in the existing `Payment` ledger
 * (`provider: "STRIPE"` rows list their `paymentIds`), so deleting this row never deletes a payment.
 * Every access is TIME-LIMITED: `expiresAt` is its end (30 days or 3 calendar months per payment, PLAN_DURATIONS in
 * domain/config.ts). `lifetime`/`lifetimePaymentId` are LEGACY fields: before 2026-11-03 the second plan was unlimited
 * and wrote `lifetime: true`. New records are always written `lifetime: false, lifetimePaymentId: null`, and a stored
 * legacy record is turned into a time-limited one on read (`normalizeLegacyLifetime`, no database rewrite).
 * `ref`/`priceMinor`/`productId` describe the last payment, `totalMinor` everything paid for this grant.
 */
export const passRecordSchema = z
  .object({
    v: z.literal(3),
    provider: z.enum(["DEMO", "STRIPE"]),
    ref: z.string().min(1).max(80),
    productId: z.enum(["ACCESS_30D", "ACCESS_LIFETIME"]),
    priceMinor: z.number().int().nonnegative(),
    totalMinor: z.number().int().nonnegative(),
    /** Currency of the last payment; `totalMinor` adds up payments of this currency only (it restarts when it changes). */
    currency: z.enum(PATRON_CURRENCIES),
    method: z.string().min(1).max(40),
    requestId: z.string().uuid().optional(),
    paymentIds: z.array(z.string().min(1).max(64)).max(200),
    lifetime: z.boolean(),
    lifetimePaymentId: z.string().min(1).max(64).nullable(),
    grantedAt: z.string().datetime(),
    expiresAt: z.string().datetime().nullable(),
    consents,
  })
  .refine((r) => r.lifetime || r.expiresAt !== null, "a record that is not lifetime needs an end date");

/** Earlier versions of the patron zone (fixed passes, then pay-what-you-want, demo or real): still readable as 30-day grants. */
const legacyV2Schema = z.object({
  v: z.literal(2),
  provider: z.enum(["DEMO", "STRIPE"]),
  ref: z.string().min(1).max(80),
  priceMinor: z.number().int().nonnegative(),
  totalMinor: z.number().int().nonnegative(),
  currency: z.literal(PATRON_CURRENCY),
  method: z.string().min(1).max(40),
  requestId: z.string().uuid().optional(),
  paymentIds: z.array(z.string().min(1).max(64)).max(200),
  grantedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  consents,
});
const legacyV1Schema = z.object({
  v: z.literal(1),
  provider: z.literal("DEMO"),
  ref: z.string(),
  priceMinor: z.number().int().nonnegative(),
  currency: z.literal(PATRON_CURRENCY),
  method: z.string().min(1).max(40),
  requestId: z.string().uuid(),
  grantedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  consents,
});

export type PassRecord = z.infer<typeof passRecordSchema>;

/** A legacy "unlimited" grant (`lifetime: true`) becomes the 3-month plan counted from its grant date (never shorter than a running 30-day end). */
export function normalizeLegacyLifetime(record: PassRecord): PassRecord {
  if (!record.lifetime) return record;
  const threeMonths = addPlanDuration(new Date(record.grantedAt), PLAN_DURATIONS.ACCESS_LIFETIME);
  const runningEnd = record.expiresAt ? new Date(record.expiresAt) : null;
  const end = runningEnd && runningEnd.getTime() > threeMonths.getTime() ? runningEnd : threeMonths;
  return { ...record, lifetime: false, lifetimePaymentId: null, expiresAt: end.toISOString() };
}

export type PassState =
  | { state: "none" }
  | { state: "active"; record: PassRecord }
  | { state: "expired"; record: PassRecord };

/** Expiry is computed on every read (`expiresAt <= now` = expired): no cron. No access is unlimited; no end date = no access. */
export function isRecordActive(record: PassRecord, now: Date): boolean {
  return record.expiresAt !== null && new Date(record.expiresAt).getTime() > now.getTime();
}

export function passStateOf(record: PassRecord | null, now: Date): PassState {
  if (!record) return { state: "none" };
  return isRecordActive(record, now) ? { state: "active", record } : { state: "expired", record };
}

/** Bad or foreign JSON is "no access", never an exception. */
export function parsePassRecord(raw: string | null | undefined): PassRecord | null {
  if (!raw) return null;
  try {
    const json: unknown = JSON.parse(raw);
    const current = passRecordSchema.safeParse(json);
    if (current.success) return normalizeLegacyLifetime(current.data);
    const v2 = legacyV2Schema.safeParse(json);
    if (v2.success) {
      const { v: _v, ...rest } = v2.data;
      return { ...rest, v: 3, productId: "ACCESS_30D", lifetime: false, lifetimePaymentId: null };
    }
    const v1 = legacyV1Schema.safeParse(json);
    if (!v1.success) return null;
    const { v: _v1, ...rest } = v1.data;
    return { ...rest, v: 3, productId: "ACCESS_30D", totalMinor: rest.priceMinor, paymentIds: [], lifetime: false, lifetimePaymentId: null };
  } catch {
    return null;
  }
}

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** `DEMO-XXXX-XXXX`, unambiguous characters only. `random` returns [0, 1). */
export function newDemoRef(random: () => number = Math.random): string {
  const part = () => Array.from({ length: 4 }, () => REF_ALPHABET[Math.floor(random() * REF_ALPHABET.length)]).join("");
  return `DEMO-${part()}-${part()}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

const ZONE = "Europe/Warsaw";
const zoneFormat = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });

/** The wall clock of `ms` in Europe/Warsaw, read as UTC milliseconds (whole seconds). */
function zoneWallMs(ms: number): number {
  const p: Record<string, number> = {};
  for (const part of zoneFormat.formatToParts(new Date(ms))) if (part.type !== "literal") p[part.type] = Number(part.value);
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
}

/** Offset of Europe/Warsaw from UTC at the instant `ms`, in milliseconds. */
function zoneOffsetMs(ms: number): number {
  return zoneWallMs(ms) - Math.floor(ms / 1000) * 1000;
}

/**
 * `date` plus (or minus) `months` CALENDAR months in Europe/Warsaw: the same day and time of day; a day the target
 * month does not have is clamped to its last day (31.10 + 3 = 31.01, 30.11 + 3 = 28.02, 31.05 - 3 = 28.02); DST changes
 * never move the wall clock time. Pure, deterministic, independent of the server's time zone.
 */
export function addMonths(date: Date, months: number): Date {
  const ms = date.getTime();
  const wall = new Date(zoneWallMs(ms));
  const total = wall.getUTCFullYear() * 12 + wall.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const day = Math.min(wall.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  const subSecond = ((ms % 1000) + 1000) % 1000;
  const targetWall = Date.UTC(year, month, day, wall.getUTCHours(), wall.getUTCMinutes(), wall.getUTCSeconds()) + subSecond;
  // wall clock -> instant: look the offset up at a first guess, then confirm it once (DST edge)
  const first = targetWall - zoneOffsetMs(targetWall);
  return new Date(targetWall - zoneOffsetMs(first));
}

/** `date` plus one plan length (PLAN_DURATIONS): fixed days or calendar months. */
export function addPlanDuration(date: Date, duration: PlanDuration): Date {
  return duration.months !== undefined ? addMonths(date, duration.months) : addDays(date, duration.days);
}

/** `date` minus one plan length (a full refund takes the refunded payment back out of the end date). */
export function subtractPlanDuration(date: Date, duration: PlanDuration): Date {
  return duration.months !== undefined ? addMonths(date, -duration.months) : addDays(date, -duration.days);
}

/** Where the new end of the access lands: the current end when still active, else now; plus the plan length (extension, never overwrite). */
export function extendedExpiry(current: PassRecord | null, duration: PlanDuration, now: Date): Date {
  const end = current?.expiresAt ? new Date(current.expiresAt) : null;
  const base = end && end.getTime() > now.getTime() ? end : now;
  return addPlanDuration(base, duration);
}

/** Why a purchase must be refused BEFORE any payment is created (the server decides; the UI only displays it). */
export type PurchaseBlock = "MAX_AHEAD" | null;

export function purchaseBlock(current: PassRecord | null, product: PatronProduct, now: Date): PurchaseBlock {
  return extendedExpiry(current, product.duration, now).getTime() - now.getTime() > PATRON_MAX_AHEAD_DAYS * 86_400_000 ? "MAX_AHEAD" : null;
}

/** The access fields after one more payment of `product` (new grant or extension of a running access). Pure. */
export function applyProduct(current: PassRecord | null, product: PatronProduct, now: Date): { lifetime: false; expiresAt: string; grantedAt: string } {
  const active = current !== null && isRecordActive(current, now);
  const grantedAt = active ? current.grantedAt : now.toISOString();
  return { lifetime: false, expiresAt: extendedExpiry(current, product.duration, now).toISOString(), grantedAt };
}

/** `pa•••@gmail.com`: what the checkout shows of the account e-mail. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes("@")) return null;
  const [local, domain] = email.split("@");
  return `${(local ?? "").slice(0, 2)}•••@${domain}`;
}

/** The access state the browser may see (own account only): no request id, no payment ids. */
export type PassStatusDto =
  | { state: "none" }
  | {
      state: "active" | "expired";
      /** Legacy flag, ALWAYS false since 2026-11-03 (no access is unlimited; every access has `expiresAt`). Kept so older UI code compiles. */
      lifetime: boolean;
      provider: "DEMO" | "STRIPE";
      ref: string;
      productId: string;
      /** End of the access (30 days or 3 months from the payment); null only for a malformed record, which is never active. */
      expiresAt: string | null;
      grantedAt: string;
      method: string;
      priceMinor: number;
      currency: string;
      totalMinor: number;
      waiverAt: string;
    };

export function toPassStatusDto(state: PassState): PassStatusDto {
  if (state.state === "none") return { state: "none" };
  const { record } = state;
  return {
    state: state.state,
    lifetime: false,
    provider: record.provider,
    ref: record.ref,
    productId: record.productId,
    expiresAt: record.expiresAt,
    grantedAt: record.grantedAt,
    method: record.method,
    priceMinor: record.priceMinor,
    currency: record.currency,
    totalMinor: record.totalMinor,
    waiverAt: record.consents.waiverAt,
  };
}

