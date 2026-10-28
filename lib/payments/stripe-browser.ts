"use client";

import { loadStripe } from "@stripe/stripe-js/pure";
import type { Stripe } from "@stripe/stripe-js";

const stripePromises: { default: Promise<Stripe | null> | null; premium: Promise<Stripe | null> | null } = { default: null, premium: null };

/**
 * Stripe.js, loaded on first use only.
 *
 * `@stripe/stripe-js/pure` injects the script when `loadStripe()` is first called, not when this
 * module is imported, so visitors who never open a checkout download nothing from Stripe and get
 * none of its cookies or fraud-signal requests. The promise is memoized for the page's lifetime.
 *
 * `keySet` picks the publishable key: the tip gate uses the shared `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`; the
 * patron-zone checkout passes "premium" when the server says the dedicated patron-zone keys are active (the DTO's
 * `keySet`), which loads `NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY` instead. Both are inlined at build time,
 * so each must be a literal `process.env.X` read. No premium key in the build: no Stripe.js (never a silent fallback
 * to the live key for a test-mode payment).
 */
export function getStripeBrowser(keySet: "default" | "premium" = "default"): Promise<Stripe | null> {
  const key = keySet === "premium" ? process.env.NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return Promise.resolve(null);
  stripePromises[keySet] ??= loadStripe(key).catch((error: unknown) => {
    // A failed download (offline, blocked) must not stick: the next opening tries again.
    stripePromises[keySet] = null;
    throw error;
  });
  return stripePromises[keySet]!;
}
