// experiment: premium-pass (docs/experiments/premium-pass.md)
// Writes and withdraws the patron-zone access grant for a REAL (Stripe) payment. Called ONLY from the payments
// module's fulfillPayment() (verified webhook, payment-status fast path, reconciliation cron), inside its transaction,
// once Stripe reports the PaymentIntent `succeeded` with the amount, currency, intent and user checked against the
// local Payment row. Never from a client request. Idempotent: a payment id is applied at most once.
import { recordAlert } from "@/lib/observability";
import type { WriteTx } from "@/lib/modules/shared/db";
import { PATRON_ACCESS_DAYS, PATRON_CURRENCY, validatePatronAmount } from "../domain/config";
import { addDays, extendedExpiry, type PassRecord } from "../domain/pass-state";
import { lockPass, readPass, writePass } from "../infrastructure/pass-store";

export type PatronPaymentConsents = { termsVersion: string; waiverAt: string };

/** What the consent endpoint stores on the Payment row (`metadata.consents`); read back here when access is granted. */
export function readPaymentConsents(metadata: unknown): PatronPaymentConsents | null {
  const consents = (metadata as { consents?: Partial<PatronPaymentConsents> } | null)?.consents;
  if (!consents || typeof consents.termsVersion !== "string" || typeof consents.waiverAt !== "string") return null;
  return Number.isNaN(Date.parse(consents.waiverAt)) ? null : { termsVersion: consents.termsVersion, waiverAt: consents.waiverAt };
}

export type GrantInput = {
  userId: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
  /** Stripe method type of the payment when known (`blik`, `card`, ...). */
  method?: string | null;
  consents?: PatronPaymentConsents | null;
  now: Date;
};

export async function grantPatronAccessForPayment(tx: WriteTx, input: GrantInput): Promise<{ granted: boolean; expiresAt: string }> {
  await lockPass(tx, input.userId);
  const current = await readPass(tx, input.userId);
  if (current?.paymentIds.includes(input.paymentId)) return { granted: false, expiresAt: current.expiresAt };

  // The amount was validated when the payment was created (and the tip route cannot re-price it). An amount outside
  // the limits here would be a bug or tampering: fail closed, grant nothing, alert the owner. The payment stays in the
  // ledger as received, so the owner decides by hand (refund in Stripe, or grant after a look).
  if (input.currency.toUpperCase() !== PATRON_CURRENCY || validatePatronAmount(input.amountMinor) !== null) {
    recordAlert("premium_pass.unexpected_payment", { paymentId: input.paymentId });
    return { granted: false, expiresAt: current?.expiresAt ?? input.now.toISOString() };
  }
  if (!input.consents) recordAlert("premium_pass.paid_without_consent", { paymentId: input.paymentId });

  const active = current && new Date(current.expiresAt).getTime() > input.now.getTime();
  const expiresAt = extendedExpiry(current, input.now).toISOString();
  const keepsStripeHistory = current?.provider === "STRIPE";
  const record: PassRecord = {
    v: 2,
    provider: "STRIPE",
    ref: input.paymentId,
    priceMinor: input.amountMinor,
    totalMinor: (keepsStripeHistory ? current.totalMinor : 0) + input.amountMinor,
    currency: PATRON_CURRENCY,
    method: input.method?.trim() || "stripe",
    paymentIds: [...(keepsStripeHistory ? current.paymentIds : []), input.paymentId],
    grantedAt: active && keepsStripeHistory ? current.grantedAt : input.now.toISOString(),
    expiresAt,
    consents: input.consents ?? { termsVersion: "none", waiverAt: input.now.toISOString() },
  };
  await writePass(tx, input.userId, record);
  return { granted: true, expiresAt };
}

/**
 * A payment was refunded in full: its period leaves the grant. A partial refund, a dispute and a refund that failed
 * later are handled by the owner by hand (docs/experiments/premium-pass.md); only the full refund is automatic.
 */
export async function revokePatronAccessForPayment(
  tx: WriteTx,
  input: { userId: string; paymentId: string; amountMinor: number; now: Date },
): Promise<{ revoked: boolean }> {
  await lockPass(tx, input.userId);
  const current = await readPass(tx, input.userId);
  if (!current || !current.paymentIds.includes(input.paymentId)) return { revoked: false };
  const shortened = addDays(new Date(current.expiresAt), -PATRON_ACCESS_DAYS);
  const expiresAt = (shortened.getTime() > input.now.getTime() ? shortened : input.now).toISOString();
  await writePass(tx, input.userId, {
    ...current,
    paymentIds: current.paymentIds.filter((id) => id !== input.paymentId),
    totalMinor: Math.max(0, current.totalMinor - input.amountMinor),
    expiresAt,
  });
  return { revoked: true };
}
