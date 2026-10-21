// experiment: premium-pass (docs/experiments/premium-pass.md)
// The patron-zone access grant of one account and its state. Pure: no I/O, safe on the client.
import { z } from "zod";
import { PATRON_CURRENCY, PATRON_MAX_AHEAD_DAYS, type PatronProduct } from "./config";

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
 * `lifetime: true` is an explicit marker (set by the unlimited option, `lifetimePaymentId` names the payment that
 * gave it); it is NOT a far-future date. `expiresAt` is the end of the 30-day access (null only while the record is
 * lifetime and never had a 30-day period). `ref`/`priceMinor`/`productId` describe the last payment, `totalMinor`
 * everything paid for this grant.
 */
export const passRecordSchema = z
  .object({
    v: z.literal(3),
    provider: z.enum(["DEMO", "STRIPE"]),
    ref: z.string().min(1).max(80),
    productId: z.enum(["ACCESS_30D", "ACCESS_LIFETIME"]),
    priceMinor: z.number().int().nonnegative(),
    totalMinor: z.number().int().nonnegative(),
    currency: z.literal(PATRON_CURRENCY),
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

/** Earlier versions of the experiment (fixed passes, then pay-what-you-want, demo or real): still readable as 30-day grants. */
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

export type PassState =
  | { state: "none" }
  | { state: "active"; record: PassRecord }
  | { state: "expired"; record: PassRecord };

/** Lifetime is active forever; otherwise expiry is computed on every read (`expiresAt <= now` = expired): no cron. */
export function isRecordActive(record: PassRecord, now: Date): boolean {
  return record.lifetime || (record.expiresAt !== null && new Date(record.expiresAt).getTime() > now.getTime());
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
    if (current.success) return current.data;
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

/** Where the new end of a 30-day access lands: the current end when still active, else now; plus the product's days. */
export function extendedExpiry(current: PassRecord | null, days: number, now: Date): Date {
  const end = current?.expiresAt ? new Date(current.expiresAt) : null;
  const base = end && end.getTime() > now.getTime() ? end : now;
  return addDays(base, days);
}

/** Why a purchase must be refused BEFORE any payment is created (the server decides; the UI only displays it). */
export type PurchaseBlock = "ALREADY_LIFETIME" | "MAX_AHEAD" | null;

export function purchaseBlock(current: PassRecord | null, product: PatronProduct, now: Date): PurchaseBlock {
  if (current && current.lifetime) return "ALREADY_LIFETIME";
  if (product.days !== null && extendedExpiry(current, product.days, now).getTime() - now.getTime() > PATRON_MAX_AHEAD_DAYS * 86_400_000) return "MAX_AHEAD";
  return null;
}

/** The access fields after one more payment of `product` (new grant or extension / conversion). Pure. */
export function applyProduct(current: PassRecord | null, product: PatronProduct, now: Date): { lifetime: boolean; expiresAt: string | null; grantedAt: string } {
  const active = current !== null && isRecordActive(current, now);
  const grantedAt = active ? current.grantedAt : now.toISOString();
  if (product.days === null) {
    // unlimited: converts a running 30-day access into a lifetime one (its end date is kept as history only)
    return { lifetime: true, expiresAt: current?.expiresAt ?? null, grantedAt };
  }
  if (current?.lifetime) return { lifetime: true, expiresAt: current.expiresAt, grantedAt }; // already unlimited: nothing to add
  return { lifetime: false, expiresAt: extendedExpiry(current, product.days, now).toISOString(), grantedAt };
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
      /** Unlimited access: the UI says "Dostęp bez limitu" instead of an end date. */
      lifetime: boolean;
      provider: "DEMO" | "STRIPE";
      ref: string;
      productId: string;
      /** End of a 30-day access; null for lifetime. */
      expiresAt: string | null;
      grantedAt: string;
      method: string;
      priceMinor: number;
      totalMinor: number;
      waiverAt: string;
    };

export function toPassStatusDto(state: PassState): PassStatusDto {
  if (state.state === "none") return { state: "none" };
  const { record } = state;
  return {
    state: state.state,
    lifetime: record.lifetime,
    provider: record.provider,
    ref: record.ref,
    productId: record.productId,
    expiresAt: record.lifetime ? null : record.expiresAt,
    grantedAt: record.grantedAt,
    method: record.method,
    priceMinor: record.priceMinor,
    totalMinor: record.totalMinor,
    waiverAt: record.consents.waiverAt,
  };
}

