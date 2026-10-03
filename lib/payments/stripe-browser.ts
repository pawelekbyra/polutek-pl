"use client";

import { loadStripe } from "@stripe/stripe-js/pure";
import type { Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Stripe.js for the tip gate, loaded on first use only.
 *
 * `@stripe/stripe-js/pure` injects the script when `loadStripe()` is first called, not when this
 * module is imported, so visitors who never open the tip gate download nothing from Stripe and get
 * none of its cookies or fraud-signal requests. The promise is memoized for the page's lifetime.
 */
export function getStripeBrowser(): Promise<Stripe | null> {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return Promise.resolve(null);
  stripePromise ??= loadStripe(key).catch((error: unknown) => {
    // A failed download (offline, blocked) must not stick: the next opening tries again.
    stripePromise = null;
    throw error;
  });
  return stripePromise;
}
