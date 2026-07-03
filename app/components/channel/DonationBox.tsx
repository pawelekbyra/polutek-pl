"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { logger } from "@/lib/logger";
import { MIN_PAYMENT_BY_CURRENCY, SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";
import { useLanguage } from "../LanguageContext";
import { useToast } from "@/app/hooks/useToast";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Heart } from "../icons";
import { Frame, INK, BLUE } from "../najs/primitives";
import CheckoutModal from "../playlist/CheckoutModal";
import DonationAmountField from "./DonationAmountField";
import DonationLegalDialog from "./DonationLegalDialog";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

interface DonationBoxProps {
  videoTitle?: string;
  /** True when the signed-in viewer already holds an active Patron grant. */
  viewerIsPatron?: boolean;
}

function getSuggestedAmount(currency: string) {
  return currency === "PLN" ? 25 : 10;
}

export default function DonationBox({ videoTitle, viewerIsPatron = false }: DonationBoxProps) {
  const { t, language } = useLanguage();
  const isPl = language === "pl";
  const toast = useToast();
  const { userId } = useAuth();
  const { openSignIn } = useClerk();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState(t.currency);
  const [amount, setAmount] = useState<number | "">(getSuggestedAmount(t.currency));
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
  const [minimums, setMinimums] = useState<Record<SupportedCurrency, number>>(MIN_PAYMENT_BY_CURRENCY);
  const [patronThresholds, setPatronThresholds] = useState<Record<SupportedCurrency, number>>(MIN_PAYMENT_BY_CURRENCY);

  const checkoutMinAmount = minimums[selectedCurrency.toUpperCase() as SupportedCurrency] ?? minimums.PLN;
  const patronThreshold = patronThresholds[selectedCurrency.toUpperCase() as SupportedCurrency] ?? checkoutMinAmount;
  // Non-patrons must clear the patron threshold so a successful tip always grants access, as promised in the copy.
  // Existing patrons already have access, so they may support with any amount down to the checkout floor.
  const minAmount = viewerIsPatron ? checkoutMinAmount : Math.max(checkoutMinAmount, patronThreshold);
  const availableCurrencies = [...SUPPORTED_CURRENCIES].filter(
    (currency) => !(language === "en" && currency === "PLN"),
  );
  const amountTooLow = typeof amount === "number" && amount < minAmount;
  const termsErrorId = "donation-terms-error";

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
      })
      .catch((error) => logger.warn("[DonationBox] Failed to fetch payment minimums:", error))
      .finally(() => setIsInitialLoading(false));
  }, []);

  useEffect(() => {
    setIsMounted(true);
    let interval: ReturnType<typeof setInterval> | undefined;

    const returnedPaymentId = searchParams.get("payment_id");
    if (searchParams.get("success") === "true" && returnedPaymentId) {
      setIsCheckoutModalOpen(true);
      setIsSuccess(true);
      setIsSyncing(true);
      setPaymentId(returnedPaymentId);
      queryClient.invalidateQueries();

      let attempts = 0;
      const maxAttempts = 10;
      interval = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch(`/api/payments/${encodeURIComponent(returnedPaymentId)}`, { cache: "no-store" });
          const data = await res.json();
          setPaymentUiStatus(data.uiStatus || null);
          if (
            data.uiStatus === "SUCCEEDED" ||
            data.uiStatus === "FAILED_CANCELED" ||
            data.uiStatus === "REFUNDED_DISPUTED" ||
            attempts >= maxAttempts
          ) {
            clearInterval(interval);
            setIsSyncing(false);
            if (data.uiStatus === "SUCCEEDED") router.refresh();
          }
        } catch (e) {
          logger.error("[DonationBox] Sync error", e);
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    document.body.style.overflow = isCheckoutModalOpen ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isCheckoutModalOpen]);

  useEffect(() => {
    setSelectedCurrency(t.currency);
    if (!viewerIsPatron) return;
    setAmount(getSuggestedAmount(t.currency));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.currency]);

  // Non-patrons pay the fixed, admin-set patron threshold — the amount is not user-editable,
  // so a successful tip always grants access as the copy promises.
  useEffect(() => {
    if (!viewerIsPatron) setAmount(minAmount);
  }, [viewerIsPatron, minAmount]);

  const handleCurrencyChange = (curr: string) => {
    setSelectedCurrency(curr);
    if (viewerIsPatron) setAmount(getSuggestedAmount(curr));
  };

  const onSupport = useCallback(async () => {
    if (!userId) {
      openSignIn();
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
          ? `Minimalna kwota napiwku to ${minAmount} ${selectedCurrency}`
          : `Minimum tip amount is ${minAmount} ${selectedCurrency}`,
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
          title: videoTitle || "Napiwek / Patron",
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
            ? "Ta próba płatności jest zakończona. Rozpocznij nową wpłatę."
            : "This payment attempt is finished. Start a new support attempt.",
          "error",
        );
        setCheckoutRequestId(null);
      } else if (data?.error) {
        if (response.status === 401 || String(data.error).includes("AUTH_REQUIRED")) {
          toast(isPl ? "Twoja sesja wygasła. Zaloguj się ponownie." : "Your session has expired. Please sign in again.", "error");
          openSignIn();
        } else {
          toast(isPl ? `Błąd: ${data.message || data.error}` : `Error: ${data.message || data.error}`, "error");
        }
      }
    } catch (error: unknown) {
      logger.error("[DonationBox] Payment error", error);
      toast(
        isPl
          ? "Błąd połączenia z systemem płatności. Spróbuj odświeżyć stronę."
          : "Payment system connection error. Please refresh the page.",
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId, openSignIn, isTermsAccepted, amount, minAmount, toast, isPl, selectedCurrency, checkoutRequestId, videoTitle]);

  const subtitle = viewerIsPatron
    ? (isPl ? "Masz już dostęp do Strefy Fenkju" : "You already have Thank You Zone access")
    : (isPl ? "Dostęp do Strefy Fenkju" : "Access to the Thank You Zone");

  const bodyCopy = viewerIsPatron
    ? (isPl
        ? "Twój dostęp do Strefy Fenkju jest już zapewniony i ta wpłata niczego nowego nie odblokowuje. To czysty gest wsparcia — dowolna kwota, dla samego wspierania."
        : "Your access to the Thank You Zone is already secured, and this tip doesn't unlock anything new. It's a pure show of support — any amount, just for the sake of it.")
    : (isPl
        ? "Jednorazowa wpłata finansuje rozwój POLUTEK.PL — projektu, który dopiero raczkuje — i odblokowuje dożywotni dostęp do Strefy Fenkju: wszystkich obecnych i przyszłych materiałów dodatkowych. Bez subskrypcji i ukrytych kosztów."
        : "A one-time tip funds the growth of POLUTEK.PL — a project still in its early days — and unlocks lifetime access to the Thank You Zone: all current and future bonus materials. No subscription, no hidden costs.");

  const bullets: { text: string; soft?: boolean }[] = viewerIsPatron
    ? [
        { text: isPl ? "Masz już pełny dostęp do Strefy Fenkju" : "You already have full Thank You Zone access" },
        { text: isPl ? "Dowolna kwota — bez nowych korzyści" : "Any amount — no new benefits" },
        { text: isPl ? "Bezpośrednio wspiera dalszy rozwój kanału" : "Directly supports the channel's continued growth", soft: true },
      ]
    : [
        { text: isPl ? "Dożywotni dostęp do Strefy Fenkju" : "Lifetime access to the Thank You Zone" },
        { text: isPl ? "Jedna wpłata, bez subskrypcji" : "One payment, no subscription" },
        {
          text: isPl
            ? "Na razie niewiele materiałów, ale dzięki Tobie będzie ich coraz więcej"
            : "Not much there yet, but thanks to you it'll keep growing",
          soft: true,
        },
      ];

  return (
    <div id="donations" className="relative my-[10px] scroll-mt-20 p-[18px] mb-3">
      <Frame radius={16} seed={8} stroke={INK} strokeWidth={1.3} fill="#ffffff" />
      <div className="relative z-10">
        <div className="mb-1 flex items-center gap-2">
          <Heart size={17} className="shrink-0 text-primary" />
          <h4 className="m-0 text-[16px] font-bold text-[#0f0f0f]" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
            <span className="px-[3px]" style={{ background: "linear-gradient(180deg, transparent 55%, #FBE08A 55%, #FBE08A 94%, transparent 94%)" }}>
              {isPl ? "Wspieraj POLUTEK.PL" : "Support POLUTEK.PL"}
            </span>
          </h4>
        </div>
        <p className="m-[0_0_10px] text-[11.5px] font-semibold uppercase tracking-wide text-[#7a7a7a]">{subtitle}</p>
        <p className="m-[0_0_12px] text-[12.5px] leading-[1.55] text-[#4a4a4a]">{bodyCopy}</p>

        <ul className="m-[0_0_14px] flex flex-col gap-[7px] border-t border-dashed border-[#171717]/15 pt-[10px] text-[12.5px]">
          {bullets.map((bullet) => (
            <li
              key={bullet.text}
              className={bullet.soft ? "flex items-start gap-[7px] italic text-[#7a7a7a]" : "flex items-start gap-[7px] text-[#171717]"}
            >
              {bullet.soft ? (
                <span className="mt-[3px] shrink-0 text-[9px] text-primary">◆</span>
              ) : (
                <span className="mt-[2px] flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full bg-[#171717] text-[9px] font-bold text-[#f8f3e7]">✓</span>
              )}
              {bullet.text}
            </li>
          ))}
        </ul>

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
          className="relative flex h-[44px] w-full cursor-pointer items-center justify-center gap-2 text-[14px] font-bold text-white transition-all active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}
        >
          <Frame radius={11} seed={5} stroke={INK} strokeWidth={1.4} fill={BLUE} showShadow />
          {isLoading ? (
            <span className="relative z-10 inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              <span role="status" aria-live="polite">
                {isPl ? "Przetwarzanie..." : "Processing..."}
              </span>
            </span>
          ) : (
            <span className="relative z-10">{t.tipTheGuy}</span>
          )}
        </button>

        <label className="mt-3 flex cursor-pointer items-start gap-2 px-1 text-left">
          <Checkbox
            id="donation-accept-terms"
            checked={isTermsAccepted}
            onCheckedChange={(checked) => {
              setIsTermsAccepted(!!checked);
              if (checked) setShowTermsError(false);
            }}
            aria-invalid={showTermsError}
            aria-describedby={showTermsError ? termsErrorId : undefined}
            className="mt-[2px] shrink-0"
          />
          <span className="text-[11px] leading-[1.4] text-[#7a7a7a]">
            {isPl ? (
              <>
                Akceptuję{" "}
                <button type="button" onClick={() => setIsRegulaminOpen(true)} className="underline hover:text-[#0f0f0f]">
                  Regulamin
                </button>{" "}
                i{" "}
                <button type="button" onClick={() => setIsPolitykaOpen(true)} className="underline hover:text-[#0f0f0f]">
                  Politykę Prywatności
                </button>
              </>
            ) : (
              <>
                I accept the{" "}
                <button type="button" onClick={() => setIsRegulaminOpen(true)} className="underline hover:text-[#0f0f0f]">
                  Terms
                </button>{" "}
                and{" "}
                <button type="button" onClick={() => setIsPolitykaOpen(true)} className="underline hover:text-[#0f0f0f]">
                  Privacy Policy
                </button>
              </>
            )}
          </span>
        </label>
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
            videoTitle={videoTitle}
            viewerIsPatron={viewerIsPatron}
            clientSecret={clientSecret}
            paymentId={paymentId}
            paymentUiStatus={paymentUiStatus}
            stripePromise={stripePromise}
            onClose={() => {
              setIsCheckoutModalOpen(false);
              if (isSuccess) router.replace(window.location.pathname);
            }}
            onBackToSite={() => {
              setIsCheckoutModalOpen(false);
              router.replace(window.location.pathname);
            }}
          />,
          document.body,
        )}

      <DonationLegalDialog
        open={isRegulaminOpen}
        onOpenChange={setIsRegulaminOpen}
        title={isPl ? "Regulamin serwisu" : "Terms of Service"}
        body={
          isPl
            ? "Serwis Polutek.pl jest prywatnym, autorskim kanałem wideo. Wsparcie ma charakter jednorazowego, dobrowolnego napiwku i nie jest subskrypcją."
            : "Polutek.pl is a private, independent video channel. Support is a one-time, voluntary tip and not a subscription."
        }
      />

      <DonationLegalDialog
        open={isPolitykaOpen}
        onOpenChange={setIsPolitykaOpen}
        title={isPl ? "Polityka Prywatności" : "Privacy Policy"}
        body={
          isPl
            ? "Dla bezpieczeństwa i wygody użytkowników serwis korzysta z zewnętrznego systemu uwierzytelniania Clerk oraz Stripe do obsługi płatności."
            : "For security and convenience, the service uses the Clerk authentication system and Stripe for payment processing."
        }
      />
    </div>
  );
}
