"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth, useUser } from "@clerk/nextjs";
import { useAuthModal } from "../auth/AuthModalProvider";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { logger } from "@/lib/logger";
import { MIN_PAYMENT_BY_CURRENCY, SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";
import { detectDefaultCurrency } from "@/lib/payments/detect-currency";
import { useLanguage } from "../LanguageContext";
import { useToast } from "@/app/hooks/useToast";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "../icons";
import { ArrowRight, Lock, ShieldCheck } from "lucide-react";
import CheckoutModal from "../playlist/CheckoutModal";
import DonationLegalDialog from "../channel/DonationLegalDialog";
import { RegulaminContent, PolitykaContent } from "../legal/LegalDocs";
import styles from "./SecretProject2.module.css";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

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
 * redirect_status. Only the presentation differs: a tier-card amount picker
 * instead of a free-typed number field for non-patron viewers.
 */
export default function SecretPledgeBox2({ viewerIsPatron = false }: SecretPledgeBox2Props) {
  const { language } = useLanguage();
  const isPl = language === "pl";
  const toast = useToast();
  const { userId } = useAuth();
  const { user } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress;
  const { open: openAuthModal } = useAuthModal();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<string>(isPl ? "PLN" : "EUR");
  const [amount, setAmount] = useState<number | "">("");
  const [customAmount, setCustomAmount] = useState<number | "">("");
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);
  const [isRegulaminOpen, setIsRegulaminOpen] = useState(false);
  const [isPolitykaOpen, setIsPolitykaOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [paymentUiStatus, setPaymentUiStatus] = useState<string | null>(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [minimums, setMinimums] = useState<Record<SupportedCurrency, number>>(MIN_PAYMENT_BY_CURRENCY);
  const [patronThresholds, setPatronThresholds] = useState<Record<SupportedCurrency, number>>(MIN_PAYMENT_BY_CURRENCY);
  const [patronBoxMinimums, setPatronBoxMinimums] = useState<Record<SupportedCurrency, number>>(MIN_PAYMENT_BY_CURRENCY);

  const currencyKey = selectedCurrency.toUpperCase() as SupportedCurrency;
  const checkoutMinAmount = minimums[currencyKey] ?? minimums.PLN;
  const patronThreshold = patronThresholds[currencyKey] ?? checkoutMinAmount;
  const patronBoxMin = patronBoxMinimums[currencyKey] ?? checkoutMinAmount;
  const minAmount = viewerIsPatron ? patronBoxMin : patronThreshold;
  const termsErrorId = "secret2-pledge-terms-error";

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
    fetch("/api/payment-settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.limits) return;
        const nextMinimums = { ...MIN_PAYMENT_BY_CURRENCY } as Record<SupportedCurrency, number>;
        for (const currency of SUPPORTED_CURRENCIES) {
          const min = Number(data.limits[currency]?.minAmount);
          if (Number.isFinite(min) && min > 0) nextMinimums[currency] = min;
        }
        setMinimums(nextMinimums);

        const nextThresholds = { ...nextMinimums } as Record<SupportedCurrency, number>;
        for (const currency of SUPPORTED_CURRENCIES) {
          const threshold = Number(data.patronThresholds?.[currency]?.threshold);
          if (Number.isFinite(threshold) && threshold > 0) nextThresholds[currency] = threshold;
        }
        setPatronThresholds(nextThresholds);

        const nextBoxMins = { ...nextMinimums } as Record<SupportedCurrency, number>;
        for (const currency of SUPPORTED_CURRENCIES) {
          const boxMin = Number(data.patronBoxMinimums?.[currency]?.min);
          if (Number.isFinite(boxMin) && boxMin > 0) nextBoxMins[currency] = boxMin;
        }
        setPatronBoxMinimums(nextBoxMins);
      })
      .catch((error) => logger.warn("[SecretPledgeBox2] Failed to fetch payment minimums:", error))
      .finally(() => setIsInitialLoading(false));
  }, []);

  // Stripe return-URL handling — identical contract to DonationBox / the v1
  // SecretPledgeBox: trust Stripe's redirect_status for the visible message,
  // reconcile access in the background via GET /api/payments/[id] (which runs
  // fulfillPayment() when needed), and never downgrade an already-shown success.
  useEffect(() => {
    setIsMounted(true);
    let interval: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    const returnedPaymentId = searchParams.get("payment_id");
    if (searchParams.get("success") === "true" && returnedPaymentId) {
      const redirectStatus = searchParams.get("redirect_status");

      setIsCheckoutModalOpen(true);
      setIsSuccess(true);
      setPaymentId(returnedPaymentId);
      queryClient.invalidateQueries();

      if (redirectStatus === "failed") {
        setIsSyncing(false);
        setPaymentUiStatus("FAILED_CANCELED");
        return () => {
          cancelled = true;
        };
      }

      const redirectSucceeded = redirectStatus === "succeeded" || redirectStatus === null;
      if (redirectSucceeded) {
        setPaymentUiStatus("SUCCEEDED");
        setPaymentSucceeded(true);
        setIsSyncing(false);
      } else {
        setPaymentUiStatus("PROCESSING");
        setIsSyncing(true);
      }

      let attempts = 0;
      const maxAttempts = 10;

      const reconcile = async (): Promise<boolean> => {
        attempts++;
        try {
          const res = await fetch(`/api/payments/${encodeURIComponent(returnedPaymentId)}`, { cache: "no-store" });
          if (!res.ok) throw new Error(`Status check failed (${res.status})`);
          const data = await res.json();
          const nextStatus: string | null = data.uiStatus || null;
          const isTerminal =
            nextStatus === "SUCCEEDED" ||
            nextStatus === "FAILED_CANCELED" ||
            nextStatus === "REFUNDED_DISPUTED";

          if (cancelled) return true;

          if (nextStatus === "SUCCEEDED") {
            setPaymentSucceeded(true);
            setIsSyncing(false);
            setPaymentUiStatus("SUCCEEDED");
            return true;
          }

          if (!redirectSucceeded) {
            if (isTerminal || attempts >= maxAttempts) {
              setIsSyncing(false);
              setPaymentUiStatus(nextStatus ?? "TIMED_OUT");
              return true;
            }
            setPaymentUiStatus(nextStatus ?? "PROCESSING");
            return false;
          }

          return isTerminal || attempts >= maxAttempts;
        } catch (e) {
          logger.error("[SecretPledgeBox2] Reconcile error", e);
          if (cancelled) return true;
          if (attempts >= maxAttempts) {
            if (!redirectSucceeded) {
              setIsSyncing(false);
              setPaymentUiStatus((current) => current ?? "TIMED_OUT");
            }
            return true;
          }
          return false;
        }
      };

      reconcile().then((done) => {
        if (done || cancelled) return;
        interval = setInterval(async () => {
          const finished = await reconcile();
          if (finished && interval) clearInterval(interval);
        }, 2000);
      });
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleRetryStatusCheck = useCallback(async () => {
    if (!paymentId) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/payments/${encodeURIComponent(paymentId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Status check failed (${res.status})`);
      const data = await res.json();
      const nextStatus: string | null = data.uiStatus || null;
      setPaymentUiStatus(nextStatus ?? "TIMED_OUT");
      if (nextStatus === "SUCCEEDED") setPaymentSucceeded(true);
    } catch (e) {
      logger.error("[SecretPledgeBox2] Manual status check error", e);
      setPaymentUiStatus("TIMED_OUT");
    } finally {
      setIsSyncing(false);
    }
  }, [paymentId]);

  const closeSuccessAndSync = useCallback(() => {
    setIsCheckoutModalOpen(false);
    if (paymentSucceeded) {
      window.location.replace(window.location.pathname);
    } else {
      router.replace(window.location.pathname);
    }
  }, [paymentSucceeded, router]);

  useEffect(() => {
    document.body.style.overflow = isCheckoutModalOpen ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isCheckoutModalOpen]);

  useEffect(() => {
    setSelectedCurrency(detectDefaultCurrency(language));
  }, [language]);

  // Default to the base tier once tiers/currency are known; patrons may still
  // switch to a custom amount via the toggle below.
  useEffect(() => {
    if (!useCustomAmount) setAmount(tiers[0]?.amount ?? minAmount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiers, minAmount]);

  const onPledge = useCallback(async () => {
    if (!userId) {
      openAuthModal("sign-in");
      return;
    }
    if (!isTermsAccepted) {
      setShowTermsError(true);
      return;
    }
    setShowTermsError(false);

    if (!effectiveAmount || effectiveAmount < minAmount) {
      toast(
        isPl
          ? `Minimalna kwota wsparcia to ${minAmount} ${selectedCurrency}`
          : `Minimum pledge amount is ${minAmount} ${selectedCurrency}`,
        "error",
      );
      return;
    }

    try {
      setIsLoading(true);
      const requestId = checkoutRequestId || crypto.randomUUID();
      setCheckoutRequestId(requestId);

      const response = await fetch("/api/checkout/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountMinor: Number(effectiveAmount) * 100,
          currency: selectedCurrency.toUpperCase(),
          title: "Secret Project",
          requestId,
        }),
        cache: "no-store",
      });

      const data = await response.json();

      if (data?.clientSecret) {
        setClientSecret(data.clientSecret);
        setPaymentId(data.paymentId || null);
        setIsCheckoutModalOpen(true);
      } else if (data?.terminal) {
        setPaymentId(data.paymentId || null);
        setPaymentUiStatus(data.status || "FAILED_CANCELED");
        toast(
          isPl
            ? "Ta próba płatności jest zakończona. Rozpocznij nowe wsparcie."
            : "This payment attempt is finished. Start a new pledge.",
          "error",
        );
        setCheckoutRequestId(null);
      } else if (data?.error) {
        if (response.status === 401 || String(data.error).includes("AUTH_REQUIRED")) {
          toast(isPl ? "Twoja sesja wygasła. Zaloguj się ponownie." : "Your session has expired. Please sign in again.", "error");
          openAuthModal("sign-in");
        } else {
          toast(isPl ? `Błąd: ${data.message || data.error}` : `Error: ${data.message || data.error}`, "error");
        }
      }
    } catch (error: unknown) {
      logger.error("[SecretPledgeBox2] Payment error", error);
      toast(
        isPl
          ? "Błąd połączenia z systemem płatności. Spróbuj odświeżyć stronę."
          : "Payment system connection error. Please refresh the page.",
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId, openAuthModal, isTermsAccepted, effectiveAmount, minAmount, toast, isPl, selectedCurrency, checkoutRequestId]);

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

      <div className="mt-6 flex flex-col gap-4 border-t border-[var(--sp2-line)] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex cursor-pointer items-start gap-2.5">
          <Checkbox
            id="secret2-pledge-terms"
            checked={isTermsAccepted}
            onCheckedChange={(checked) => {
              setIsTermsAccepted(!!checked);
              if (checked) setShowTermsError(false);
            }}
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

      {isMounted &&
        isCheckoutModalOpen &&
        (clientSecret || isSuccess) &&
        createPortal(
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
            stripePromise={stripePromise}
            onClose={closeSuccessAndSync}
            onBackToSite={closeSuccessAndSync}
          />,
          document.body,
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
