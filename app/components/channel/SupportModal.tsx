"use client";

import React, { useCallback, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { X, ArrowLeft } from "../icons";
import { Dialog, DialogOverlay, DialogPopup, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "../LanguageContext";
import { useAuthModal } from "../auth/AuthModalProvider";
import { cn } from "@/lib/utils";
import type { SupportedCurrency } from "@/lib/constants";
import { detectDefaultCurrency } from "@/lib/payments/detect-currency";
import { checkoutStripePromise, useCheckoutFlow } from "@/lib/hooks/useCheckoutFlow";
import { getTipMethodTiles, readLastTipMethod, rememberTipMethod, type TipStep } from "../support/tip-flow-config";
import { TipAmountStep } from "../support/TipAmountStep";
import { TipMethodStep } from "../support/TipMethodStep";
import { TipPayStep } from "../support/TipPayStep";
import { TipThanksStep } from "../support/TipThanksStep";

interface SupportModalProps {
  videoTitle?: string;
  onClose: () => void;
}

const STEPS: TipStep[] = ["amount", "method", "pay"];

/**
 * The tip gate (TEMP_SUPPORT_AS_MODAL experiment, see lib/temp-support-modal.ts):
 * "Kwota napiwku" → "Metoda napiwku" → the chosen method's form → thank-you. A fixed-size window
 * on desktop, full screen on phones; the frame (badge, dots, back, ✕, footer button) never
 * changes size between steps.
 *
 * Stripe decides which methods a tip can use: the intent is created with automatic payment
 * methods after step 1 and its `payment_method_types` become the tiles; the chosen one is then
 * confirmed with its own Stripe.js call on the same intent. Success still reconciles through
 * /api/payments/[id] → fulfillPayment(). Mounted only while open, so each opening starts fresh.
 */
export default function SupportModal({ videoTitle, onClose }: SupportModalProps) {
  const { language } = useLanguage();
  const isPl = language === "pl";
  const { open: openAuthModal } = useAuthModal();

  const flow = useCheckoutFlow({
    isPl,
    logPrefix: "TipFlow",
    title: videoTitle || "Napiwek",
    getMinAmountTooLowMessage: useCallback(
      (min: number, currency: string) =>
        isPl ? `Minimalna kwota napiwku to ${min} ${currency}` : `Minimum tip amount is ${min} ${currency}`,
      [isPl],
    ),
    attemptFinishedMessage: isPl
      ? "Ta próba płatności jest zakończona. Rozpocznij nową wpłatę."
      : "This payment attempt is finished. Start a new support attempt.",
  });

  const [currency, setCurrency] = useState<SupportedCurrency>(() => detectDefaultCurrency(isPl ? "pl" : "en"));
  const [amount, setAmount] = useState<number | "">("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [step, setStep] = useState<TipStep>("amount");
  const [pickedMethod, setPickedMethod] = useState<string | null>(() => readLastTipMethod());
  const [creatingIntent, setCreatingIntent] = useState(false);

  const minAmount = flow.patronBoxMinimums[currency] ?? flow.minimums[currency];
  const methods = getTipMethodTiles(flow.paymentMethodTypes);
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
  };

  const handleClose = () => {
    // After a payment attempt this reloads on success (fresh supporter state) or strips
    // Stripe's return params; before one it's a no-op.
    if (flow.isSuccess) flow.closeSuccessAndSync();
    onClose();
  };

  const handleTryAgain = () => {
    flow.closeSuccessAndSync();
    backToAmount();
  };

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
  const canGoBack = !showThanks && step !== "amount";

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
      // One Elements group per intent, shared by the wallet button (step 2) and the fallback form (step 3).
      <Elements key={flow.clientSecret} stripe={checkoutStripePromise} options={elementsOptions}>
        {step === "method" || !method ? (
          <TipMethodStep
            language={language}
            amount={amount}
            currency={currency}
            paymentId={flow.paymentId}
            methods={methods}
            selected={method}
            onSelect={setPickedMethod}
            onNext={() => {
              if (!method) return;
              rememberTipMethod(method);
              setStep("pay");
            }}
            onChangeAmount={backToAmount}
            onWalletConfirmed={handleConfirmed}
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
  } else {
    body = (
      <TipAmountStep
        language={language}
        currency={currency}
        onCurrencyChange={setCurrency}
        amount={amount}
        onAmountChange={setAmount}
        minAmount={minAmount}
        termsAccepted={termsAccepted}
        onTermsChange={setTermsAccepted}
        onNext={() => void handleAmountNext()}
        busy={creatingIntent || flow.isInitialLoading}
      />
    );
  }

  return (
    // `disablePointerDismissal`: Stripe's 3DS/wallet/BLIK overlays are appended to <body> and
    // must never count as outside presses that close the gate mid-payment.
    <Dialog open onOpenChange={(open) => { if (!open) handleClose(); }} disablePointerDismissal>
      <DialogPortal>
        <DialogOverlay className="z-[9990] bg-black/40 supports-backdrop-filter:backdrop-blur-sm" />
        <DialogPopup
          data-testid="support-modal"
          className="fixed inset-0 z-[9991] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[var(--chan-card)] outline-none md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(640px,90dvh)] md:w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[24px] md:border md:border-[var(--chan-line)] md:shadow-[0_30px_80px_-30px_rgba(23,23,23,0.45)]"
        >
          <DialogTitle className="sr-only">{isPl ? "Bramka napiwkowa" : "Tip gate"}</DialogTitle>

          <header className="flex shrink-0 items-center gap-2 px-5 pb-2 pt-[max(12px,env(safe-area-inset-top))] md:px-7 md:pt-4">
            {canGoBack && (
              <button
                type="button"
                onClick={goBack}
                aria-label={isPl ? "Wstecz" : "Back"}
                className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-[var(--chan-ink)] transition-colors hover:bg-[var(--chan-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--chan-amber-soft)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--chan-amber-ink)]">
              <span aria-hidden="true">💰</span>
              {isPl ? "Bramka napiwkowa" : "Tip gate"}
            </span>
            <div className="ml-auto flex items-center gap-1.5" aria-hidden="true">
              {STEPS.map((key, index) => (
                <span
                  key={key}
                  className={cn(
                    "h-1.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none",
                    index === activeIndex ? "w-6 bg-[var(--chan-amber)]" : "w-1.5",
                    index < activeIndex ? "bg-[var(--chan-amber)]" : index > activeIndex && "bg-[var(--chan-line)]",
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label={isPl ? "Zamknij" : "Close"}
              className="-mr-2 ml-1 flex h-10 w-10 items-center justify-center rounded-full text-[var(--chan-ink)] transition-colors hover:bg-[var(--chan-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div
            key={showThanks ? "thanks" : step}
            className="flex min-h-0 flex-1 flex-col animate-in fade-in slide-in-from-right-4 duration-200 motion-reduce:animate-none"
          >
            {body}
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
