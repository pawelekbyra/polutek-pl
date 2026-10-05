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
  const { language, method, paymentId, onConfirmed, onChangeMethod } = props;
  const tx = useOptionalTx(language);
  const stripe = useStripe();
  const elements = useElements();
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [error, setError] = useState<string | null>(null);
  const wallet = method === "apple_pay" ? "applePay" : "googlePay";

  const confirm = async () => {
    if (!stripe || !elements) return;
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: buildTipReturnUrl(paymentId) },
      redirect: "if_required",
    });
    const read = readConfirmResult(result, tx);
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
            buttonType: { applePay: "donate", googlePay: "donate" },
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
          onConfirm={() => void confirm()}
        />
      </div>
    );

  return (
    <PayStepFrame props={props} footer={footer}>
      <p className="text-[14px] leading-[1.6] text-[var(--chan-body)]">
        {state === "unavailable"
          ? tx("Ta metoda nie jest dostępna na tym urządzeniu albo w tej przeglądarce. Wybierz inną.", "This method isn't available on this device or browser. Please choose another one.")
          : tx("Kliknij przycisk na dole — otworzy się okno portfela, w którym potwierdzisz napiwek.", "Tap the button below — your wallet opens so you can confirm the tip.")}
      </p>
      <ErrorLine error={error} />
    </PayStepFrame>
  );
}

