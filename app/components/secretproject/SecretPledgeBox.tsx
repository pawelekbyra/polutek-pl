"use client";

import React, { useCallback, useEffect, useState } from "react";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";
import { detectDefaultCurrency } from "@/lib/payments/detect-currency";
import { useLanguage } from "../LanguageContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "../icons";
import { Lock, ShieldCheck, Sparkles } from "lucide-react";
import CheckoutModal from "../playlist/CheckoutModal";
import DonationLegalDialog from "../channel/DonationLegalDialog";
import { RegulaminContent, PolitykaContent } from "../legal/LegalDocs";
import { useCheckoutFlow, checkoutStripePromise } from "@/lib/hooks/useCheckoutFlow";
import styles from "./SecretProject.module.css";

interface SecretPledgeBoxProps {
  /** True when the signed-in viewer already holds an active Patron grant. */
  viewerIsPatron?: boolean;
}

/**
 * Campaign pledge box for /secretproject. Payment mechanics are identical to
 * the homepage DonationBox — same /api/checkout/create-intent entry, the same
 * CheckoutModal + Stripe Elements, and the same return-URL reconciliation that
 * trusts Stripe's redirect_status and quietly re-runs the status endpoint until
 * the PatronGrant lands (all shared via useCheckoutFlow). Only the
 * framing/styling differ: here a successful pledge is presented as backing the
 * campaign and unlocking the secret reward.
 */
export default function SecretPledgeBox({ viewerIsPatron = false }: SecretPledgeBoxProps) {
  const { language } = useLanguage();
  const isPl = language === "pl";

  const [selectedCurrency, setSelectedCurrency] = useState<string>(isPl ? "PLN" : "EUR");
  const [amount, setAmount] = useState<number | "">("");
  const [isRegulaminOpen, setIsRegulaminOpen] = useState(false);
  const [isPolitykaOpen, setIsPolitykaOpen] = useState(false);

  const termsErrorId = "secret-pledge-terms-error";

  const {
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
    logPrefix: "SecretPledgeBox",
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
  // Non-patrons pledge the fixed gate price (patron threshold) so a successful
  // pledge always unlocks the reward exactly as the campaign copy promises.
  const patronThreshold = patronThresholds[currencyKey] ?? checkoutMinAmount;
  const patronBoxMin = patronBoxMinimums[currencyKey] ?? checkoutMinAmount;
  const minAmount = viewerIsPatron ? patronBoxMin : patronThreshold;
  const amountTooLow = typeof amount === "number" && amount < minAmount;

  useEffect(() => {
    setSelectedCurrency(detectDefaultCurrency(language));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Non-patrons back the fixed reward price; patrons type a free amount.
  useEffect(() => {
    if (!viewerIsPatron) setAmount(minAmount);
  }, [viewerIsPatron, minAmount]);

  const onPledge = useCallback(
    () => submit(amount, selectedCurrency, minAmount),
    [submit, amount, selectedCurrency, minAmount],
  );

  return (
    <div
      id="wesprzyj"
      className={`${styles.panel} relative scroll-mt-24 overflow-hidden rounded-[28px] p-6 sm:p-8`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_20%_0%,rgba(246,185,59,0.16),transparent_58%),radial-gradient(circle_at_80%_0%,rgba(139,123,255,0.12),transparent_55%)]"
      />

      <div className="relative">
        <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--sp-gold)]">
          <Sparkles size={14} aria-hidden="true" />
          {viewerIsPatron
            ? (isPl ? "Dodatkowe wsparcie" : "Extra support")
            : (isPl ? "Pakiet wspierającego" : "Backer package")}
        </p>

        <h3 className="font-brand text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-[var(--sp-ink)] sm:text-[30px]">
          {viewerIsPatron
            ? (isPl ? "Jesteś już na pokładzie" : "You're already on board")
            : (isPl ? "Wesprzyj Secret Project" : "Back the Secret Project")}
        </h3>

        <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-[var(--sp-body)]">
          {viewerIsPatron
            ? (isPl
                ? "Masz już dożywotni dostęp do tajnego materiału i Strefy Fenkjuu. Ta wpłata jest dodatkowym gestem wsparcia dla projektu — niczego nowego nie odblokowuje."
                : "You already hold lifetime access to the secret material and the Thank You Zone. This pledge is an extra show of support — it doesn't unlock anything new.")
            : (isPl
                ? "Jednorazowa wpłata. Bez abonamentu, bez odnowień. Po opłaceniu natychmiast i dożywotnio odblokowujesz tajny film oraz całą Strefę Fenkjuu."
                : "A one-time pledge. No subscription, no renewals. Once paid, you instantly unlock the secret video and the whole Thank You Zone — for life.")}
        </p>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="secret-pledge-amount"
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--sp-muted)]"
            >
              {isPl ? "Kwota wsparcia" : "Pledge amount"}
            </label>
            <div className="flex items-stretch overflow-hidden rounded-[16px] border border-[var(--sp-line-strong)] bg-black/30 focus-within:border-[var(--sp-gold)]">
              <input
                id="secret-pledge-amount"
                type="number"
                inputMode="numeric"
                min={minAmount}
                value={amount}
                readOnly={!viewerIsPatron}
                aria-invalid={amountTooLow}
                onChange={(e) => {
                  const raw = e.target.value;
                  setAmount(raw === "" ? "" : Math.max(0, Math.floor(Number(raw))));
                }}
                className="w-full bg-transparent px-5 py-3.5 font-mono text-[24px] font-black tabular-nums text-[var(--sp-ink)] outline-none [appearance:textfield] read-only:cursor-default [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <label className="sr-only" htmlFor="secret-pledge-currency">
                {isPl ? "Waluta" : "Currency"}
              </label>
              <select
                id="secret-pledge-currency"
                value={currencyKey}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="cursor-pointer border-l border-[var(--sp-line)] bg-transparent px-4 font-mono text-[14px] font-bold text-[var(--sp-body)] outline-none [&>option]:bg-[#0b0d16] [&>option]:text-white"
              >
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1.5 text-[12px] text-[var(--sp-muted)]">
              {viewerIsPatron
                ? (isPl ? `Dowolna kwota od ${minAmount} ${currencyKey}` : `Any amount from ${minAmount} ${currencyKey}`)
                : (isPl
                    ? "Stała cena pakietu — gwarantuje odblokowanie nagrody."
                    : "Fixed package price — guarantees the reward unlocks.")}
            </p>
          </div>

          <button
            type="button"
            onClick={onPledge}
            disabled={isLoading || isInitialLoading || amount === "" || amountTooLow}
            aria-busy={isLoading}
            className={`${styles.ctaGold} flex h-[58px] shrink-0 items-center justify-center gap-2.5 rounded-[16px] px-8 font-brand text-[16px] font-extrabold tracking-[-0.01em] disabled:cursor-wait disabled:opacity-60 sm:min-w-[220px]`}
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
                <Lock size={18} strokeWidth={2.4} aria-hidden="true" />
                <span>{isPl ? "Wspieram projekt" : "Back this project"}</span>
              </>
            )}
          </button>
        </div>

        {showTermsError && (
          <p id={termsErrorId} role="alert" className="mt-4 text-[11px] font-bold uppercase tracking-widest text-red-400">
            {isPl ? "Zaakceptuj regulamin, aby kontynuować" : "Please accept the terms to continue"}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3 border-t border-[var(--sp-line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-start gap-2.5">
            <Checkbox
              id="secret-pledge-terms"
              checked={isTermsAccepted}
              onCheckedChange={onTermsCheckedChange}
              aria-invalid={showTermsError}
              aria-describedby={showTermsError ? termsErrorId : undefined}
              className="mt-[2px] shrink-0 border-[var(--sp-line-strong)] data-[state=unchecked]:bg-black/30"
            />
            <span className="text-[12px] leading-[1.5] text-[var(--sp-muted)]">
              {isPl ? (
                <>
                  Akceptuję{" "}
                  <button type="button" onClick={() => setIsRegulaminOpen(true)} className="underline hover:text-[var(--sp-ink)]">
                    Regulamin
                  </button>{" "}
                  i{" "}
                  <button type="button" onClick={() => setIsPolitykaOpen(true)} className="underline hover:text-[var(--sp-ink)]">
                    Politykę Prywatności
                  </button>
                </>
              ) : (
                <>
                  I accept the{" "}
                  <button type="button" onClick={() => setIsRegulaminOpen(true)} className="underline hover:text-[var(--sp-ink)]">
                    Terms
                  </button>{" "}
                  and{" "}
                  <button type="button" onClick={() => setIsPolitykaOpen(true)} className="underline hover:text-[var(--sp-ink)]">
                    Privacy Policy
                  </button>
                </>
              )}
            </span>
          </label>

          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-muted)]">
            <ShieldCheck size={14} className="text-[var(--sp-gold)]" aria-hidden="true" />
            {isPl ? "Bezpieczna płatność Stripe" : "Secure Stripe payment"}
          </p>
        </div>
      </div>

      {isMounted && isCheckoutModalOpen && (clientSecret || isSuccess) && (
        <CheckoutModal
          isSuccess={isSuccess}
          isSyncing={isSyncing}
          language={language}
          amount={amount}
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
