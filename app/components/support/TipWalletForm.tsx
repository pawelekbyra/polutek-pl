"use client";

import React, { useState } from "react";
import { ExpressCheckoutElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { buildTipReturnUrl, readConfirmResult } from "./tip-confirm";
import { ErrorLine, PayStepFrame, type TipPayStepProps } from "./TipPayFrame";
import { TipPrimaryButton } from "./TipStepLayout";

import { useOptionalTx } from "@/lib/i18n/language-context";
/**
 * Apple Pay / Google Pay: Stripe's own wallet button (Express Checkout Element) limited to the
 * chosen wallet, in place of our send button. The button is the wallet's official one (brand
 * rules), and Stripe decides whether this device can show it.
 */
export function TipWalletForm(props: TipPayStepProps) {
  const { language, method, paymentId, onConfirmed, onChangeMethod, patron } = props;
  const tx = useOptionalTx(language);
  const stripe = useStripe();
  const elements = useElements();
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [error, setError] = useState<string | null>(null);
  const wallet = method === "apple_pay" ? "applePay" : "googlePay";

  const confirm = async () => {
    if (!stripe || !elements) return;
    setError(null);
    if (patron && !(await patron.beforeConfirm())) {
      setError(tx("Nie udało się zapisać Twojej zgody. Spróbuj ponownie.", "We could not save your consent. Please try again."));
      return;
    }
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: patron?.returnUrl ?? buildTipReturnUrl(paymentId) },
      redirect: "if_required",
    });
    const read = readConfirmResult(result, tx, Boolean(patron));
    if ("outcome" in read) onConfirmed(read.outcome);
    else setError(read.error);
  };

  const footer =
    state === "unavailable" ? (
      <TipPrimaryButton onClick={onChangeMethod}>{tx("Wybierz inną metodę", "Choose another method")}</TipPrimaryButton>
    ) : (
      <div className="relative min-h-[52px]">
        {state === "loading" && (
          <div
            aria-hidden="true"
            className="absolute inset-0 z-10 animate-pulse rounded-[14px] bg-[var(--cm-amber-20)] motion-reduce:animate-none"
          />
        )}
        <ExpressCheckoutElement
          options={{
            buttonHeight: 52,
            buttonType: patron ? { applePay: "plain", googlePay: "plain" } : { applePay: "donate", googlePay: "donate" },
            buttonTheme: { applePay: "black", googlePay: "black" },
            paymentMethods: {
              applePay: wallet === "applePay" ? "always" : "never",
              googlePay: wallet === "googlePay" ? "always" : "never",
              link: "never",
              paypal: "never",
              amazonPay: "never",
              klarna: "never",
            },
          }}
          onReady={({ availablePaymentMethods }) =>
            setState(availablePaymentMethods?.[wallet] ? "ready" : "unavailable")
          }
          // The wallet sheet opens only once both boxes are ticked (patron payment); a tip has no click handler.
          onClick={patron ? (event) => {
            if (!patron.accepted) {
              setError(tx("Zaznacz zgody powyżej, aby zapłacić.", "Tick the boxes above to pay."));
              return;
            }
            setError(null);
            event.resolve();
          } : undefined}
          onConfirm={() => void confirm()}
        />
      </div>
    );

  return (
    <PayStepFrame props={props} footer={footer}>
      <p className="text-[14px] leading-[1.6] text-[var(--chan-body)]">
        {state === "unavailable"
          ? tx("Ta metoda nie jest dostępna na tym urządzeniu albo w tej przeglądarce. Wybierz inną.", "This method isn't available on this device or browser. Please choose another one.")
          : patron
            ? tx("Zaznacz zgody, potem kliknij przycisk na dole — otworzy się okno portfela, w którym potwierdzisz płatność.", "Tick the boxes, then tap the button below — your wallet opens so you can confirm the payment.")
            : tx("Kliknij przycisk na dole — otworzy się okno portfela, w którym potwierdzisz napiwek.", "Tap the button below — your wallet opens so you can confirm the tip.")}
      </p>
      <ErrorLine error={error} />
    </PayStepFrame>
  );
}

