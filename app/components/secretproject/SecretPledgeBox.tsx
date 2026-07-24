"use client";

import React, { useCallback, useEffect, useState } from "react";
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
import { Lock, ShieldCheck, Sparkles } from "lucide-react";
import CheckoutModal from "../playlist/CheckoutModal";
import DonationLegalDialog from "../channel/DonationLegalDialog";
import { RegulaminContent, PolitykaContent } from "../legal/LegalDocs";
import styles from "./SecretProject.module.css";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

interface SecretPledgeBoxProps {
  /** True when the signed-in viewer already holds an active Patron grant. */
  viewerIsPatron?: boolean;
}

/**
 * Campaign pledge box for /secretproject. Payment mechanics are identical to
 * the homepage DonationBox — same /api/checkout/create-intent entry, the same
 * CheckoutModal + Stripe Elements, and the same return-URL reconciliation that
 * trusts Stripe's redirect_status and quietly re-runs the status endpoint until
 * the PatronGrant lands. Only the framing/styling differ: here a successful
 * pledge is presented as backing the campaign and unlocking the secret reward.
 */
export default function SecretPledgeBox({ viewerIsPatron = false }: SecretPledgeBoxProps) {
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
  // Mirrors DonationBox: once success is shown for this return, closing does a
  // full reload so every server-rendered lock/badge reflects the fresh grant.
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [minimums, setMinimums] = useState<Record<SupportedCurrency, number>>(MIN_PAYMENT_BY_CURRENCY);
  const [patronThresholds, setPatronThresholds] = useState<Record<SupportedCurrency, number>>(MIN_PAYMENT_BY_CURRENCY);
  const [patronBoxMinimums, setPatronBoxMinimums] = useState<Record<SupportedCurrency, number>>(MIN_PAYMENT_BY_CURRENCY);

  const currencyKey = selectedCurrency.toUpperCase() as SupportedCurrency;
  const checkoutMinAmount = minimums[currencyKey] ?? minimums.PLN;
  // Non-patrons pledge the fixed gate price (patron threshold) so a successful
  // pledge always unlocks the reward exactly as the campaign copy promises.
  const patronThreshold = patronThresholds[currencyKey] ?? checkoutMinAmount;
  const patronBoxMin = patronBoxMinimums[currencyKey] ?? checkoutMinAmount;
  const minAmount = viewerIsPatron ? patronBoxMin : patronThreshold;
  const amountTooLow = typeof amount === "number" && amount < minAmount;
  const termsErrorId = "secret-pledge-terms-error";

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
      .catch((error) => logger.warn("[SecretPledgeBox] Failed to fetch payment minimums:", error))
      .finally(() => setIsInitialLoading(false));
  }, []);

  // Stripe return-URL handling — same contract as DonationBox: trust Stripe's
  // redirect_status for the visible message, reconcile access in the background
  // via GET /api/payments/[id] (which runs fulfillPayment() when needed), and
  // never downgrade an already-shown success.
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
          logger.error("[SecretPledgeBox] Reconcile error", e);
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
      logger.error("[SecretPledgeBox] Manual status check error", e);
      setPaymentUiStatus("TIMED_OUT");
    } finally {
      setIsSyncing(false);
    }
  }, [paymentId]);

  // Full reload after a confirmed success so the locked reward video, progress
  // bar and server-rendered patron state all come back fresh; soft replace
  // otherwise (just strips the Stripe return params).
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Non-patrons back the fixed reward price; patrons type a free amount.
  useEffect(() => {
    if (!viewerIsPatron) setAmount(minAmount);
  }, [viewerIsPatron, minAmount]);

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

    if (!amount || amount < minAmount) {
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
          amountMinor: Number(amount) * 100,
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
      logger.error("[SecretPledgeBox] Payment error", error);
      toast(
        isPl
          ? "Błąd połączenia z systemem płatności. Spróbuj odświeżyć stronę."
          : "Payment system connection error. Please refresh the page.",
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId, openAuthModal, isTermsAccepted, amount, minAmount, toast, isPl, selectedCurrency, checkoutRequestId]);

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
              onCheckedChange={(checked) => {
                setIsTermsAccepted(!!checked);
                if (checked) setShowTermsError(false);
              }}
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

      {isMounted &&
        isCheckoutModalOpen &&
        (clientSecret || isSuccess) &&
        createPortal(
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
