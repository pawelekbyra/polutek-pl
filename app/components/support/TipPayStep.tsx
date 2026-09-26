"use client";

import React, { useState } from "react";
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { Stripe, StripeElementsOptions } from "@stripe/stripe-js";
import type { SupportedCurrency } from "@/lib/constants";
import { MAIN_CREATOR_NAME } from "@/lib/constants";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "../icons";
import { formatTipAmount, type TipMethodChoice } from "./tip-flow-config";
import type { WalletKind } from "./TipMethodStep";
import { TipPrimaryButton, TipStepLayout } from "./TipStepLayout";

export type TipConfirmOutcome = "succeeded" | "processing";

interface TipPayStepProps {
  language: string;
  amount: number;
  currency: SupportedCurrency;
  choice: TipMethodChoice;
  walletKind: WalletKind;
  clientSecret: string;
  paymentId: string | null;
  userEmail?: string;
  stripePromise: Promise<Stripe | null> | null;
  onChange: () => void;
  onConfirmed: (outcome: TipConfirmOutcome) => void;
}

function methodLabel(choice: TipMethodChoice, isPl: boolean, walletKind: WalletKind) {
  if (choice === "blik") return "BLIK";
  if (choice === "p24") return "Przelewy24";
  if (choice === "wallet") return walletKind === "apple" ? "Apple Pay" : "Google Pay";
  return isPl ? "Karta" : "Card";
}

export function TipPayStep(props: TipPayStepProps) {
  const { language, clientSecret, stripePromise } = props;
  const options: StripeElementsOptions = {
    clientSecret,
    locale: language === "pl" ? "pl" : "en",
    appearance: {
      theme: "flat",
      variables: {
        colorPrimary: "#2563eb",
        colorBackground: "#ffffff",
        colorText: "#1a1a1a",
        borderRadius: "12px",
        fontFamily: "var(--font-geist-sans)",
      },
    },
  };

  return (
    // Remounted per intent: Stripe Elements can't swap clientSecret in place.
    <Elements key={clientSecret} stripe={stripePromise} options={options}>
      <TipPayForm {...props} />
    </Elements>
  );
}

function TipPayForm({
  language,
  amount,
  currency,
  choice,
  walletKind,
  paymentId,
  userEmail,
  onChange,
  onConfirmed,
}: TipPayStepProps) {
  const isPl = language === "pl";
  const stripe = useStripe();
  const elements = useElements();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const formattedAmount = formatTipAmount(amount, currency, language);
  const isWallet = choice === "wallet";

  const confirm = async () => {
    if (!stripe || !elements || !termsAccepted) return;
    setIsConfirming(true);
    setErrorMessage(null);

    // Redirect methods (Przelewy24) come back here; the checkout flow then shows the thank-you.
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.set("success", "true");
    if (paymentId) returnUrl.searchParams.set("payment_id", paymentId);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl.toString(),
        // The Payment Element hides the email field when we already know it, so Stripe needs it here.
        ...(userEmail && !isWallet ? { payment_method_data: { billing_details: { email: userEmail } } } : {}),
      },
      redirect: "if_required",
    });

    setIsConfirming(false);
    if (error) {
      setErrorMessage(error.message || (isPl ? "Nie udało się wysłać napiwku." : "The tip could not be sent."));
      return;
    }
    if (paymentIntent?.status === "succeeded") onConfirmed("succeeded");
    else if (paymentIntent?.status === "processing") onConfirmed("processing");
    else setErrorMessage(isPl ? "Płatność nie została ukończona. Spróbuj ponownie." : "The payment was not completed. Please try again.");
  };

  const termsLink = (key: "terms" | "privacy", label: string) => (
    <a
      href={getLocalizedHref(isPl ? "pl" : "en", key)}
      target="_blank"
      rel="noopener noreferrer"
      className="underline hover:text-[var(--chan-ink)]"
    >
      {label}
    </a>
  );

  return (
    <TipStepLayout
      footer={
        <>
          <label className="mb-3 flex cursor-pointer items-start gap-2.5">
            <Checkbox
              id="tip-accept-terms"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              className="mt-[2px] shrink-0"
            />
            <span className="text-[12px] leading-[1.45] text-[var(--chan-muted)]">
              {isPl ? (
                <>Akceptuję {termsLink("terms", "Regulamin")} i {termsLink("privacy", "Politykę Prywatności")}</>
              ) : (
                <>I accept the {termsLink("terms", "Terms")} and {termsLink("privacy", "Privacy Policy")}</>
              )}
            </span>
          </label>
          {!isWallet && (
            <TipPrimaryButton onClick={confirm} disabled={!termsAccepted || !stripe || isConfirming} busy={isConfirming}>
              {isConfirming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  {isPl ? "Wysyłam…" : "Sending…"}
                </>
              ) : isPl ? (
                `Wyślij ${formattedAmount}`
              ) : (
                `Send ${formattedAmount}`
              )}
            </TipPrimaryButton>
          )}
        </>
      }
    >
      <div className="mb-5 flex items-center justify-between gap-3 rounded-[14px] bg-[var(--chan-amber-soft)] px-4 py-3">
        <p className="m-0 text-[14px] font-bold text-[var(--chan-ink)]">
          <span className="tabular-nums">{formattedAmount}</span>
          <span className="mx-1.5 text-[var(--chan-muted)]">·</span>
          {methodLabel(choice, isPl, walletKind)}
        </p>
        <button
          type="button"
          onClick={onChange}
          className="text-[13px] font-bold text-[var(--chan-blue)] underline-offset-2 hover:underline"
        >
          {isPl ? "Zmień" : "Change"}
        </button>
      </div>

      {isWallet ? (
        termsAccepted ? (
          <ExpressCheckoutElement
            options={{
              buttonHeight: 52,
              buttonType: { applePay: "donate", googlePay: "donate" },
              paymentMethods: { applePay: "always", googlePay: "always", link: "never", paypal: "never", amazonPay: "never", klarna: "never" },
            }}
            onConfirm={confirm}
          />
        ) : (
          <p className="rounded-[14px] border-2 border-dashed border-[var(--chan-line)] px-4 py-5 text-center text-[13px] text-[var(--chan-muted)]">
            {isPl ? "Zaznacz zgodę poniżej, a pojawi się przycisk płatności." : "Tick the consent below and the pay button will appear."}
          </p>
        )
      ) : (
        <PaymentElement
          options={{
            layout: { type: "tabs", defaultCollapsed: false },
            business: { name: MAIN_CREATOR_NAME },
            wallets: { applePay: "never", googlePay: "never", link: "never" },
            fields: { billingDetails: { email: userEmail ? "never" : "auto" } },
          }}
        />
      )}

      {errorMessage && (
        <p role="alert" className="mt-4 rounded-[12px] border border-red-100 bg-red-50 px-4 py-3 text-center text-[13px] font-medium text-red-600">
          {errorMessage}
        </p>
      )}
    </TipStepLayout>
  );
}
