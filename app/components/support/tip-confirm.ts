import type { PaymentIntentResult } from "@stripe/stripe-js";

export type TipConfirmOutcome = "succeeded" | "processing";

/** Where redirect methods (Przelewy24, bank redirects) come back; the checkout flow shows the thank-you. */
export function buildTipReturnUrl(paymentId: string | null): string {
  const url = new URL(window.location.href);
  url.searchParams.set("success", "true");
  if (paymentId) url.searchParams.set("payment_id", paymentId);
  return url.toString();
}

/** Maps a Stripe confirm result to the gate's outcome, or an error message to show. */
export function readConfirmResult(
  result: PaymentIntentResult,
  isPl: boolean,
): { outcome: TipConfirmOutcome } | { error: string } {
  if (result.error) {
    return { error: result.error.message || (isPl ? "Nie udało się wysłać napiwku." : "The tip could not be sent.") };
  }
  const status = result.paymentIntent?.status;
  if (status === "succeeded") return { outcome: "succeeded" };
  if (status === "processing") return { outcome: "processing" };
  return {
    error: isPl ? "Płatność nie została ukończona. Spróbuj ponownie." : "The payment was not completed. Please try again.",
  };
}
