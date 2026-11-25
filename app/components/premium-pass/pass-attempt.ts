"use client";
// patron zone (docs/architecture/patron-zone.md): the payment attempt of the patron checkout (one request id per tab =
// one PaymentIntent on the server) and how long the checkout waits for the server to record a confirmed payment.
import { newRequestId } from "./pass-copy";

const ATTEMPT_KEY = "pp:patron-attempt-id";
/**
 * Waiting for the server to record the payment ("Premium od razu po płatności"): the payment-status endpoint is asked
 * every second (it checks the PaymentIntent in Stripe itself and, on `succeeded`, grants through fulfillPayment()).
 * A card / wallet that Stripe.js reported as succeeded gets ~12 s, a bank or BLIK still processing ~15 s; after that
 * the "taking longer" screen with "Check again" (another ~5 s).
 */
export const POLL_INTERVAL_MS = 1_000;
export const POLL_AFTER_SUCCEEDED = 12;
export const POLL_AFTER_PROCESSING = 15;
export const POLL_AFTER_REDIRECT = 15;
export const POLL_CHECK_AGAIN = 5;

/** One attempt = one request id = one PaymentIntent on the server (kept for the tab, like the tip gateway's). */
export function attemptId(): string {
  try {
    const stored = window.sessionStorage.getItem(ATTEMPT_KEY);
    if (stored) return stored;
    const fresh = newRequestId();
    window.sessionStorage.setItem(ATTEMPT_KEY, fresh);
    return fresh;
  } catch {
    return newRequestId();
  }
}

export function resetAttempt() {
  try {
    window.sessionStorage.removeItem(ATTEMPT_KEY);
  } catch {
    // storage blocked: the next attempt simply gets a new id
  }
}
