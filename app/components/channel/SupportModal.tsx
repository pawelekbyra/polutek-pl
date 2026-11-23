"use client";
// The tip gate ("Bramka Napiwkowa"), opened by the Hero's "Napiwkuj" button (premium viewers) through the "polutek:open-support"
// event handled in ChannelHome (app/components/channel/tip-gate.ts). It is drawn in the premium checkout's frame (panel,
// tokens, step dots, pinned button bar, legal links, trust row; see app/components/premium-pass), with its own wording:
// a tip is a gift, never a purchase.

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Elements } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { CloseButton } from "@/components/ui/close-button";
import { useLanguage } from "../LanguageContext";
import { useAuthModal } from "../auth/AuthModalProvider";
import { LegalSheetProvider } from "../legal/LegalSheet";
import { APP_NAME, type SupportedCurrency } from "@/lib/constants";
import { getStripeBrowser } from "@/lib/payments/stripe-browser";
import { detectDefaultCurrency } from "@/lib/payments/detect-currency";
import { useCheckoutFlow } from "@/lib/hooks/useCheckoutFlow";
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
import { TipRecipientCard, TipTotalBox, tipPayMode } from "../support/TipGateParts";
import { TipBackContext } from "../support/TipStepLayout";
import { APPEARANCE } from "../premium-pass/PassPaymentStep";
import { PassSecurityFooter, PassStepDots } from "../premium-pass/PassSecurityFooter";
import { PassTrustRow } from "../premium-pass/PassTrustRow";
import passStyles from "../premium-pass/premium-pass.module.css";
import { cn } from "@/lib/utils";
import { stripeLocale } from "@/lib/i18n/ui";

interface SupportModalProps {
  onClose: () => void;
}

const STEPS: TipStep[] = ["recipient", "disclaimer", "amount", "method", "pay"];

/**
 * The tip gate. Five steps: recipient + Terms/Privacy consent → disclaimer ("a tip unlocks nothing") → amount → method →
 * that method's form, then the thank-you screen. A panel that slides in (full screen on phones); its frame (title, ✕, step
 * dots, pinned button bar, legal links) never changes size between steps, and every step scales with the window height
 * (--pass-ramp) so nothing scrolls on a laptop.
 *
 * Stripe decides which methods a tip can use: the intent is created with automatic payment
 * methods when the amount step is confirmed (and updated, not duplicated, if the amount changes)
 * and its `payment_method_types` become the tiles (plus Apple Pay / Google Pay when the device has
 * one); the chosen one is confirmed with its own Stripe.js call on the same intent. Success
 * reconciles through /api/payments/[id] → fulfillPayment(). Mounted only while open, which is
 * also when Stripe.js is first downloaded.
 */
export default function SupportModal({ onClose }: SupportModalProps) {
  const { language, tx } = useLanguage();
  const { open: openAuthModal } = useAuthModal();
  const ids = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const flow = useCheckoutFlow({ tx });
  // Stripe.js is requested here, i.e. only once somebody opens the gate.
  const stripePromise = useMemo(() => getStripeBrowser(), []);

  // Controls the Base UI dialog open state. Starts true (component only mounts when open).
  // On close we set false first so Base UI can apply data-closed and play the slide-out
  // animation before the parent unmounts the component. `dialogReady` makes the panel mount closed first, so it slides in.
  const [localOpen, setLocalOpen] = useState(true);
  const [dialogReady, setDialogReady] = useState(false);
  useEffect(() => setDialogReady(true), []);

  const [currency, setCurrency] = useState<SupportedCurrency>(() => detectDefaultCurrency(language));
  const [amount, setAmount] = useState<number | "">("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [step, setStep] = useState<TipStep>("recipient");
  const [pickedMethod, setPickedMethod] = useState<string | null>(() => readLastTipMethod());
  const [creatingIntent, setCreatingIntent] = useState(false);
  const [wallets, setWallets] = useState<TipWallet[]>([]);

  // Apple Pay / Google Pay get a tile only when this browser has one set up.
  useEffect(() => {
    let active = true;
    stripePromise
      .then((stripe) =>
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
  }, [currency, stripePromise]);

  const minAmount = flow.minimums[currency];
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
    const ready = await flow.submit(amount, currency, minAmount, termsAccepted);
    setCreatingIntent(false);
    if (ready) setStep("method");
  };

  // The intent stays: going on with a new amount updates it on the server.
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
        locale: stripeLocale(language),
        appearance: APPEARANCE,
      }
    : null;

  const showThanks = flow.isSuccess;
  const activeIndex = showThanks ? STEPS.length : STEPS.indexOf(step);
  const canGoBack = !showThanks && step !== "recipient";
  const payMode = tipPayMode();
  const sslLabel = tx("Bezpieczne połączenie SSL", "Secure SSL connection");

  // The step dots (a finished step is a button back to it; never forward: the later steps need the earlier answers).
  const goToStep = (target: number) => {
    const to = STEPS[target - 1];
    if (!to || target - 1 >= activeIndex || creatingIntent) return;
    if (step === "method" || step === "pay") {
      if (to === "method") {
        setStep("method");
        return;
      }
      flow.resetCheckout();
    }
    setStep(to);
  };
  const dots = showThanks ? null : (
    <PassStepDots
      tx={tx}
      step={activeIndex + 1}
      onStep={goToStep}
      disabled={creatingIntent}
      ariaLabel={tx("Etapy napiwku", "Tip steps")}
      pips={[tx("Odbiorca", "Recipient"), tx("O napiwkach", "About tips"), tx("Kwota", "Amount"), tx("Metoda", "Method"), tx("Płatność", "Payment")]}
    />
  );

  // Focus follows the step: its heading takes focus, so screen readers announce the new step.
  const firstStep = useRef(true);
  const stepKey = showThanks ? "thanks" : step;
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    const frame = requestAnimationFrame(() => bodyRef.current?.querySelector<HTMLElement>("[data-step-heading]")?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [stepKey]);

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
      // Keyed by amount/currency too: the intent is updated in place, and the wallet and Payment
      // Element forms must re-read it after a change.
      <Elements key={`${flow.clientSecret}:${amount}:${currency}`} stripe={stripePromise} options={elementsOptions}>
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
          <>
            {/* As the premium checkout's payment step: the recipient, the total and the trust row above the form. */}
            <div className={passStyles.payHead}>
              <TipRecipientCard tx={tx} compact mode={payMode} />
              <div>
                <TipTotalBox tx={tx} language={language} amount={amount} currency={currency} compact />
                <PassTrustRow tx={tx} mode={payMode} methods={methods} currency={currency} label={sslLabel} />
              </div>
            </div>
            <TipPayStep
              language={language}
              amount={amount}
              currency={currency}
              method={method}
              clientSecret={flow.clientSecret!}
              paymentId={flow.paymentId}
              userEmail={flow.userEmail}
              stripePromise={stripePromise}
              onChangeMethod={() => setStep("method")}
              onConfirmed={handleConfirmed}
            />
          </>
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
    <DialogPrimitive.Root open={localOpen && dialogReady} onOpenChange={(open) => { if (!open) handleClose(); }} disablePointerDismissal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className={passStyles.overlay} />
        <DialogPrimitive.Popup
          data-testid="support-modal"
          className={cn(passStyles.pass, passStyles.sheet)}
          aria-modal="true"
          aria-labelledby={`${ids}-title`}
          aria-busy={creatingIntent}
          initialFocus={titleRef}
        >
          {/* The Terms and Privacy Policy open in a sheet ON TOP of the gate (nested), so nothing here is reset. */}
          <LegalSheetProvider tx={tx} language={language} demo={false}>
            <div className={passStyles.sheetHead}>
              <div className="min-w-0 flex-1 pr-10">
                <DialogPrimitive.Title render={<h2 ref={titleRef} tabIndex={-1} id={`${ids}-title`} className={passStyles.sheetTitle} />}>
                  {tx("Bramka Napiwkowa", "Tip Gateway")}
                </DialogPrimitive.Title>
                <p className="m-0 text-[13px] leading-[18px] text-[var(--chan-body)] [text-wrap:balance]">
                  {tx("Dziękuję za wsparcie. Bezpiecznie i dobrowolnie.", "Thank you for the support. Safe and voluntary.")}
                </p>
              </div>
              <CloseButton onClick={handleClose} aria-label={tx("Zamknij", "Close")} />
            </div>

            {!showThanks && <p className={passStyles.srOnly} role="status" aria-live="polite">{tx("Krok {0} z {1}", "Step {0} of {1}", activeIndex + 1, STEPS.length)}</p>}

            <div ref={bodyRef} key={stepKey} className="flex min-h-0 flex-1 flex-col">
              <TipBackContext.Provider value={{ onBack: canGoBack ? goBack : null, label: tx("Wstecz", "Back"), gate: true, aboveBar: dots }}>
                {body}
              </TipBackContext.Provider>
            </div>

            {!showThanks && <PassSecurityFooter tx={tx} demo={false} language={language} links />}
          </LegalSheetProvider>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
