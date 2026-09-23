"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useAuthModal } from "@/app/components/auth/AuthModalProvider";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import { logger } from "@/lib/logger";
import { MIN_PAYMENT_BY_CURRENCY, SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";
import { useToast } from "@/app/hooks/useToast";

/**
 * Shared Stripe.js loader for every checkout surface (currently just DonationBox).
 * `loadStripe()` is idempotent for a given publishable key, so a single module-level promise
 * reused across all callers is equivalent to each having its own.
 */
export const checkoutStripePromise: Promise<Stripe | null> | null = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

export interface UseCheckoutFlowOptions {
  /** True for Polish copy, false for English — drives the handful of fixed, shared toast strings. */
  isPl: boolean;
  /** Tag used in console warnings/errors so logs stay attributable, e.g. "DonationBox". */
  logPrefix: string;
  /** `title` field sent in the /api/checkout/create-intent request body. */
  title: string;
  /** Copy for the "amount is below the minimum" toast — wording differs per surface (tip vs pledge). */
  getMinAmountTooLowMessage: (minAmount: number, currency: string) => string;
  /** Copy for the "this payment attempt is finished, start a new one" toast. */
  attemptFinishedMessage: string;
}

export interface UseCheckoutFlowResult {
  /** Clerk viewer id, or null/undefined when signed out. */
  userId: string | null | undefined;
  /** Clerk viewer's primary email, threaded to CheckoutModal for receipt display. */
  userEmail: string | undefined;

  isInitialLoading: boolean;
  minimums: Record<SupportedCurrency, number>;
  patronThresholds: Record<SupportedCurrency, number>;
  patronBoxMinimums: Record<SupportedCurrency, number>;

  isTermsAccepted: boolean;
  setIsTermsAccepted: (value: boolean) => void;
  showTermsError: boolean;
  setShowTermsError: (value: boolean) => void;
  /** Radix Checkbox onCheckedChange handler: sets acceptance and clears any shown error. */
  onTermsCheckedChange: (checked: boolean | "indeterminate") => void;

  isLoading: boolean;
  clientSecret: string | null;
  paymentId: string | null;
  paymentUiStatus: string | null;
  isCheckoutModalOpen: boolean;
  isMounted: boolean;
  isSuccess: boolean;
  isSyncing: boolean;

  /** Re-checks payment status on demand (CheckoutModal's manual retry action). */
  handleRetryStatusCheck: () => Promise<void>;
  /** Closes the modal; full reload on a confirmed success, soft URL cleanup otherwise. */
  closeSuccessAndSync: () => void;
  /**
   * Runs the shared auth/terms/amount checks and, if they pass, calls
   * /api/checkout/create-intent and hands the result to CheckoutModal.
   */
  submit: (amount: number | "", currency: string, minAmount: number) => Promise<void>;
}

/**
 * Checkout plumbing for the tip surface (DonationBox): fetching per-currency minimums, the
 * terms/modal state machine, the scroll lock while the modal is open, the Stripe return-URL
 * reconciliation loop, and the /api/checkout/create-intent → CheckoutModal handoff.
 * Presentation (copy, layout, amount picker UI) and surface-specific behavior (DonationBox's
 * own `?support=1` deep link) stay in the calling component. This hook used to be shared with
 * the now-removed /secretproject and /secretproject2 pledge boxes.
 */
export function useCheckoutFlow(options: UseCheckoutFlowOptions): UseCheckoutFlowResult {
  const { isPl, logPrefix, title, getMinAmountTooLowMessage, attemptFinishedMessage } = options;

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
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [paymentUiStatus, setPaymentUiStatus] = useState<string | null>(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  // True once a confirmed-success screen has been shown for this return (either Stripe's own
  // redirect_status said "succeeded", or the backend later confirmed it). Drives the full reload
  // on close so the page comes back with live Patron access, video unlocks and support-box copy.
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [minimums, setMinimums] = useState<Record<SupportedCurrency, number>>(MIN_PAYMENT_BY_CURRENCY);
  const [patronThresholds, setPatronThresholds] = useState<Record<SupportedCurrency, number>>(MIN_PAYMENT_BY_CURRENCY);
  const [patronBoxMinimums, setPatronBoxMinimums] = useState<Record<SupportedCurrency, number>>(MIN_PAYMENT_BY_CURRENCY);

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
      .catch((error) => logger.warn(`[${logPrefix}] Failed to fetch payment minimums:`, error))
      .finally(() => setIsInitialLoading(false));
    // logPrefix is a fixed literal per caller (e.g. "DonationBox") and never changes across
    // this component's lifetime, so this intentionally still runs only once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stripe return-URL handling: trust Stripe's own redirect_status for the visible message,
  // reconcile access in the background via GET /api/payments/[id] (which runs fulfillPayment()
  // when still PENDING), and never downgrade an already-shown success.
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
        // Stripe says the payment failed — show the failure message, nothing to reconcile.
        setIsSyncing(false);
        setPaymentUiStatus("FAILED_CANCELED");
        return () => {
          cancelled = true;
        };
      }

      // Treat "succeeded" (and the common case where Stripe omits the param on a plain card
      // confirmation) as an immediate success: show the thank-you now, reconcile access quietly
      // in the background. Genuinely async methods that come back "pending"/"processing" get a
      // neutral processing screen until the backend confirms.
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

      // Background reconciliation: ensures the PatronGrant actually lands (the status endpoint
      // retrieves the PaymentIntent from Stripe and runs fulfillPayment() when still PENDING).
      // This runs silently — it never downgrades an already-shown success message; it only
      // upgrades a "processing" screen to success (or surfaces a real failure). Returns true
      // once there's nothing left to wait for.
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
            // Only a not-yet-confirmed (async) flow may still change the visible message.
            if (isTerminal || attempts >= maxAttempts) {
              setIsSyncing(false);
              setPaymentUiStatus(nextStatus ?? "TIMED_OUT");
              return true;
            }
            setPaymentUiStatus(nextStatus ?? "PROCESSING");
            return false;
          }

          // Already showing success from the redirect signal: keep quietly reconciling until the
          // grant lands so the on-close reload reflects live Patron access, but never change copy.
          return isTerminal || attempts >= maxAttempts;
        } catch (e) {
          logger.error(`[${logPrefix}] Reconcile error`, e);
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
      logger.error(`[${logPrefix}] Manual status check error`, e);
      setPaymentUiStatus("TIMED_OUT");
    } finally {
      setIsSyncing(false);
    }
  }, [paymentId, logPrefix]);

  // Closing the success screen (either the X or "back to site"): if the payment went through,
  // do a full reload to the clean URL so every server-rendered surface comes back reflecting the
  // freshly granted access at once, and all client caches are rebuilt. For a non-success close we
  // only need to strip the return params, so a soft navigation is enough.
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

  const onTermsCheckedChange = useCallback((checked: boolean | "indeterminate") => {
    setIsTermsAccepted(!!checked);
    if (checked) setShowTermsError(false);
  }, []);

  const submit = useCallback(
    async (amount: number | "", currency: string, minAmount: number) => {
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
        toast(getMinAmountTooLowMessage(minAmount, currency), "error");
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
            currency: currency.toUpperCase(),
            title,
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
          toast(attemptFinishedMessage, "error");
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
        logger.error(`[${logPrefix}] Payment error`, error);
        toast(
          isPl
            ? "Błąd połączenia z systemem płatności. Spróbuj odświeżyć stronę."
            : "Payment system connection error. Please refresh the page.",
          "error",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      userId,
      openAuthModal,
      isTermsAccepted,
      toast,
      isPl,
      checkoutRequestId,
      title,
      getMinAmountTooLowMessage,
      attemptFinishedMessage,
      logPrefix,
    ],
  );

  return {
    userId,
    userEmail,

    isInitialLoading,
    minimums,
    patronThresholds,
    patronBoxMinimums,

    isTermsAccepted,
    setIsTermsAccepted,
    showTermsError,
    setShowTermsError,
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
  };
}
