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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ChevronDown, Heart } from "../icons";
import { Frame, INK, BLUE } from "../najs/primitives";
import CheckoutModal from "../playlist/CheckoutModal";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

interface DonationBoxProps {
  videoTitle?: string;
}

function getSuggestedAmount(currency: string) {
  return currency === "PLN" ? 25 : 10;
}

export default function DonationBox({ videoTitle }: DonationBoxProps) {
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

  const minAmount = minimums[selectedCurrency.toUpperCase() as SupportedCurrency] ?? minimums.PLN;
  const availableCurrencies = [...SUPPORTED_CURRENCIES].filter(
    (currency) => !(language === "en" && currency === "PLN"),
  );
  const amountTooLow = typeof amount === "number" && amount < minAmount;
  const amountInputId = "donation-amount";
  const amountErrorId = "donation-amount-error";
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
    setAmount(getSuggestedAmount(t.currency));
  }, [t.currency]);

  const handleCurrencyChange = (curr: string) => {
    setSelectedCurrency(curr);
    setAmount(getSuggestedAmount(curr));
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

  return (
    <div id="donations" className="relative my-[10px] scroll-mt-20 p-[18px] mb-3">
      <Frame radius={16} seed={8} stroke={INK} strokeWidth={1.3} fill="#ffffff" />
      <div className="relative z-10">
        <div className="mb-2 flex items-center gap-2">
          <Heart size={17} className="shrink-0 text-primary" />
          <h4 className="m-0 text-[16px] font-bold text-[#0f0f0f]" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
            <span className="px-[3px]" style={{ background: "linear-gradient(180deg, transparent 55%, #FBE08A 55%, #FBE08A 94%, transparent 94%)" }}>
              {isPl ? "Wspieraj rozwój POLUTEK.PL" : "Support POLUTEK.PL"}
            </span>
          </h4>
        </div>
        <p className="m-[0_0_14px] text-[12.5px] leading-[1.55] text-[#4a4a4a]">
          {isPl
            ? "Jednorazowe wsparcie odblokowuje wszystkie materiały bonusowe — na zawsze. Bez subskrypcji."
            : "A one-time tip unlocks every bonus video — forever. No subscription."}
        </p>

        {showTermsError && (
          <p id={termsErrorId} role="alert" className="mb-2 text-[11px] font-bold uppercase tracking-widest text-destructive">
            {t.pleaseAcceptTerms}
          </p>
        )}

        <div className="relative mb-[12px] p-[10px_12px]">
          <Frame radius={11} seed={14} stroke={INK} strokeWidth={1} fill="#f8f3e7" />
          <div className="relative z-10 space-y-1.5">
            <label
              htmlFor={amountInputId}
              className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7a7a7a]"
            >
              {isPl ? `Kwota (min. ${minAmount} ${selectedCurrency})` : `Amount (min. ${minAmount} ${selectedCurrency})`}
            </label>
            <div className="relative flex items-center">
              <input
                id={amountInputId}
                type="number"
                min={minAmount}
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                aria-invalid={amountTooLow}
                aria-describedby={amountTooLow ? amountErrorId : undefined}
                placeholder={String(minAmount)}
                className="w-full bg-transparent px-16 text-center text-[26px] font-extrabold tabular-nums text-[#0f0f0f] outline-none placeholder:text-[#c9c4b8]"
                style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}
              />
              <div className="absolute right-0 flex items-center">
                <select
                  value={selectedCurrency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  aria-label="Currency"
                  className="cursor-pointer appearance-none bg-transparent pr-5 text-[14px] font-bold text-[#4a4a4a] outline-none"
                >
                  {availableCurrencies.map((curr) => (
                    <option key={curr} value={curr}>
                      {curr}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-0 text-[#9a958b]" />
              </div>
            </div>
            {amountTooLow && (
              <p id={amountErrorId} role="alert" className="text-[10px] font-bold uppercase tracking-wide text-destructive">
                {isPl ? `Minimum to ${minAmount} ${selectedCurrency}` : `Minimum is ${minAmount} ${selectedCurrency}`}
              </p>
            )}
          </div>
        </div>

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

      <Dialog open={isRegulaminOpen} onOpenChange={setIsRegulaminOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="border-b pb-4 text-2xl font-black uppercase tracking-tighter">
              {isPl ? "Regulamin serwisu" : "Terms of Service"}
            </DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm prose-neutral max-w-none text-foreground">
            <p>
              {isPl
                ? "Serwis Polutek.pl jest prywatnym, autorskim kanałem wideo. Wsparcie ma charakter jednorazowego, dobrowolnego napiwku i nie jest subskrypcją."
                : "Polutek.pl is a private, independent video channel. Support is a one-time, voluntary tip and not a subscription."}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPolitykaOpen} onOpenChange={setIsPolitykaOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="border-b pb-4 text-2xl font-black uppercase tracking-tighter">
              {isPl ? "Polityka Prywatności" : "Privacy Policy"}
            </DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm prose-neutral max-w-none text-foreground">
            <p>
              {isPl
                ? "Dla bezpieczeństwa i wygody użytkowników serwis korzysta z zewnętrznego systemu uwierzytelniania Clerk oraz Stripe do obsługi płatności."
                : "For security and convenience, the service uses the Clerk authentication system and Stripe for payment processing."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
