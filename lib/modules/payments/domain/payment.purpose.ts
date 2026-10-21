// experiment: premium-pass (docs/experiments/premium-pass.md)
// What a Payment row is for. A tip has no purpose marker (every payment before the patron zone is a tip); a payment
// for the patron zone carries `metadata.purpose` on the Payment row AND on its PaymentIntent, so the one canonical
// fulfilment path (fulfillPayment) can tell them apart without a schema change.
export const PAYMENT_PURPOSE_PREMIUM_PASS = "premium_pass";

export function isPremiumPassPayment(metadata: unknown): boolean {
  return (metadata as { purpose?: unknown } | null)?.purpose === PAYMENT_PURPOSE_PREMIUM_PASS;
}
