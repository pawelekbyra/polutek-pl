"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";
import { detectDefaultCurrency } from "@/lib/payments/detect-currency";
import { useLanguage } from "../LanguageContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Heart } from "../icons";
import CheckoutModal from "../playlist/CheckoutModal";
import DonationAmountField from "./DonationAmountField";
import DonationLegalDialog from "./DonationLegalDialog";
import { RegulaminContent, PolitykaContent } from "../legal/LegalDocs";
import { useCheckoutFlow, checkoutStripePromise } from "@/lib/hooks/useCheckoutFlow";

interface DonationBoxProps {
  videoTitle?: string;
  /**
   * @deprecated Unused since 2026-09-22 — support no longer gates access (see CLAUDE.md), so
   * every signed-in viewer sees the same tip-jar variant regardless of Patron status. Kept in
   * the prop type only so existing callers don't need to change; the component ignores it.
   */
  viewerIsPatron?: boolean;
}

export default function DonationBox({ videoTitle }: DonationBoxProps) {
  const { t, language } = useLanguage();
  const isPl = language === "pl";
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // 2026-09-22: support is a voluntary, non-refundable donation that grants nothing (see
  // CLAUDE.md) — DonationBox always renders the tip-jar variant (free amount, "Bramka
  // Napiwkowa"), never the old pay-to-unlock variant, for every signed-in viewer.
  const viewerIsPatron = true;

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
    patronThresholds,
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
    title: videoTitle || "Napiwek / Patron",
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
  // patronThreshold/the non-patron branch below are unused now that every viewer gets the
  // free-amount box minimum (see viewerIsPatron above) — kept only so this file stays a small
  // diff if the fixed-price gate ever needs to come back.
  const patronThreshold = patronThresholds[currencyKey] ?? checkoutMinAmount;
  const patronBoxMin = patronBoxMinimums[currencyKey] ?? checkoutMinAmount;
  const minAmount = viewerIsPatron ? patronBoxMin : patronThreshold;
  // Currency switcher is available in both languages; only the pre-selected default differs.
  const availableCurrencies = [...SUPPORTED_CURRENCIES];
  const amountTooLow = typeof amount === "number" && amount < minAmount;

  // Pre-select the default currency for the active language: PLN for Polish, geolocation-based
  // (USD/GBP/EUR/CHF) for English. The user can still switch via the currency picker.
  useEffect(() => {
    const nextCurrency = detectDefaultCurrency(language);
    setSelectedCurrency(nextCurrency);
    if (viewerIsPatron) setAmount("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Dead with viewerIsPatron always true (see above) — kept for the same reason as
  // patronThreshold.
  useEffect(() => {
    if (!viewerIsPatron) setAmount(minAmount);
  }, [viewerIsPatron, minAmount]);

  const handleCurrencyChange = (curr: string) => {
    setSelectedCurrency(curr);
    if (viewerIsPatron) setAmount("");
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

  // Existing patrons get a deliberately different surface. They already own everything the
  // non-patron box sells, so this variant stops being a sales/access gate and becomes a plain
  // tip jar — "Bramka Napiwkowa" — with its own name, warmer card treatment and cheerful copy
  // that promises nothing new. Keep it that way: any benefit-style promise here would be a lie.
  const isTipGate = viewerIsPatron;

  // 💰 rather than 🪙 (COIN): the latter is Unicode 13.0 and rendered as a tofu box on the
  // owner's system, while MONEY BAG has been around since Unicode 6.0 and is widely covered.
  const title = isTipGate
    ? (isPl ? "Bramka Napiwkowa 💰" : "The Tip Gate 💰")
    : (isPl ? "Strefa Fenkjuu 👑" : "Thank You Zone 👑");

  const subtitle = isTipGate
    ? ""
    : (isPl
        ? "Wspieraj tworzenie wartościowych treści"
        : "Support valuable independent content");

  const bodyCopy = isTipGate
    ? (isPl
        ? "Bez wsparcia widzów tego projektu by nie było. Dziękuję."
        : "This project wouldn't exist without viewers' support. Thank you.")
    : (isPl
        ? "Jednorazowe wsparcie pomaga rozwijać kanał i odblokowuje dożywotni dostęp do Strefy Fenkjuu."
        : "A one-time tip helps grow the channel and unlocks lifetime Thank You Zone access.");

  const bullets: { text: string; emoji?: string }[] = isTipGate
    ? []
    : [
        { text: isPl ? "Twoje wsparcie pomaga w rozwoju kanału" : "Your support helps the channel grow" },
        { text: isPl ? "Dostęp do specjalnych materiałów" : "Access to special materials" },
        { text: isPl ? "Wcześniejszy dostęp do nowych filmów" : "Early access to new videos" },
        { text: isPl ? "Twoje imię w odcinkach dla wspierających" : "Your name in supporter episodes" },
      ];

  return (
    <div
      id="donations"
      className={`group relative my-[10px] mb-3 scroll-mt-20 overflow-hidden rounded-[20px] border p-[22px_24px_18px] ${
        isTipGate
          ? "border-[var(--cm-amber-38)] bg-[linear-gradient(168deg,var(--chan-amber-soft),var(--cm-card-92-white)_62%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(23,23,23,0.03),0_24px_50px_-26px_var(--cm-amber-58)]"
          : "border-[var(--cm-line-82)] bg-[var(--cm-card-92-white)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(23,23,23,0.03),0_24px_50px_-26px_rgba(23,23,23,0.2)]"
      }`}
    >
      {isTipGate ? (
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
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_18%_0%,var(--cm-amber-17),transparent_58%),radial-gradient(circle_at_82%_0%,var(--cm-blue-7),transparent_55%)]"
        />
      )}
      <div className="relative">
        {isTipGate ? (
          <>
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
          </>
        ) : (
          <>
            <div className="mb-1.5 flex items-center gap-4">
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[linear-gradient(140deg,var(--chan-amber-bright),var(--chan-amber))] text-[var(--chan-amber-ink)] shadow-[0_8px_20px_-6px_var(--cm-amber-58),inset_0_1px_0_rgba(255,255,255,0.45)]">
                <Heart size={24} className="fill-current" />
              </span>
              <h4 className="font-brand m-0 text-[21px] font-extrabold leading-tight tracking-[-0.035em] text-[var(--chan-ink)]">
                <span>{title}</span>
              </h4>
            </div>
            <p className="m-[-22px_0_16px_64px] font-sans text-[13px] font-medium tracking-[-0.015em] text-[var(--chan-body)]">{subtitle}</p>
            <p className="sr-only">{bodyCopy}</p>
          </>
        )}

        {bullets.length > 0 && (
          <ul className="m-[0_0_16px] flex flex-col gap-[9px] font-sans text-[13px]">
            {bullets.map((bullet) => (
              <li
                key={bullet.text}
                className="flex items-start gap-[9px] text-[var(--chan-ink)]"
              >
                {bullet.emoji ? (
                  <span aria-hidden="true" className="shrink-0 text-[15px] leading-[1.25]">{bullet.emoji}</span>
                ) : (
                  <span className="mt-[2px] flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full bg-[var(--chan-amber)] text-[9px] font-black text-[var(--chan-amber-ink)] shadow-[0_2px_5px_-1px_var(--cm-amber-48)]">✓</span>
                )}
                {bullet.text}
              </li>
            ))}
          </ul>
        )}

        {showTermsError && (
          <p id={termsErrorId} role="alert" className="mb-2 text-[11px] font-bold uppercase tracking-widest text-destructive">
            {t.pleaseAcceptTerms}
          </p>
        )}

        <DonationAmountField
          viewerIsPatron={viewerIsPatron}
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
            <span>{isTipGate ? (isPl ? "Wyślij napiwek" : "Tip the Guy") : t.tipTheGuy}</span>
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
          viewerIsPatron={viewerIsPatron}
          clientSecret={clientSecret}
          paymentId={paymentId}
          paymentUiStatus={paymentUiStatus}
          userEmail={userEmail}
          onRetryStatusCheck={handleRetryStatusCheck}
          stripePromise={checkoutStripePromise}
          onClose={closeSuccessAndSync}
          onBackToSite={closeSuccessAndSync}
        />
      )}

      <DonationLegalDialog
        open={isRegulaminOpen}
        onOpenChange={setIsRegulaminOpen}
        title={isPl ? "Regulamin serwisu" : "Terms of Service"}
        intro={isPl ? undefined : "The full legal document is available in Polish."}
        href="/regulamin"
        hrefLabel={isPl ? "Otwórz regulamin na osobnej stronie" : "Open the full terms on a separate page"}
      >
        <RegulaminContent />
      </DonationLegalDialog>

      <DonationLegalDialog
        open={isPolitykaOpen}
        onOpenChange={setIsPolitykaOpen}
        title={isPl ? "Polityka Prywatności" : "Privacy Policy"}
        intro={isPl ? undefined : "The full legal document is available in Polish."}
        href="/polityka-prywatnosci"
        hrefLabel={isPl ? "Otwórz politykę na osobnej stronie" : "Open the full privacy policy on a separate page"}
      >
        <PolitykaContent />
      </DonationLegalDialog>
    </div>
  );
}
