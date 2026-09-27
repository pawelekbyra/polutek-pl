"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { X } from "../icons";
import { Dialog, DialogOverlay, DialogPopup, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "../LanguageContext";
import { useAuthModal } from "../auth/AuthModalProvider";
import { cn } from "@/lib/utils";
import { APP_NAME, type SupportedCurrency } from "@/lib/constants";
import { detectDefaultCurrency } from "@/lib/payments/detect-currency";
import { checkoutStripePromise, useCheckoutFlow } from "@/lib/hooks/useCheckoutFlow";
import {
  TIP_WALLETS,
  getTipMethodTiles,
  readLastTipMethod,
  rememberTipMethod,
  type TipStep,
  type TipWallet,
} from "../support/tip-flow-config";
import { TipRecipientStep } from "../support/TipRecipientStep";
import { TipDisclaimerStep } from "../support/TipDisclaimerStep";
import { TipAmountStep } from "../support/TipAmountStep";
import { TipMethodStep } from "../support/TipMethodStep";
import { TipPayStep } from "../support/TipPayStep";
import { TipThanksStep } from "../support/TipThanksStep";
import { TipBackContext } from "../support/TipStepLayout";

interface SupportModalProps {
  onClose: () => void;
}

const STEPS: TipStep[] = ["recipient", "disclaimer", "amount", "method", "pay"];

/**
 * The tip gate (TEMP_SUPPORT_AS_MODAL experiment, see lib/temp-support-modal.ts):
 * "Kwota napiwku" → "Metoda napiwku" → the chosen method's form → thank-you. A fixed-size window
 * on desktop, full screen on phones; the frame (badge, dots, back, ✕, footer button) never
 * changes size between steps.
 *
 * Stripe decides which methods a tip can use: the intent is created with automatic payment
 * methods after step 1 and its `payment_method_types` become the tiles (plus Apple Pay /
 * Google Pay when the device has one); the chosen one is then confirmed with its own Stripe.js
 * call on the same intent. Success still reconciles through
 * /api/payments/[id] → fulfillPayment(). Mounted only while open, so each opening starts fresh.
 */
export default function SupportModal({ onClose }: SupportModalProps) {
  const { language } = useLanguage();
  const isPl = language === "pl";
  const { open: openAuthModal } = useAuthModal();

  const flow = useCheckoutFlow({
    isPl,
    logPrefix: "TipFlow",
    // The PaymentIntent description: shown in the BLIK banking app and on statements.
    title: isPl ? `Napiwek dla ${APP_NAME}` : `Tip for ${APP_NAME}`,
    getMinAmountTooLowMessage: useCallback(
      (min: number, currency: string) =>
        isPl ? `Minimalna kwota napiwku to ${min} ${currency}` : `Minimum tip amount is ${min} ${currency}`,
      [isPl],
    ),
    attemptFinishedMessage: isPl
      ? "Ta próba płatności jest zakończona. Rozpocznij nową wpłatę."
      : "This payment attempt is finished. Start a new support attempt.",
  });

  // Controls the Base UI dialog open state. Starts true (component only mounts when open).
  // On close we set false first so Base UI can apply data-closed and play the slide-up
  // animation before the parent unmounts the component.
  const [localOpen, setLocalOpen] = useState(true);

  const [currency, setCurrency] = useState<SupportedCurrency>(() => detectDefaultCurrency(isPl ? "pl" : "en"));
  const [amount, setAmount] = useState<number | "">("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [step, setStep] = useState<TipStep>("recipient");
  const [pickedMethod, setPickedMethod] = useState<string | null>(() => readLastTipMethod());
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [wallets, setWallets] = useState<TipWallet[]>([]);

  // Apple Pay / Google Pay get a tile only when this browser has one set up.
  useEffect(() => {
    let active = true;
    checkoutStripePromise
      ?.then((stripe) =>
        stripe
          ?.paymentRequest({
            country: "PL",
            currency: currency.toLowerCase(),
            total: { label: APP_NAME, amount: 100 },
            disableWallets: ["link", "browserCard"],
          })
          .canMakePayment(),
      )
      .then((result) => {
        if (active) setWallets(TIP_WALLETS.filter((wallet) => (wallet === "apple_pay" ? result?.applePay : result?.googlePay)));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [currency]);

  const minAmount = flow.patronBoxMinimums[currency] ?? flow.minimums[currency];
  const methods = getTipMethodTiles(flow.paymentMethodTypes, wallets);
  // The viewer's pick (or last-used method) when Stripe allows it for this tip, else the first tile.
  const method = pickedMethod && methods.includes(pickedMethod) ? pickedMethod : methods[0] ?? null;

  const handleAmountNext = async () => {
    if (!flow.userId) {
      openAuthModal("sign-in");
      return;
    }
    if (amount === "") return;
    setCreatingIntent(true);
    const ready = await flow.submit(amount, currency, minAmount, { requireTerms: false });
    setCreatingIntent(false);
    if (ready) setStep("method");
  };

  const backToAmount = () => {
    flow.resetCheckout();
    setStep("amount");
  };

  const goBack = () => {
    if (step === "pay") setStep("method");
    else if (step === "method") backToAmount();
    else if (step === "amount") setStep("disclaimer");
    else if (step === "disclaimer") setStep("recipient");
  };

  const handleClose = useCallback(() => {
    if (flow.isSuccess) flow.closeSuccessAndSync();
    setLocalOpen(false);
    onClose();
  }, [flow, onClose]);

  const handleTryAgain = useCallback(() => {
    flow.closeSuccessAndSync();
    backToAmount();
  }, [flow]);

  const handleConfirmed = (outcome: "succeeded" | "processing") => {
    if (flow.paymentId) flow.trackConfirmedPayment(flow.paymentId, outcome);
  };

  const elementsOptions: StripeElementsOptions | null = flow.clientSecret
    ? {
        clientSecret: flow.clientSecret,
        locale: isPl ? "pl" : "en",
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
      }
    : null;

  const showThanks = flow.isSuccess;
  const activeIndex = showThanks ? STEPS.length : STEPS.indexOf(step);
  const canGoBack = !showThanks && step !== "recipient";

  let body: React.ReactNode;
  if (showThanks) {
    body = (
      <TipThanksStep
        language={language}
        paymentUiStatus={flow.paymentUiStatus}
        isSyncing={flow.isSyncing}
        onRetryStatusCheck={flow.handleRetryStatusCheck}
        onTryAgain={handleTryAgain}
        onDone={handleClose}
      />
    );
  } else if (step !== "amount" && elementsOptions && amount !== "") {
    body = (
      // One Elements group per intent; the per-method forms confirm against its client secret.
      <Elements key={flow.clientSecret} stripe={checkoutStripePromise} options={elementsOptions}>
        {step === "method" || !method ? (
          <TipMethodStep
            language={language}
            amount={amount}
            currency={currency}
            methods={methods}
            selected={method}
            onSelect={setPickedMethod}
            onNext={() => {
              if (!method) return;
              rememberTipMethod(method);
              setStep("pay");
            }}
            onChangeAmount={backToAmount}
          />
        ) : (
          <TipPayStep
            language={language}
            amount={amount}
            currency={currency}
            method={method}
            clientSecret={flow.clientSecret!}
            paymentId={flow.paymentId}
            userEmail={flow.userEmail}
            stripePromise={checkoutStripePromise}
            onChangeMethod={() => setStep("method")}
            onConfirmed={handleConfirmed}
          />
        )}
      </Elements>
    );
  } else if (step === "recipient") {
    body = (
      <TipRecipientStep
        language={language}
        termsAccepted={termsAccepted}
        onTermsChange={setTermsAccepted}
        onNext={() => setStep("disclaimer")}
        onClose={handleClose}
      />
    );
  } else if (step === "disclaimer") {
    body = (
      <TipDisclaimerStep
        language={language}
        onNext={() => setStep("amount")}
        onClose={handleClose}
      />
    );
  } else {
    body = (
      <TipAmountStep
        language={language}
        currency={currency}
        onCurrencyChange={setCurrency}
        amount={amount}
        onAmountChange={setAmount}
        minAmount={minAmount}
        onNext={() => void handleAmountNext()}
        busy={creatingIntent || flow.isInitialLoading}
      />
    );
  }

  return (
    // `disablePointerDismissal`: Stripe's 3DS/wallet/BLIK overlays are appended to <body> and
    // must never count as outside presses that close the gate mid-payment.
    <Dialog open={localOpen} onOpenChange={(open) => { if (!open) handleClose(); }} disablePointerDismissal>
      <DialogPortal>
        <DialogOverlay className="tip-gate-overlay z-[9990] bg-black/40 supports-backdrop-filter:backdrop-blur-sm" />
        <DialogPopup
          data-testid="support-modal"
          className="fixed inset-0 z-[9991] flex h-[100dvh] w-screen tip-gate-surface flex-col overflow-hidden outline-none md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(640px,90dvh)] md:w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[24px] md:border md:border-[var(--chan-line)] md:shadow-[0_30px_80px_-30px_rgba(17,24,39,0.14)]"
        >
          <DialogTitle className="sr-only">{isPl ? "Bramka napiwkowa" : "Tip gate"}</DialogTitle>

          <header className="flex shrink-0 items-center gap-2 px-5 pb-2 pt-[max(12px,env(safe-area-inset-top))] md:px-7 md:pt-4">
            <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--chan-ink)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white">
              {isPl ? "Bramka napiwkowa" : "Tip gate"}
            </span>
            <div className="ml-auto w-[80px]" aria-hidden="true">
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--chan-line)]">
                <div
                  className="h-full rounded-full bg-[var(--chan-ink)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
                  style={{ width: `${Math.round((activeIndex / STEPS.length) * 100)}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label={isPl ? "Zamknij" : "Close"}
              className="-mr-2 ml-1 flex h-10 w-10 items-center justify-center rounded-full text-[var(--chan-ink)] transition-colors hover:bg-[var(--chan-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)]"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div
            key={showThanks ? "thanks" : step}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TipBackContext.Provider value={canGoBack ? { onBack: goBack, label: isPl ? "Wstecz" : "Back" } : null}>
              {body}
            </TipBackContext.Provider>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
