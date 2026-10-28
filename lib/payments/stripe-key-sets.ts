// patron zone (docs/architecture/patron-zone.md)
// Two sets of Stripe credentials. `default` (STRIPE_*) serves the tips and everything else; `premium`
// (PREMIUM_PASS_STRIPE_*) serves only the patron-zone checkout, so the owner can run that checkout against Stripe
// TEST mode while the tips keep taking real money on the live keys. Pure (env passed in), no server imports, safe on
// the client for the types. The premium set is all-or-nothing: unless secret key, publishable key AND webhook secret
// are all set, the patron zone behaves exactly as before and uses the default set.
import { PAYMENT_PURPOSE_PREMIUM_PASS } from "@/lib/modules/payments/domain/payment.purpose";

export type StripeKeySet = "default" | "premium";

type Env = Readonly<Record<string, string | undefined>>;

/** Written to `Payment.metadata.stripeKeySet` when a payment is created with the premium set (no schema change). */
export const STRIPE_KEY_SET_METADATA_FIELD = "stripeKeySet";

export const PREMIUM_STRIPE_ENV = {
  secretKey: "PREMIUM_PASS_STRIPE_SECRET_KEY",
  publishableKey: "NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY",
  webhookSecret: "PREMIUM_PASS_STRIPE_WEBHOOK_SECRET",
} as const;

function value(env: Env, name: string): string | undefined {
  const v = env[name]?.trim();
  return v ? v : undefined;
}

/** The premium set is in use only when all three of its variables are set. */
export function premiumKeysConfigured(env: Env = process.env): boolean {
  return Boolean(value(env, PREMIUM_STRIPE_ENV.secretKey) && value(env, PREMIUM_STRIPE_ENV.publishableKey) && value(env, PREMIUM_STRIPE_ENV.webhookSecret));
}

/** Some but not all premium variables: the premium set is ignored (default keys are used); worth a warning. */
export function premiumKeysPartiallyConfigured(env: Env = process.env): boolean {
  const set = [PREMIUM_STRIPE_ENV.secretKey, PREMIUM_STRIPE_ENV.publishableKey, PREMIUM_STRIPE_ENV.webhookSecret].filter((name) => value(env, name));
  return set.length > 0 && set.length < 3;
}

export function stripeSecretKeyFor(set: StripeKeySet, env: Env = process.env): string | undefined {
  return value(env, set === "premium" ? PREMIUM_STRIPE_ENV.secretKey : "STRIPE_SECRET_KEY");
}

export function stripeWebhookSecretFor(set: StripeKeySet, env: Env = process.env): string | undefined {
  return value(env, set === "premium" ? PREMIUM_STRIPE_ENV.webhookSecret : "STRIPE_WEBHOOK_SECRET");
}

export function stripePublishableKeyFor(set: StripeKeySet, env: Env = process.env): string | undefined {
  return value(env, set === "premium" ? PREMIUM_STRIPE_ENV.publishableKey : "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
}

/** The set the patron-zone checkout uses right now: premium when fully configured, otherwise the default set. */
export function premiumCheckoutKeySet(env: Env = process.env): StripeKeySet {
  return premiumKeysConfigured(env) ? "premium" : "default";
}

/** The set a NEW payment of this purpose is created with. Tips (no purpose) always use the default set. */
export function keySetForNewPayment(purpose: string | undefined | null, env: Env = process.env): StripeKeySet {
  return purpose === PAYMENT_PURPOSE_PREMIUM_PASS ? premiumCheckoutKeySet(env) : "default";
}

/** The set an EXISTING payment belongs to, from its marker. No marker (every payment before this change) = default. */
export function paymentKeySet(metadata: unknown): StripeKeySet {
  return (metadata as Record<string, unknown> | null)?.[STRIPE_KEY_SET_METADATA_FIELD] === "premium" ? "premium" : "default";
}

/** Live keys are sk_/rk_ live; everything with a recognisable test prefix is test; anything else is unknown. */
export function secretKeyIsLive(set: StripeKeySet, env: Env = process.env): boolean | null {
  const key = stripeSecretKeyFor(set, env) ?? "";
  if (/^(sk|rk)_live_/.test(key)) return true;
  if (/^(sk|rk)_test_/.test(key)) return false;
  return null;
}
