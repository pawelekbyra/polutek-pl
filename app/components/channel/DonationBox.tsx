"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";
import { detectDefaultCurrency } from "@/lib/payments/detect-currency";
import { useLanguage } from "../LanguageContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "../icons";
import CheckoutModal from "../playlist/CheckoutModal";
import DonationAmountField from "./DonationAmountField";
import DonationLegalDialog from "./DonationLegalDialog";
import {
  RegulaminContent,
  PolitykaContent,
  TermsContentEn,
  PrivacyContentEn,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_EFFECTIVE_DATE_EN,
} from "../legal/LegalDocs";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { useCheckoutFlow, checkoutStripePromise } from "@/lib/hooks/useCheckoutFlow";

interface DonationBoxProps {
  videoTitle?: string;
  /**
   * "card" (default): the sidebar tip-gate card. "modal": step 1 of the full-page support
   * modal (SupportModal) — same fields and checkout flow, without the card chrome/#donations
   * anchor, and the CTA continues to step 2 (the Stripe CheckoutModal).
   */
  variant?: "card" | "modal";
}

export default function DonationBox({ videoTitle, variant = "card" }: DonationBoxProps) {
  const isModal = variant === "modal";
  const { t, language } = useLanguage();
  const isPl = language === "pl";
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [selectedCurrency, setSelectedCurrency] = useState<string>(t.currency);
  // Free-form amount field: the viewer is never buying access, so nothing should look
  // "chosen for them".
  const [amount, setAmount] = useState<number | "">("");
  const [isRegulaminOpen, setIsRegulaminOpen] = useState(false);
  const [isPolitykaOpen, setIsPolitykaOpen] = useState(false);

  const termsErrorId = "donation-terms-error";

  const {
    userId,
    userEmail,
    isInitialLoading,
    minimums,
    patronBoxMinimums,
    isTermsAccepted,
    showTermsError,
    onTermsCheckedChange,
    isLoading,
    clientSecret,
    paymentId,
    paymentUiStatus,
    isCheckoutModalOpen,
    isMounted,
    isSuccess,
    isSyncing,
    handleRetryStatusCheck,
    closeSuccessAndSync,
    submit,
  } = useCheckoutFlow({
    isPl,
    logPrefix: "DonationBox",
    title: videoTitle || "Napiwek",
    getMinAmountTooLowMessage: useCallback(
      (minAmount: number, currency: string) =>
        isPl
          ? `Minimalna kwota napiwku to ${minAmount} ${currency}`
          : `Minimum tip amount is ${minAmount} ${currency}`,
      [isPl],
    ),
    attemptFinishedMessage: isPl
      ? "Ta próba płatności jest zakończona. Rozpocznij nową wpłatę."
      : "This payment attempt is finished. Start a new support attempt.",
  });

  const currencyKey = selectedCurrency.toUpperCase() as SupportedCurrency;
  const checkoutMinAmount = minimums[currencyKey] ?? minimums.PLN;
  // Support is a voluntary tip that grants nothing (CLAUDE.md §4.10), so the amount is always
  // free-form, bounded below by the tip-box minimum.
  const minAmount = patronBoxMinimums[currencyKey] ?? checkoutMinAmount;
  // Currency switcher is available in both languages; only the pre-selected default differs.
  const availableCurrencies = [...SUPPORTED_CURRENCIES];
  const amountTooLow = typeof amount === "number" && amount < minAmount;

  // Pre-select the default currency for the active language: PLN for Polish, geolocation-based
  // (USD/GBP/EUR/CHF) for English. The user can still switch via the currency picker.
  useEffect(() => {
    const nextCurrency = detectDefaultCurrency(language);
    setSelectedCurrency(nextCurrency);
    setAmount("");
  }, [language]);

  const handleCurrencyChange = (curr: string) => {
    setSelectedCurrency(curr);
    setAmount("");
  };

  const onSupport = useCallback(
    () => submit(amount, selectedCurrency, minAmount),
    [submit, amount, selectedCurrency, minAmount],
  );

  // Deep-link support: an external link can arrive with ?support=1#donations
  // instead of duplicating any checkout logic — the browser's native anchor scroll handles
  // #donations, and this just calls the same onSupport() the box's own button uses. Only
  // auto-calls it when onSupport() would actually proceed to checkout (signed in, terms already
  // accepted, valid amount) rather than unconditionally — isTermsAccepted always starts false on
  // a fresh mount, so calling onSupport() unconditionally here surfaced its "accept the terms"
  // error immediately on essentially every click, before the viewer had even seen the box. This
  // still fast-paths a repeat tip when everything is already filled in; otherwise it's a no-op
  // beyond revealing the box. Runs once per param, then strips it so a refresh/back-nav doesn't
  // retrigger it.
  const autoOpenTriggeredRef = useRef(false);
  useEffect(() => {
    if (autoOpenTriggeredRef.current) return;
    if (searchParams.get("support") !== "1") return;
    autoOpenTriggeredRef.current = true;
    if (userId && isTermsAccepted && amount !== "" && amount >= minAmount) {
      onSupport();
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("support");
    const query = params.toString();
    // Shallow cleanup: Next.js syncs its router with history.replaceState, so this
    // drops the param without re-rendering the page on the server (router.replace did,
    // flashing the route's loading screen).
    try {
      window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    } catch {
      // Cosmetic; the ref above already prevents re-triggering.
    }
  }, [searchParams, onSupport, pathname, userId, isTermsAccepted, amount, minAmount]);

  // A plain tip jar — "Bramka Napiwkowa". It promises nothing in return: any benefit-style
  // promise here would contradict the Terms (support is a gift, CLAUDE.md §4.10).
  // 💰 rather than 🪙 (COIN): the latter is Unicode 13.0 and rendered as a tofu box on the
  // owner's system, while MONEY BAG has been around since Unicode 6.0 and is widely covered.
  const title = isPl ? "Bramka Napiwkowa 💰" : "The Tip Gate 💰";
  const bodyCopy = isPl
    ? "Bez wsparcia widzów tego projektu by nie było. Dziękuję."
    : "This project wouldn't exist without viewers' support. Thank you.";

  return (
    <div
      id={isModal ? undefined : "donations"}
      className={isModal ? "group relative" : "group relative my-[10px] mb-3 scroll-mt-20 overflow-hidden rounded-[20px] border border-[var(--cm-amber-38)] bg-[linear-gradient(168deg,var(--chan-amber-soft),var(--cm-card-92-white)_62%)] p-[22px_24px_18px] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(23,23,23,0.03),0_24px_50px_-26px_var(--cm-amber-58)]"}
    >
      {!isModal && (
        <>
          {/* Festive ribbon along the very top edge — the tip jar's signature. Sits in the
              card's own padding so it can never collide with the copy underneath. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[5px] bg-[linear-gradient(90deg,var(--chan-amber-bright),var(--chan-amber),var(--chan-blue),var(--chan-amber),var(--chan-amber-bright))]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_20%_0%,var(--cm-amber-38),transparent_62%),radial-gradient(circle_at_84%_0%,var(--cm-blue-10),transparent_52%)]"
          />
        </>
      )}
      <div className="relative">
        <div className="mb-3 flex items-center gap-4">
          <span
            aria-hidden="true"
            className="relative flex h-12 w-12 shrink-0 -rotate-6 items-center justify-center rounded-full bg-[linear-gradient(140deg,var(--chan-amber-bright),var(--chan-amber))] text-[26px] shadow-[0_8px_20px_-6px_var(--cm-amber-58),inset_0_1px_0_rgba(255,255,255,0.45)] transition-transform duration-300 ease-out group-hover:rotate-6 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:-rotate-6 motion-reduce:group-hover:scale-100"
          >
            🐷
          </span>
          <div className="min-w-0">
            <h4 className="font-brand m-0 text-[21px] font-extrabold leading-tight tracking-[-0.035em] text-[var(--chan-ink)]">
              {title}
            </h4>
          </div>
        </div>
        <p className="m-[0_0_14px] font-sans text-[13px] leading-[1.6] text-[var(--chan-body)]">{bodyCopy}</p>

        {showTermsError && (
          <p id={termsErrorId} role="alert" className="mb-2 text-[11px] font-bold uppercase tracking-widest text-destructive">
            {t.pleaseAcceptTerms}
          </p>
        )}

        <DonationAmountField
          isPl={isPl}
          amount={amount}
          setAmount={setAmount}
          minAmount={minAmount}
          selectedCurrency={selectedCurrency}
          availableCurrencies={availableCurrencies}
          onCurrencyChange={handleCurrencyChange}
          amountTooLow={amountTooLow}
        />

        <button
          type="button"
          onClick={onSupport}
          disabled={isLoading || isInitialLoading || amount === "" || amount < minAmount}
          aria-busy={isLoading}
          className="font-sans flex h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-[13px] bg-[linear-gradient(135deg,var(--chan-amber-bright),var(--chan-amber))] text-[16px] font-extrabold tracking-[-0.02em] text-[var(--chan-amber-ink)] shadow-[0_1px_0_var(--cm-amber-66-black),0_10px_22px_-10px_var(--cm-amber-62)] transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:brightness-[1.04] hover:shadow-[0_2px_0_var(--cm-amber-66-black),0_14px_28px_-10px_var(--cm-amber-68)] active:translate-y-0 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              <span role="status" aria-live="polite">
                {isPl ? "Przetwarzanie..." : "Processing..."}
              </span>
            </span>
          ) : (
            <span>
              {isModal
                ? (isPl ? "Dalej — płatność" : "Continue to payment")
                : (isPl ? "Wyślij napiwek" : "Tip the Guy")}
            </span>
          )}
        </button>

        <label className="mt-3 flex cursor-pointer items-start gap-2">
          <Checkbox
            id="donation-accept-terms"
            checked={isTermsAccepted}
            onCheckedChange={onTermsCheckedChange}
            aria-invalid={showTermsError}
            aria-describedby={showTermsError ? termsErrorId : undefined}
            className="mt-[2px] shrink-0"
          />
          <span className="font-sans text-[11px] leading-[1.4] text-[var(--chan-muted)]">
            {isPl ? (
              <>
                Akceptuję{" "}
                <button type="button" onClick={() => setIsRegulaminOpen(true)} className="underline hover:text-[var(--chan-ink)]">
                  Regulamin
                </button>{" "}
                i{" "}
                <button type="button" onClick={() => setIsPolitykaOpen(true)} className="underline hover:text-[var(--chan-ink)]">
                  Politykę Prywatności
                </button>
              </>
            ) : (
              <>
                I accept the{" "}
                <button type="button" onClick={() => setIsRegulaminOpen(true)} className="underline hover:text-[var(--chan-ink)]">
                  Terms
                </button>{" "}
                and{" "}
                <button type="button" onClick={() => setIsPolitykaOpen(true)} className="underline hover:text-[var(--chan-ink)]">
                  Privacy Policy
                </button>
              </>
            )}
          </span>
        </label>
      </div>

      {isMounted && isCheckoutModalOpen && (clientSecret || isSuccess) && (
        <CheckoutModal
          isSuccess={isSuccess}
          isSyncing={isSyncing}
          language={language}
          amount={amount}
          selectedCurrency={selectedCurrency}
          videoTitle={videoTitle}
          clientSecret={clientSecret}
          paymentId={paymentId}
          paymentUiStatus={paymentUiStatus}
          userEmail={userEmail}
          onRetryStatusCheck={handleRetryStatusCheck}
          stripePromise={checkoutStripePromise}
          onClose={closeSuccessAndSync}
          onBackToSite={closeSuccessAndSync}
          stepLabel={isModal ? (isPl ? "Krok 2 z 2" : "Step 2 of 2") : undefined}
        />
      )}

      <DonationLegalDialog
        open={isRegulaminOpen}
        onOpenChange={setIsRegulaminOpen}
        title={isPl ? "Regulamin serwisu" : "Terms of Service"}
        effectiveDate={isPl ? LEGAL_EFFECTIVE_DATE : LEGAL_EFFECTIVE_DATE_EN}
        href={getLocalizedHref(isPl ? "pl" : "en", "terms")}
        hrefLabel={isPl ? "Otwórz regulamin na osobnej stronie" : "Open the full terms on a separate page"}
      >
        {isPl ? <RegulaminContent /> : <TermsContentEn />}
      </DonationLegalDialog>

      <DonationLegalDialog
        open={isPolitykaOpen}
        onOpenChange={setIsPolitykaOpen}
        title={isPl ? "Polityka Prywatności" : "Privacy Policy"}
        effectiveDate={isPl ? LEGAL_EFFECTIVE_DATE : LEGAL_EFFECTIVE_DATE_EN}
        href={getLocalizedHref(isPl ? "pl" : "en", "privacy")}
        hrefLabel={isPl ? "Otwórz politykę na osobnej stronie" : "Open the full privacy policy on a separate page"}
      >
        {isPl ? <PolitykaContent /> : <PrivacyContentEn />}
      </DonationLegalDialog>
    </div>
  );
}
