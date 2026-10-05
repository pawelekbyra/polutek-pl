import Stripe from "stripe";

/**
 * Refund states whose money is (or is about to be) gone from the payment, so they use up the refundable
 * amount: `succeeded`, `pending` (card/BLIK/P24 refund on its way to the bank) and `requires_action`
 * (Stripe waits for the payer's bank details; the refund still reserves the amount until it fails or is
 * canceled). `failed` and `canceled` refunds returned the money to the balance and do not count.
 * A missing status (older API objects) is treated as succeeded.
 * Source: https://docs.stripe.com/refunds (failed refunds, refunds requiring action)
 */
const COUNTED_REFUND_STATUSES: ReadonlySet<string> = new Set(["succeeded", "pending", "requires_action"]);

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

/** Per-request limits: this runs while a DB row lock is held, so it must fail fast instead of hanging. */
const REQUEST_OPTIONS: Stripe.RequestOptions = { timeout: 4000, maxNetworkRetries: 1 };

export function sumEffectiveRefunds(refunds: ReadonlyArray<Pick<Stripe.Refund, "amount" | "status">>): number {
  return refunds.reduce((sum, refund) => (COUNTED_REFUND_STATUSES.has(refund.status ?? "succeeded") ? sum + refund.amount : sum), 0);
}

/**
 * Stripe's current effective refunded total for one PaymentIntent, from the refund list (the one source
 * that carries each refund's status; `charge.amount_refunded` does not say what happened to failed ones).
 */
export async function fetchEffectiveRefundedMinor(stripe: Stripe, paymentIntentId: string): Promise<number> {
  const all: Stripe.Refund[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await stripe.refunds.list(
      { payment_intent: paymentIntentId, limit: PAGE_SIZE, ...(startingAfter ? { starting_after: startingAfter } : {}) },
      REQUEST_OPTIONS,
    );
    all.push(...result.data);
    if (!result.has_more || result.data.length === 0) return sumEffectiveRefunds(all);
    startingAfter = result.data[result.data.length - 1].id;
  }
  throw new Error(`REFUND_LIST_TOO_LONG: more than ${MAX_PAGES * PAGE_SIZE} refunds for ${paymentIntentId}`);
}
