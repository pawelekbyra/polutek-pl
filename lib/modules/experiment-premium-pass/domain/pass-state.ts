// experiment: premium-pass (docs/experiments/premium-pass.md)
// The demo pass record and its state. Pure: no I/O, safe on the client.
import { z } from "zod";
import { PASS_CURRENCY, PASS_PRODUCTS, type PassProductId } from "./config";

export const PASS_METHODS = ["blik", "card", "apple_pay", "google_pay", "p24"] as const;
export type PassMethod = (typeof PASS_METHODS)[number];

/** The draft terms shown in the demo (the real terms come with a lawyer, plan section 9). */
export const PASS_TERMS_VERSION = "demo-2026-10";

const productIds = PASS_PRODUCTS.map((product) => product.id) as [PassProductId, ...PassProductId[]];

/** One AppSetting row per account (`xp.premium_pass:<User.id>`); only the account id, never e-mail or name. */
export const demoPassRecordSchema = z.object({
  v: z.literal(1),
  product: z.enum(productIds),
  provider: z.literal("DEMO"),
  ref: z.string().regex(/^DEMO-[A-Z0-9]{4}-[A-Z0-9]{4}$/),
  priceMinor: z.number().int().nonnegative(),
  currency: z.literal(PASS_CURRENCY),
  method: z.enum(PASS_METHODS),
  requestId: z.string().uuid(),
  grantedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  consents: z.object({ termsVersion: z.string(), waiverAt: z.string().datetime() }),
});

export type DemoPassRecord = z.infer<typeof demoPassRecordSchema>;

export type PassState =
  | { state: "none" }
  | { state: "active"; record: DemoPassRecord }
  | { state: "expired"; record: DemoPassRecord };

/** Expiry is computed on every read (`expiresAt <= now` = expired): no cron. */
export function passStateOf(record: DemoPassRecord | null, now: Date): PassState {
  if (!record) return { state: "none" };
  return new Date(record.expiresAt).getTime() > now.getTime() ? { state: "active", record } : { state: "expired", record };
}

/** Bad or foreign JSON is "no pass", never an exception. */
export function parseDemoPassRecord(raw: string | null | undefined): DemoPassRecord | null {
  if (!raw) return null;
  try {
    const parsed = demoPassRecordSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
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

/** `pa•••@gmail.com`: what the checkout shows of the account e-mail. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes("@")) return null;
  const [local, domain] = email.split("@");
  return `${(local ?? "").slice(0, 2)}•••@${domain}`;
}

/** The pass state the browser may see (own account only): no request id. */
export type PassStatusDto =
  | { state: "none" }
  | { state: "active" | "expired"; product: PassProductId; ref: string; expiresAt: string; grantedAt: string; method: PassMethod; priceMinor: number; waiverAt: string };

export function toPassStatusDto(state: PassState): PassStatusDto {
  if (state.state === "none") return { state: "none" };
  const { record } = state;
  return {
    state: state.state,
    product: record.product,
    ref: record.ref,
    expiresAt: record.expiresAt,
    grantedAt: record.grantedAt,
    method: record.method,
    priceMinor: record.priceMinor,
    waiverAt: record.consents.waiverAt,
  };
}
