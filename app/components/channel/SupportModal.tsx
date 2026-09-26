"use client";

import React, { useCallback, useEffect, useState } from "react";
import { X, ArrowLeft } from "../icons";
import { Dialog, DialogOverlay, DialogPopup, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "../LanguageContext";
import { useAuthModal } from "../auth/AuthModalProvider";
import { cn } from "@/lib/utils";
import { MAIN_CREATOR_NAME, type SupportedCurrency } from "@/lib/constants";
import { detectDefaultCurrency } from "@/lib/payments/detect-currency";
import { checkoutStripePromise, useCheckoutFlow } from "@/lib/hooks/useCheckoutFlow";
import {
  getDefaultTipAmount,
  getTipMethodChoices,
  readLastTipMethod,
  rememberTipMethod,
  toServerPaymentMethod,
  type TipMethodChoice,
  type TipStep,
} from "../support/tip-flow-config";
import { TipAmountStep } from "../support/TipAmountStep";
import { TipMethodStep, type WalletKind } from "../support/TipMethodStep";
import { TipPayStep } from "../support/TipPayStep";
import { TipThanksStep } from "../support/TipThanksStep";

interface SupportModalProps {
  videoTitle?: string;
  onClose: () => void;
}

/**
 * The tip gate (TEMP_SUPPORT_AS_MODAL experiment, see lib/temp-support-modal.ts): "How much?"
 * → "How?" → send, then a thank-you. A fixed-size window on desktop, full screen on phones; the
 * frame (header, dots, footer button) never changes size between steps. The payment itself runs
 * through the canonical path: create-intent (restricted to the chosen method) → Stripe →
 * reconciliation → fulfillPayment(). Mounted only while open, so each opening starts fresh.
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
  // null until the viewer picks one: the second preset is highlighted by default.
  const [pickedAmount, setPickedAmount] = useState<number | "" | null>(null);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<TipStep>("amount");
  const [pickedChoice, setPickedChoice] = useState<TipMethodChoice | null>(() => readLastTipMethod());
  const [walletKind, setWalletKind] = useState<WalletKind>(null);
  const [pendingPay, setPendingPay] = useState(false);

  const minAmount = flow.patronBoxMinimums[currency] ?? flow.minimums[currency];
  const choices = getTipMethodChoices(currency, walletKind !== null);
  const skipMethodStep = choices.length === 1;
  const amount: number | "" =
    pickedAmount ?? (flow.isInitialLoading ? "" : getDefaultTipAmount(currency, minAmount));
  // The viewer's pick (or last-used method) when it's valid for this currency, else the first tile.
  const choice: TipMethodChoice | null =
    pickedChoice && choices.includes(pickedChoice) ? pickedChoice : choices[0] ?? null;

  // Offer Apple Pay / Google Pay only when this browser can actually use one.
  useEffect(() => {
    let active = true;
    checkoutStripePromise
      ?.then((stripe) =>
        stripe
          ?.paymentRequest({ country: "PL", currency: currency.toLowerCase(), total: { label: MAIN_CREATOR_NAME, amount: 100 } })
          .canMakePayment(),
      )
      .then((result) => {
        if (active) setWalletKind(result?.applePay ? "apple" : result?.googlePay ? "google" : null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [currency]);

  // The pay step opens once the intent (restricted to the chosen method) exists.
  const startPayment = async (selected: TipMethodChoice) => {
    if (amount === "") return;
    rememberTipMethod(selected);
    setPendingPay(true);
    const ready = await flow.submit(amount, currency, minAmount, {
      paymentMethod: toServerPaymentMethod(selected),
      message,
      requireTerms: false,
    });
    setPendingPay(false);
    if (ready) setStep("pay");
  };

  const handleAmountNext = () => {
    if (!flow.userId) {
      openAuthModal("sign-in");
      return;
    }
    if (skipMethodStep && choices[0]) void startPayment(choices[0]);
    else setStep("method");
  };

  const goBack = () => {
    if (step === "pay") {
      flow.resetCheckout();
      setStep(skipMethodStep ? "amount" : "method");
    } else if (step === "method") {
      setStep("amount");
    }
  };

  const handleClose = () => {
    // After a payment attempt this reloads on success (fresh supporter state) or strips
    // Stripe's return params; before one it's a no-op.
    if (flow.isSuccess) flow.closeSuccessAndSync();
    onClose();
  };

  const handleTryAgain = () => {
    flow.closeSuccessAndSync();
    flow.resetCheckout();
    setStep("amount");
  };

  const showThanks = flow.isSuccess;
  const steps: TipStep[] = skipMethodStep ? ["amount", "pay"] : ["amount", "method", "pay"];
  const activeIndex = showThanks ? steps.length : steps.indexOf(step);
  const canGoBack = !showThanks && step !== "amount";

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
          <DialogTitle className="sr-only">{isPl ? "Wyślij napiwek" : "Send a tip"}</DialogTitle>

          <header className="flex shrink-0 items-center justify-between px-3 pb-2 pt-[max(12px,env(safe-area-inset-top))] md:px-4 md:pt-4">
            <button
              type="button"
              onClick={goBack}
              aria-label={isPl ? "Wstecz" : "Back"}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full text-[var(--chan-ink)] transition-colors hover:bg-[var(--chan-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]",
                !canGoBack && "invisible",
              )}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {steps.map((key, index) => (
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
              className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--chan-ink)] transition-colors hover:bg-[var(--chan-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div
            key={showThanks ? "thanks" : step}
            className="flex min-h-0 flex-1 flex-col animate-in fade-in slide-in-from-right-4 duration-200 motion-reduce:animate-none"
          >
            {showThanks ? (
              <TipThanksStep
                language={language}
                paymentUiStatus={flow.paymentUiStatus}
                isSyncing={flow.isSyncing}
                onRetryStatusCheck={flow.handleRetryStatusCheck}
                onTryAgain={handleTryAgain}
                onDone={handleClose}
              />
            ) : step === "pay" && flow.clientSecret && choice && amount !== "" ? (
              <TipPayStep
                language={language}
                amount={amount}
                currency={currency}
                choice={choice}
                walletKind={walletKind}
                clientSecret={flow.clientSecret}
                paymentId={flow.paymentId}
                userEmail={flow.userEmail}
                stripePromise={checkoutStripePromise}
                onChange={() => {
                  flow.resetCheckout();
                  setStep("amount");
                }}
                onConfirmed={(outcome) => {
                  if (flow.paymentId) flow.trackConfirmedPayment(flow.paymentId, outcome);
                }}
              />
            ) : step === "method" && amount !== "" ? (
              <TipMethodStep
                language={language}
                amount={amount}
                currency={currency}
                choices={choices}
                selected={choice}
                onSelect={setPickedChoice}
                walletKind={walletKind}
                onNext={() => {
                  if (choice) void startPayment(choice);
                }}
                busy={pendingPay}
              />
            ) : (
              <TipAmountStep
                language={language}
                currency={currency}
                onCurrencyChange={(next) => {
                  setCurrency(next);
                  setPickedAmount(null);
                }}
                amount={amount}
                onAmountChange={setPickedAmount}
                // Until the per-currency minimums arrive, show the plain presets (no flicker).
                minAmount={flow.isInitialLoading ? 0 : minAmount}
                message={message}
                onMessageChange={setMessage}
                onNext={handleAmountNext}
                busy={pendingPay || flow.isInitialLoading}
              />
            )}
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
