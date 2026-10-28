// patron zone (docs/architecture/patron-zone.md)
// The SECOND switch: whether a payment in the patron zone is simulated or goes through Stripe. Pure (env passed in),
// safe on the client for the DTO type. Fail closed: only the exact value `stripe` ever reaches Stripe, and a `stripe`
// mode that is not completely and consistently configured offers NO payment at all (it never falls back to the
// demo, because the demo grants access without money).
import { isGateOpen } from "@/lib/platform-gates";
import { premiumCheckoutKeySet, stripePublishableKeyFor, stripeSecretKeyFor, stripeWebhookSecretFor } from "@/lib/payments/stripe-key-sets";

export type PremiumPaymentsMode = "demo" | "stripe";
export type StripeKeyMode = "test" | "live";

type Env = Readonly<Record<string, string | undefined>>;

/** `PREMIUM_PASS_PAYMENTS`: anything but `stripe` (missing, typo, `live`, `on`) is `demo`. */
export function parsePremiumPaymentsMode(value: string | undefined): PremiumPaymentsMode {
  return value?.trim().toLowerCase() === "stripe" ? "stripe" : "demo";
}

/** `sk_live_`/`rk_live_`/`pk_live_` are live, the `_test_` forms are test, anything else is unknown (never trusted). */
export function stripeKeyMode(key: string | undefined): StripeKeyMode | null {
  const value = key?.trim() ?? "";
  if (/^(sk|rk|pk)_live_/.test(value)) return "live";
  if (/^(sk|rk|pk)_test_/.test(value)) return "test";
  return null;
}

export type PremiumPaymentsState =
  | { mode: "demo" }
  | { mode: "stripe"; available: true; stripeMode: StripeKeyMode; keySet?: "premium" }
  | { mode: "stripe"; available: false; reason: "KEYS_MISSING" | "KEYS_MIXED" | "WEBHOOK_MISSING" | "SALES_GATE_OFF" };

/**
 * What the checkout may do right now. `stripe` is available only when the secret and the publishable key exist and
 * are of the SAME mode, the webhook secret is set (access is granted only by the verified webhook or the server-side
 * confirmation, so without it a paid customer would get nothing) and, for LIVE keys, the global sales gate is open
 * (`PLATFORM_GATE_SALES=on`: the legal entity, terms and VAT must exist first). Test keys move no real money, so they
 * work with the sales gate closed: that is how the owner tries the whole flow before the company exists.
 *
 * Which keys: when the dedicated patron-zone set (PREMIUM_PASS_STRIPE_SECRET_KEY, NEXT_PUBLIC_PREMIUM_PASS_STRIPE_
 * PUBLISHABLE_KEY, PREMIUM_PASS_STRIPE_WEBHOOK_SECRET) is fully set, every check above runs on THAT set and the tips
 * keep STRIPE_*; otherwise the checkout uses STRIPE_* exactly as before. A partly set premium set is ignored.
 */
export function resolvePremiumPayments(env: Env = process.env): PremiumPaymentsState {
  if (parsePremiumPaymentsMode(env.PREMIUM_PASS_PAYMENTS) === "demo") return { mode: "demo" };
  const keySet = premiumCheckoutKeySet(env);
  const secret = stripeKeyMode(stripeSecretKeyFor(keySet, env));
  const publishable = stripeKeyMode(stripePublishableKeyFor(keySet, env));
  if (!secret || !publishable) return { mode: "stripe", available: false, reason: "KEYS_MISSING" };
  if (secret !== publishable) return { mode: "stripe", available: false, reason: "KEYS_MIXED" };
  if (!stripeWebhookSecretFor(keySet, env)) return { mode: "stripe", available: false, reason: "WEBHOOK_MISSING" };
  if (secret === "live" && !isGateOpen("sales", env)) return { mode: "stripe", available: false, reason: "SALES_GATE_OFF" };
  return { mode: "stripe", available: true, stripeMode: secret, ...(keySet === "premium" ? { keySet: "premium" as const } : {}) };
}

/** What the browser may know: no reasons, no key material. `stripeMode: "test"` shows the "Tryb testowy" label. */
export type PremiumPaymentsDto = { mode: "demo" } | { mode: "stripe"; available: boolean; stripeMode?: StripeKeyMode; /** "premium": load Stripe.js with the patron-zone publishable key. Absent: the shared one. */ keySet?: "premium" };

export function toPremiumPaymentsDto(state: PremiumPaymentsState): PremiumPaymentsDto {
  if (state.mode === "demo") return { mode: "demo" };
  return state.available
    ? { mode: "stripe", available: true, stripeMode: state.stripeMode, ...(state.keySet ? { keySet: state.keySet } : {}) }
    : { mode: "stripe", available: false };
}

/** Only well-formed payment info reaches the UI; anything else is treated as "no payment possible". */
export function readPremiumPaymentsDto(value: unknown): PremiumPaymentsDto {
  const v = value as Partial<{ mode: string; available: boolean; stripeMode: string; keySet: string }> | null;
  if (v?.mode === "demo") return { mode: "demo" };
  if (v?.mode === "stripe") {
    return v.available === true && (v.stripeMode === "test" || v.stripeMode === "live")
      ? { mode: "stripe", available: true, stripeMode: v.stripeMode, ...(v.keySet === "premium" ? { keySet: "premium" as const } : {}) }
      : { mode: "stripe", available: false };
  }
  return { mode: "stripe", available: false };
}
