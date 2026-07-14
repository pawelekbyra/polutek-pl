"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@clerk/nextjs";
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
import { Loader2, Heart } from "../icons";
import CheckoutModal from "../playlist/CheckoutModal";
import DonationAmountField from "./DonationAmountField";
import DonationLegalDialog from "./DonationLegalDialog";
import { RegulaminContent, PolitykaContent } from "../legal/LegalDocs";
import { Card, Button } from "flowbite-react";

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
  const { open: openAuthModal } = useAuthModal();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<string>(t.currency);
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
  const [patronBoxMinimums, setPatronBoxMinimums] = useState<Record<SupportedCurrency, number>>(MIN_PAYMENT_BY_CURRENCY);

  const currencyKey = selectedCurrency.toUpperCase() as SupportedCurrency;
  const checkoutMinAmount = minimums[currencyKey] ?? minimums.PLN;
  // Non-patrons pay a fixed gate price (the patron threshold), so a successful tip always grants
  // access as the copy promises. Existing patrons already have access, so they may support with any
  // amount down to the admin-configured free-amount box minimum (independent of the gate price).
  const patronThreshold = patronThresholds[currencyKey] ?? checkoutMinAmount;
  const patronBoxMin = patronBoxMinimums[currencyKey] ?? checkoutMinAmount;
  const minAmount = viewerIsPatron ? patronBoxMin : patronThreshold;
  // Currency switcher is available in both languages; only the pre-selected default differs.
  const availableCurrencies = [...SUPPORTED_CURRENCIES];
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

        const nextBoxMins = { ...nextMinimums } as Record<SupportedCurrency, number>;
        for (const currency of SUPPORTED_CURRENCIES) {
          const boxMin = Number(data.patronBoxMinimums?.[currency]?.min);
          if (Number.isFinite(boxMin) && boxMin > 0) nextBoxMins[currency] = boxMin;
        }
        setPatronBoxMinimums(nextBoxMins);
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

  // Pre-select the default currency for the active language: PLN for Polish, geolocation-based
  // (USD/GBP/EUR/CHF) for English. The user can still switch via the currency picker.
  useEffect(() => {
    const nextCurrency = detectDefaultCurrency(language);
    setSelectedCurrency(nextCurrency);
    if (viewerIsPatron) setAmount(getSuggestedAmount(nextCurrency));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

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
          openAuthModal("sign-in");
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
  }, [userId, openAuthModal, isTermsAccepted, amount, minAmount, toast, isPl, selectedCurrency, checkoutRequestId, videoTitle]);

  const title = isPl ? "Strefa Fenkjuu 👑" : "Thank You Zone 👑";

  const subtitle = isPl
    ? "Wspieraj tworzenie wartościowych treści"
    : "Support valuable independent content";

  const bodyCopy = viewerIsPatron
    ? (isPl
        ? "Dziękujemy — masz już dostęp do strefy wspierających. Ta wpłata jest dodatkowym gestem wsparcia."
        : "Thank you — your supporter access is already active. This tip is an extra show of support.")
    : (isPl
        ? "Jednorazowe wsparcie pomaga rozwijać kanał i odblokowuje dożywotni dostęp do Strefy Fenkjuu."
        : "A one-time tip helps grow the channel and unlocks lifetime Thank You Zone access.");

  const bullets: { text: string }[] = [
    { text: isPl ? "Twoje wsparcie pomaga w rozwoju kanału" : "Your support helps the channel grow" },
    { text: isPl ? "Dostęp do specjalnych materiałów" : "Access to special materials" },
    { text: isPl ? "Wcześniejszy dostęp do nowych filmów" : "Early access to new videos" },
    { text: isPl ? "Twoje imię w odcinkach dla wspierających" : "Your name in supporter episodes" },
  ];

  return (
    <Card
      id="donations"
      className="relative my-[10px] mb-3 scroll-mt-20 rounded-[18px] border border-[#f1dfbd] bg-white [&>div]:p-[22px_26px_18px]"
    >
      <div>
        <div className="mb-1.5 flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-red-500">
            <Heart size={25} className="fill-white text-white" />
          </span>
          <h4 className="font-brand m-0 text-[21px] font-extrabold leading-tight tracking-[-0.045em] text-[var(--chan-ink)]">
            <span>{title}</span>
          </h4>
        </div>
        <p className="m-[-22px_0_16px_64px] font-sans text-[13px] font-medium tracking-[-0.015em] text-[var(--chan-body)]">{subtitle}</p>
        <p className="sr-only">{bodyCopy}</p>

        <ul className="m-[0_0_16px] flex flex-col gap-[9px] font-sans text-[13px]">
          {bullets.map((bullet) => (
            <li
              key={bullet.text}
              className="flex items-start gap-[8px] text-[var(--chan-ink)]"
            >
              <span className="mt-[2px] flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full bg-[#58a65c] text-[9px] font-black text-white">✓</span>
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

        <Button
          type="button"
          color="blue"
          size="lg"
          onClick={onSupport}
          disabled={isLoading || isInitialLoading || amount === "" || amount < minAmount}
          aria-busy={isLoading}
          className="font-sans w-full text-[16px] font-extrabold tracking-[-0.025em]"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              <span role="status" aria-live="polite">
                {isPl ? "Przetwarzanie..." : "Processing..."}
              </span>
            </span>
          ) : (
            <span>{t.tipTheGuy}</span>
          )}
        </Button>

        <label className="mt-3 flex cursor-pointer items-start justify-center gap-2 px-1 text-center">
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
    </Card>
  );
}
