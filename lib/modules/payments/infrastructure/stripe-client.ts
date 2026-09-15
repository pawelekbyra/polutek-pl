import Stripe from "stripe";

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

let stripeClient: Stripe | null = null;

/**
 * Returns the single shared Stripe client for the app.
 *
 * Constructed lazily (so a missing `STRIPE_SECRET_KEY` only throws when Stripe is actually
 * needed, never at import time) and memoized afterward. Every call site that needs a Stripe
 * client must go through this helper instead of constructing `new Stripe(...)` itself, so the
 * API version and client config live in exactly one place.
 */
export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is missing");
  }

  stripeClient = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  return stripeClient;
}
