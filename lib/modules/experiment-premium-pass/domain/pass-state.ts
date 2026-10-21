// experiment: premium-pass (docs/experiments/premium-pass.md)
// The patron-zone access grant of one account and its state. Pure: no I/O, safe on the client.
import { z } from "zod";
import { PATRON_ACCESS_DAYS, PATRON_CURRENCY, PATRON_MAX_AHEAD_DAYS } from "./config";

/** Methods the demo checkout offers (the Stripe flow uses Stripe's own method ids, any string). */
export const PASS_METHODS = ["blik", "card", "apple_pay", "google_pay", "p24"] as const;
export type PassMethod = (typeof PASS_METHODS)[number];

/** The draft terms version recorded with the consent (the real terms come with a lawyer, plan section 9). */
export const PASS_TERMS_VERSION = "patron-2026-10-draft";

const consents = z.object({ termsVersion: z.string(), waiverAt: z.string().datetime() });

/**
 * One AppSetting row per account (`xp.premium_pass:<User.id>`); only the account id, never e-mail or name. This is
 * ONLY the access mapping ("who may watch until when"): the money itself lives in the existing `Payment` ledger
 * (`provider: "STRIPE"` rows list their `paymentIds`), so deleting this row never deletes a payment.
 * `ref` is the last payment's reference (`DEMO-XXXX-XXXX`, or the Payment id), `priceMinor` the last amount and
 * `totalMinor` everything paid for this grant.
 */
export const passRecordSchema = z.object({
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

/** The first version of the experiment (two fixed passes, demo only): still readable, read as a demo grant. */
const legacyRecordSchema = z.object({
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

/** Expiry is computed on every read (`expiresAt <= now` = expired): no cron. */
export function passStateOf(record: PassRecord | null, now: Date): PassState {
  if (!record) return { state: "none" };
  return new Date(record.expiresAt).getTime() > now.getTime() ? { state: "active", record } : { state: "expired", record };
}

/** Bad or foreign JSON is "no access", never an exception. */
export function parsePassRecord(raw: string | null | undefined): PassRecord | null {
  if (!raw) return null;
  try {
    const json: unknown = JSON.parse(raw);
    const current = passRecordSchema.safeParse(json);
    if (current.success) return current.data;
    const legacy = legacyRecordSchema.safeParse(json);
    if (!legacy.success) return null;
    const { v: _v, ...rest } = legacy.data;
    return { ...rest, v: 2, totalMinor: rest.priceMinor, paymentIds: [] };
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

/** Where the new end of access lands: the current end when access is still active, else now; plus one period. */
export function extendedExpiry(current: PassRecord | null, now: Date): Date {
  const base = current && new Date(current.expiresAt).getTime() > now.getTime() ? new Date(current.expiresAt) : now;
  return addDays(base, PATRON_ACCESS_DAYS);
}

/** True when one more payment would push the end of access further than `PATRON_MAX_AHEAD_DAYS` from now. */
export function wouldExceedMaxAhead(current: PassRecord | null, now: Date): boolean {
  return extendedExpiry(current, now).getTime() - now.getTime() > PATRON_MAX_AHEAD_DAYS * 86_400_000;
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
  | { state: "active" | "expired"; provider: "DEMO" | "STRIPE"; ref: string; expiresAt: string; grantedAt: string; method: string; priceMinor: number; totalMinor: number; waiverAt: string };

export function toPassStatusDto(state: PassState): PassStatusDto {
  if (state.state === "none") return { state: "none" };
  const { record } = state;
  return {
    state: state.state,
    provider: record.provider,
    ref: record.ref,
    expiresAt: record.expiresAt,
    grantedAt: record.grantedAt,
    method: record.method,
    priceMinor: record.priceMinor,
    totalMinor: record.totalMinor,
    waiverAt: record.consents.waiverAt,
  };
}
