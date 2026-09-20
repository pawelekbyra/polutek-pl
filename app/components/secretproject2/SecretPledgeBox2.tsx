"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";
import { detectDefaultCurrency } from "@/lib/payments/detect-currency";
import { useLanguage } from "../LanguageContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "../icons";
import { ArrowRight, Lock, ShieldCheck } from "lucide-react";
import CheckoutModal from "../playlist/CheckoutModal";
import DonationLegalDialog from "../channel/DonationLegalDialog";
import { RegulaminContent, PolitykaContent } from "../legal/LegalDocs";
import { useCheckoutFlow, checkoutStripePromise } from "@/lib/hooks/useCheckoutFlow";
import styles from "./SecretProject2.module.css";

interface SecretPledgeBox2Props {
  /** True when the signed-in viewer already holds an active Patron grant. */
  viewerIsPatron?: boolean;
}

/** Rounds a suggested amount to a clean-looking number for a tier card. */
function roundNice(value: number): number {
  if (value < 100) return Math.round(value / 5) * 5;
  if (value < 500) return Math.round(value / 10) * 10;
  if (value < 2000) return Math.round(value / 50) * 50;
  return Math.round(value / 100) * 100;
}

/**
 * Campaign pledge box for /secretproject2. Payment mechanics are identical to
 * the homepage DonationBox and the /secretproject SecretPledgeBox — same
 * /api/checkout/create-intent entry, the same CheckoutModal + Stripe
 * Elements, and the same return-URL reconciliation that trusts Stripe's
 * redirect_status (all shared via useCheckoutFlow). Only the presentation
 * differs: a tier-card amount picker instead of a free-typed number field for
 * non-patron viewers.
 */
export default function SecretPledgeBox2({ viewerIsPatron = false }: SecretPledgeBox2Props) {
  const { language, t } = useLanguage();
  const isPl = language === "pl";

  const [selectedCurrency, setSelectedCurrency] = useState<string>(isPl ? "PLN" : "EUR");
  const [amount, setAmount] = useState<number | "">("");
  const [customAmount, setCustomAmount] = useState<number | "">("");
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [isRegulaminOpen, setIsRegulaminOpen] = useState(false);
  const [isPolitykaOpen, setIsPolitykaOpen] = useState(false);

  const termsErrorId = "secret2-pledge-terms-error";
  const withdrawalErrorId = "secret2-pledge-withdrawal-error";

  const {
    userEmail,
    isInitialLoading,
    minimums,
    patronThresholds,
    patronBoxMinimums,
    isTermsAccepted,
    showTermsError,
    onTermsCheckedChange,
    isWithdrawalAcknowledged,
    showWithdrawalError,
    onWithdrawalCheckedChange,
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
    logPrefix: "SecretPledgeBox2",
    title: "Secret Project",
    getMinAmountTooLowMessage: useCallback(
      (minAmount: number, currency: string) =>
        isPl
          ? `Minimalna kwota wsparcia to ${minAmount} ${currency}`
          : `Minimum pledge amount is ${minAmount} ${currency}`,
      [isPl],
    ),
    attemptFinishedMessage: isPl
      ? "Ta próba płatności jest zakończona. Rozpocznij nowe wsparcie."
      : "This payment attempt is finished. Start a new pledge.",
  });

  const currencyKey = selectedCurrency.toUpperCase() as SupportedCurrency;
  const checkoutMinAmount = minimums[currencyKey] ?? minimums.PLN;
  const patronThreshold = patronThresholds[currencyKey] ?? checkoutMinAmount;
  const patronBoxMin = patronBoxMinimums[currencyKey] ?? checkoutMinAmount;
  const minAmount = viewerIsPatron ? patronBoxMin : patronThreshold;

  const tiers = useMemo(() => {
    const base = roundNice(minAmount);
    const mid = roundNice(minAmount * 2.5);
    const top = roundNice(minAmount * 5);
    const labelBase = isPl ? "Wspierający" : "Supporter";
    const labelMid = isPl ? "Insider" : "Insider";
    const labelTop = isPl ? "Legenda" : "Legend";
    return [
      { amount: base, label: labelBase },
      { amount: mid, label: labelMid },
      { amount: top, label: labelTop },
    ];
  }, [minAmount, isPl]);

  const effectiveAmount = useCustomAmount ? customAmount : amount;
  const amountTooLow = typeof effectiveAmount === "number" && effectiveAmount < minAmount;

  useEffect(() => {
    setSelectedCurrency(detectDefaultCurrency(language));
  }, [language]);

  // Default to the base tier once tiers/currency are known; patrons may still
  // switch to a custom amount via the toggle below.
  useEffect(() => {
    if (!useCustomAmount) setAmount(tiers[0]?.amount ?? minAmount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiers, minAmount]);

  const onPledge = useCallback(
    () => submit(effectiveAmount, selectedCurrency, minAmount),
    [submit, effectiveAmount, selectedCurrency, minAmount],
  );

  return (
    <div id="wesprzyj" className={`${styles.card} relative scroll-mt-24 overflow-hidden rounded-[24px] p-6 sm:p-9`}>
      <p className={`${styles.kicker} mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--sp2-muted)]`}>
        {viewerIsPatron
          ? (isPl ? "Dodatkowe wsparcie" : "Extra support")
          : (isPl ? "Wybierz pakiet" : "Choose a package")}
      </p>

      <h3 className="font-brand text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-[var(--sp2-ink)] sm:text-[32px]">
        {viewerIsPatron
          ? (isPl ? "Jesteś już na pokładzie" : "You're already on board")
          : (isPl ? "Wesprzyj Secret Project" : "Back the Secret Project")}
      </h3>

      <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-[var(--sp2-body)]">
        {viewerIsPatron
          ? (isPl
              ? "Masz już dożywotni dostęp do tajnego materiału i Strefy Fenkjuu. Ta wpłata jest dodatkowym gestem wsparcia — niczego nowego nie odblokowuje."
              : "You already hold lifetime access to the secret material and the Thank You Zone. This pledge is an extra show of support — it doesn't unlock anything new.")
          : (isPl
              ? "Jednorazowa wpłata. Każdy pakiet odblokowuje ten sam tajny materiał i całą Strefę Fenkjuu, dożywotnio."
              : "A one-time pledge. Every package unlocks the same secret material and the whole Thank You Zone, for life.")}
      </p>

      <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiers.map((tier, index) => {
          const isSelected = !useCustomAmount && amount === tier.amount;
          return (
            <button
              key={tier.label}
              type="button"
              onClick={() => {
                setUseCustomAmount(false);
                setAmount(tier.amount);
              }}
              aria-pressed={isSelected}
              className={`${styles.tierCard} ${isSelected ? styles.tierCardSelected : ""} rounded-[16px] p-5`}
            >
              <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--sp2-muted)]">
                {tier.label}
              </span>
              <span className="mt-2 block font-brand text-[26px] font-extrabold tabular-nums text-[var(--sp2-ink)]">
                {tier.amount}
                <span className="ml-1 text-[13px] font-bold text-[var(--sp2-muted)]">{currencyKey}</span>
              </span>
              {index === 0 && (
                <span className="mt-2 block text-[11.5px] font-semibold text-[var(--sp2-muted)]">
                  {isPl ? "Odblokowuje nagrodę" : "Unlocks the reward"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {viewerIsPatron && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setUseCustomAmount((current) => !current)}
            className="text-[12.5px] font-bold text-[var(--sp2-accent)] underline underline-offset-2"
          >
            {useCustomAmount
              ? (isPl ? "Wybierz pakiet zamiast tego" : "Choose a package instead")
              : (isPl ? "Wpisz własną kwotę" : "Enter a custom amount")}
          </button>
          {useCustomAmount && (
            <div className="mt-3 flex max-w-xs items-stretch overflow-hidden rounded-[14px] border border-[var(--sp2-line-strong)] bg-[var(--sp2-bg)] focus-within:border-[var(--sp2-accent)]">
              <input
                type="number"
                inputMode="numeric"
                min={minAmount}
                value={customAmount}
                aria-invalid={amountTooLow}
                onChange={(e) => {
                  const raw = e.target.value;
                  setCustomAmount(raw === "" ? "" : Math.max(0, Math.floor(Number(raw))));
                }}
                className="w-full bg-transparent px-4 py-3 font-mono text-[18px] font-black tabular-nums text-[var(--sp2-ink)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="flex items-center px-3 font-mono text-[13px] font-bold text-[var(--sp2-muted)]">
                {currencyKey}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center gap-2">
        <span className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-[var(--sp2-muted)]">
          {isPl ? "Waluta" : "Currency"}
        </span>
        <div className="flex gap-1.5">
          {SUPPORTED_CURRENCIES.map((currency) => (
            <button
              key={currency}
              type="button"
              onClick={() => setSelectedCurrency(currency)}
              className={`rounded-[8px] px-2.5 py-1 font-mono text-[12px] font-bold transition-colors ${
                currencyKey === currency
                  ? "bg-[var(--sp2-ink)] text-white"
                  : "bg-[var(--sp2-bg)] text-[var(--sp2-muted)] hover:text-[var(--sp2-ink)]"
              }`}
            >
              {currency}
            </button>
          ))}
        </div>
      </div>

      {showTermsError && (
        <p id={termsErrorId} role="alert" className="mt-5 text-[11px] font-bold uppercase tracking-widest text-red-600">
          {isPl ? "Zaakceptuj regulamin, aby kontynuować" : "Please accept the terms to continue"}
        </p>
      )}

      {showWithdrawalError && (
        <p id={withdrawalErrorId} role="alert" className="mt-2 text-[11px] font-bold uppercase tracking-widest text-red-600">
          {t.pleaseAcceptWithdrawal}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4 border-t border-[var(--sp2-line)] pt-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-start gap-2.5">
            <Checkbox
              id="secret2-pledge-terms"
              checked={isTermsAccepted}
              onCheckedChange={onTermsCheckedChange}
              aria-invalid={showTermsError}
              aria-describedby={showTermsError ? termsErrorId : undefined}
              className="mt-[2px] shrink-0"
            />
            <span className="text-[12px] leading-[1.5] text-[var(--sp2-muted)]">
              {isPl ? (
                <>
                  Akceptuję{" "}
                  <button type="button" onClick={() => setIsRegulaminOpen(true)} className="underline hover:text-[var(--sp2-ink)]">
                    Regulamin
                  </button>{" "}
                  i{" "}
                  <button type="button" onClick={() => setIsPolitykaOpen(true)} className="underline hover:text-[var(--sp2-ink)]">
                    Politykę Prywatności
                  </button>
                </>
              ) : (
                <>
                  I accept the{" "}
                  <button type="button" onClick={() => setIsRegulaminOpen(true)} className="underline hover:text-[var(--sp2-ink)]">
                    Terms
                  </button>{" "}
                  and{" "}
                  <button type="button" onClick={() => setIsPolitykaOpen(true)} className="underline hover:text-[var(--sp2-ink)]">
                    Privacy Policy
                  </button>
                </>
              )}
            </span>
          </label>

          {/* Separate, explicit consent — distinct from the Terms/Privacy checkbox above — required
              by art. 38(1)(13) of the Polish Consumer Rights Act before a purchase that grants
              immediate digital-content access can waive the 14-day withdrawal right. */}
          <label className="flex cursor-pointer items-start gap-2.5">
            <Checkbox
              id="secret2-pledge-withdrawal"
              checked={isWithdrawalAcknowledged}
              onCheckedChange={onWithdrawalCheckedChange}
              aria-invalid={showWithdrawalError}
              aria-describedby={showWithdrawalError ? withdrawalErrorId : undefined}
              className="mt-[2px] shrink-0"
            />
            <span className="text-[12px] leading-[1.5] text-[var(--sp2-muted)]">{t.acceptWithdrawal}</span>
          </label>
        </div>

        <button
          type="button"
          onClick={onPledge}
          disabled={isLoading || isInitialLoading || effectiveAmount === "" || amountTooLow}
          aria-busy={isLoading}
          className={`${styles.ctaAccent} flex h-[54px] shrink-0 items-center justify-center gap-2 rounded-[14px] px-7 font-brand text-[15px] font-extrabold tracking-[-0.01em] disabled:cursor-wait disabled:opacity-60 sm:min-w-[200px]`}
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              <span role="status" aria-live="polite">
                {isPl ? "Przetwarzanie..." : "Processing..."}
              </span>
            </span>
          ) : (
            <>
              <span>{isPl ? "Wspieram" : "Back it"}</span>
              <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      <p className="mt-5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp2-muted)]">
        <ShieldCheck size={14} className="text-[var(--sp2-accent)]" aria-hidden="true" />
        {isPl ? "Bezpieczna płatność Stripe" : "Secure Stripe payment"}
        <Lock size={12} className="ml-1" aria-hidden="true" />
      </p>

      {isMounted && isCheckoutModalOpen && (clientSecret || isSuccess) && (
        <CheckoutModal
          isSuccess={isSuccess}
          isSyncing={isSyncing}
          language={language}
          amount={effectiveAmount}
          selectedCurrency={selectedCurrency}
          videoTitle="Secret Project"
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
