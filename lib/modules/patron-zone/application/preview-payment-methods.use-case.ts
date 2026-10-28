// patron zone (docs/architecture/patron-zone.md)
// Which payment methods Stripe offers for a currency and an amount, BEFORE the buyer pressed "Dalej" in step 2 (so
// the tiles show Stripe's real list, not a guess). Stripe has no "list the methods for this currency" call: the only
// source is a PaymentIntent with automatic_payment_methods, whose `payment_method_types` is the answer. So this makes
// a throw-away PROBE intent, reads the list and cancels it at once.
//
// What a probe is and is not (audit H04: no client secret before the consents):
//  - it is not a Payment: nothing is written to our database, there is no `metadata.paymentId`, no user data, no
//    customer, no description; the only metadata is `probe: "patron-methods"`;
//  - its `client_secret` is never read, stored or returned, and the intent is canceled within the same request, so
//    nothing can be paid with it;
//  - the reply carries the method NAMES only (the same names the client gets after the real intent).
// The canceled probe produces a `payment_intent.canceled` webhook that the handler ignores (no known payment).
import { z } from "zod";
import { getStripeClient } from "@/lib/modules/payments";
import { logger } from "@/lib/logger";
import type { AppContext } from "@/lib/modules/shared/app-context";
import { PATRON_CURRENCIES, patronPrice, patronProduct, premiumPassFor } from "../domain/config";
import { resolvePremiumPayments } from "../domain/payments-mode";
import { passUserId } from "./pass-access";
import type { PassResult } from "./checkout-demo.use-case";

/** `metadata.probe` of the throw-away intent; the webhook handler recognises and silently ignores it. */
export const PATRON_METHODS_PROBE = "patron-methods";

/** A method list changes only when the owner edits the Stripe dashboard: ten minutes is plenty and bounds the Stripe calls. */
export const PATRON_METHODS_TTL_MS = 10 * 60_000;
/** After a Stripe error the same combination is not retried for this long (the client keeps its candidates meanwhile). */
export const PATRON_METHODS_FAILURE_TTL_MS = 30_000;
/** Short on purpose: step 2 must not hang on Stripe; on a timeout the client just keeps its default tiles. */
export const PATRON_METHODS_STRIPE_TIMEOUT_MS = 6_000;
const MAX_CACHE_ENTRIES = 64;

// The client names a product and a currency, never an amount (same as the real intent).
export const patronMethodsInputSchema = z
  .object({ productId: z.enum(["ACCESS_30D", "ACCESS_LIFETIME"]), currency: z.enum(PATRON_CURRENCIES) })
  .strict();
export type PatronMethodsInput = z.infer<typeof patronMethodsInputSchema>;

/** `paymentMethodTypes: null` = Stripe did not answer; the client keeps its candidate tiles. */
export type PatronMethodsData = { paymentMethodTypes: string[] | null };

type CacheEntry = { expiresAt: number; types: string[] | null };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<string[] | null>>();

/** Test helper: the cache lives in the process, so tests must start clean. */
export function resetPatronMethodsCache(): void {
  cache.clear();
  inFlight.clear();
}

function remember(key: string, types: string[] | null, ttlMs: number, now: number): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    for (const [k, entry] of cache) if (entry.expiresAt <= now) cache.delete(k);
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  }
  cache.set(key, { expiresAt: now + ttlMs, types });
}

async function probeStripe(keySet: "default" | "premium", amountMinor: number, currency: string): Promise<string[] | null> {
  let probeId: string | null = null;
  try {
    const stripe = getStripeClient(keySet);
    const options = { timeout: PATRON_METHODS_STRIPE_TIMEOUT_MS, maxNetworkRetries: 0 };
    const intent = await stripe.paymentIntents.create(
      { amount: amountMinor, currency: currency.toLowerCase(), automatic_payment_methods: { enabled: true }, metadata: { probe: PATRON_METHODS_PROBE } },
      options,
    );
    probeId = intent.id;
    const types = Array.isArray(intent.payment_method_types) ? intent.payment_method_types.filter((t): t is string => typeof t === "string") : [];
    return types;
  } catch (error) {
    // Details (a Stripe error can name the account configuration) stay in the log, never in the reply.
    logger.warn("[premium-pass] payment method preview failed", error instanceof Error ? error.message : String(error));
    return null;
  } finally {
    if (probeId) {
      try {
        await getStripeClient(keySet).paymentIntents.cancel(probeId, undefined, { timeout: PATRON_METHODS_STRIPE_TIMEOUT_MS, maxNetworkRetries: 1 });
      } catch (error) {
        // An unconfirmed probe without a secret in anybody's hands is harmless; only worth a line to find it by its metadata.
        logger.warn(`[premium-pass] could not cancel the method probe ${probeId}`, error instanceof Error ? error.message : String(error));
      }
    }
  }
}

/**
 * The method types Stripe offers for this product's price in this currency, or `null` when they cannot be read.
 * Same gates as the real intent (zone visible, signed in, `stripe` mode fully configured) but no purchase checks
 * and no database access: it only describes Stripe's settings.
 */
export async function previewPatronMethods(ctx: Pick<AppContext, "actor" | "now">, input: PatronMethodsInput): Promise<PassResult<PatronMethodsData>> {
  if (!premiumPassFor(ctx.actor)) return { ok: false, code: "NOT_VISIBLE" };
  if (!passUserId(ctx.actor)) return { ok: false, code: "UNAUTHORIZED" };

  const payments = resolvePremiumPayments();
  if (payments.mode !== "stripe") return { ok: false, code: "WRONG_MODE" };
  if (!payments.available) return { ok: false, code: "PAYMENTS_UNAVAILABLE" };

  const product = patronProduct(input.productId);
  const amountMinor = patronPrice(input.productId, input.currency);
  if (!product || amountMinor === null) return { ok: false, code: "PRODUCT_INVALID" };

  const keySet = payments.keySet ?? "default";
  const key = `${keySet}:${input.currency}:${amountMinor}`;
  const now = ctx.now().getTime();

  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return { ok: true, data: { paymentMethodTypes: hit.types } };

  // Concurrent requests for the same combination share one probe.
  let pending = inFlight.get(key);
  if (!pending) {
    pending = probeStripe(keySet, amountMinor, input.currency)
      .then((types) => {
        remember(key, types, types ? PATRON_METHODS_TTL_MS : PATRON_METHODS_FAILURE_TTL_MS, now);
        return types;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return { ok: true, data: { paymentMethodTypes: await pending } };
}
