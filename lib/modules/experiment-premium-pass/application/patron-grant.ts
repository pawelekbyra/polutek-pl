// experiment: premium-pass (docs/experiments/premium-pass.md)
// Writes and withdraws the patron-zone access grant for a REAL (Stripe) payment. Called ONLY from the payments
// module's fulfillPayment() (verified webhook, payment-status fast path, reconciliation cron), inside its transaction,
// once Stripe reports the PaymentIntent `succeeded` with the amount, currency, intent and user checked against the
// local Payment row. Never from a client request. Idempotent: a payment id is applied at most once. The product comes
// from the server-written `Payment.metadata.productId` and the amount must equal that product's price (PLN), else
// nothing is granted and the owner is alerted.
import { recordAlert } from "@/lib/observability";
import type { WriteTx } from "@/lib/modules/shared/db";
import { isPatronCurrency, patronPrice, patronProduct } from "../domain/config";
import { addDays, applyProduct, type PassRecord } from "../domain/pass-state";
import { lockPass, readPass, writePass } from "../infrastructure/pass-store";

export type PatronPaymentConsents = { termsVersion: string; waiverAt: string };

/** What the consent endpoint stores on the Payment row (`metadata.consents`); read back here when access is granted. */
export function readPaymentConsents(metadata: unknown): PatronPaymentConsents | null {
  const consents = (metadata as { consents?: Partial<PatronPaymentConsents> } | null)?.consents;
  if (!consents || typeof consents.termsVersion !== "string" || typeof consents.waiverAt !== "string") return null;
  return Number.isNaN(Date.parse(consents.waiverAt)) ? null : { termsVersion: consents.termsVersion, waiverAt: consents.waiverAt };
}

/** The product id the server wrote on the payment (`metadata.productId`); payments from before the options are 30-day. */
export function readPaymentProductId(metadata: unknown): string {
  const id = (metadata as { productId?: unknown } | null)?.productId;
  return typeof id === "string" ? id : "ACCESS_30D";
}

export type GrantInput = {
  userId: string;
  paymentId: string;
  productId: string;
  amountMinor: number;
  currency: string;
  /** Stripe method type of the payment when known (`blik`, `card`, ...). */
  method?: string | null;
  consents?: PatronPaymentConsents | null;
  now: Date;
};

export async function grantPatronAccessForPayment(tx: WriteTx, input: GrantInput): Promise<{ granted: boolean }> {
  const product = patronProduct(input.productId);
  const currency = input.currency.toUpperCase();
  // Fail closed: an unknown product or currency, or an amount that is not exactly the table's price for this product in
  // this currency, is a bug or tampering. The payment stays in the ledger as received; the owner decides by hand (refund or grant).
  if (!product || !isPatronCurrency(currency) || input.amountMinor !== patronPrice(product.id, currency)) {
    recordAlert("premium_pass.unexpected_payment", { paymentId: input.paymentId });
    return { granted: false };
  }

  await lockPass(tx, input.userId);
  const current = await readPass(tx, input.userId);
  if (current?.paymentIds.includes(input.paymentId)) return { granted: false };
  if (!input.consents) recordAlert("premium_pass.paid_without_consent", { paymentId: input.paymentId });

  const next = applyProduct(current, product, input.now);
  const keepsStripeHistory = current?.provider === "STRIPE";
  const record: PassRecord = {
    v: 3,
    provider: "STRIPE",
    ref: input.paymentId,
    productId: product.id,
    priceMinor: input.amountMinor,
    totalMinor: (keepsStripeHistory && current.currency === currency ? current.totalMinor : 0) + input.amountMinor,
    currency,
    method: input.method?.trim() || "stripe",
    paymentIds: [...(keepsStripeHistory ? current.paymentIds : []), input.paymentId],
    lifetime: next.lifetime,
    lifetimePaymentId: product.days === null ? input.paymentId : keepsStripeHistory ? current.lifetimePaymentId : null,
    grantedAt: next.grantedAt,
    expiresAt: next.expiresAt,
    consents: input.consents ?? { termsVersion: "none", waiverAt: input.now.toISOString() },
  };
  await writePass(tx, input.userId, record);
  return { granted: true };
}

/**
 * A payment was refunded in full: that payment's grant leaves the record (the lifetime marker when it came from this
 * payment, otherwise its 30 days). A partial refund, a dispute and a refund that failed later are handled by the owner
 * by hand (docs/experiments/premium-pass.md); only the full refund is automatic.
 */
export async function revokePatronAccessForPayment(
  tx: WriteTx,
  input: { userId: string; paymentId: string; productId: string; amountMinor: number; now: Date },
): Promise<{ revoked: boolean }> {
  await lockPass(tx, input.userId);
  const current = await readPass(tx, input.userId);
  if (!current || !current.paymentIds.includes(input.paymentId)) return { revoked: false };

  const product = patronProduct(input.productId);
  let lifetime = current.lifetime;
  let lifetimePaymentId = current.lifetimePaymentId;
  let expiresAt = current.expiresAt;
  if (current.lifetimePaymentId === input.paymentId) {
    lifetime = false;
    lifetimePaymentId = null;
  } else if (product?.days && expiresAt) {
    const shortened = addDays(new Date(expiresAt), -product.days);
    expiresAt = (shortened.getTime() > input.now.getTime() ? shortened : input.now).toISOString();
  }
  // a record that is no longer lifetime always has an end date: if none is left, access ends now
  if (!lifetime && expiresAt === null) expiresAt = input.now.toISOString();

  const revoked: PassRecord = {
    ...current,
    paymentIds: current.paymentIds.filter((id) => id !== input.paymentId),
    totalMinor: Math.max(0, current.totalMinor - input.amountMinor),
    lifetime,
    lifetimePaymentId,
    expiresAt,
  };
  await writePass(tx, input.userId, revoked);
  return { revoked: true };
}
