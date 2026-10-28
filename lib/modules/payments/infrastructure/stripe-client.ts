import Stripe from "stripe";
import { PREMIUM_STRIPE_ENV, stripeSecretKeyFor, type StripeKeySet } from "@/lib/payments/stripe-key-sets";

/**
 * The single explicit Stripe API version the whole codebase targets.
 *
 * This matches the version pinned in the installed `stripe` npm package's own generated types
 * (`stripe/apiVersion.js` / `Stripe.LatestApiVersion` for the `stripe@20.x` line currently in
 * package.json) — i.e. the version this SDK build actually validates request/response shapes
 * against. Several call sites had drifted to a stale literal (`'2024-12-18.acacia'`) that no
 * longer exists in this SDK's types, which is why they needed an unchecked type override to compile.
 *
 * Only bump this in lockstep with a deliberate `stripe` package upgrade (and a matching check of
 * the Stripe Dashboard/webhook configuration), not independently.
 */
const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2026-02-25.clover";

const stripeClients: Partial<Record<StripeKeySet, Stripe>> = {};

/**
 * Returns the shared Stripe client of a key set (memoized per set).
 *
 * `default` is STRIPE_SECRET_KEY (tips and everything else); `premium` is PREMIUM_PASS_STRIPE_SECRET_KEY and is used
 * only for payments that carry the premium marker (see `paymentKeySet`). The premium set never falls back to the
 * default key: a payment created with test keys read with the live key would 404 (and vice versa).
 *
 * Constructed lazily (so a missing key only throws when Stripe is actually needed, never at import time). Every
 * call site that needs a Stripe client must go through this helper instead of constructing `new Stripe(...)`
 * itself, so the API version and client config live in exactly one place.
 */
export function getStripeClient(keySet: StripeKeySet = "default"): Stripe {
  const cached = stripeClients[keySet];
  if (cached) return cached;

  const key = stripeSecretKeyFor(keySet);
  if (!key) {
    throw new Error(`${keySet === "premium" ? PREMIUM_STRIPE_ENV.secretKey : "STRIPE_SECRET_KEY"} is missing`);
  }

  const client = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  stripeClients[keySet] = client;
  return client;
}
