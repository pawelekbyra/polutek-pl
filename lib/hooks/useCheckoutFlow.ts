"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useAuthModal } from "@/app/components/auth/AuthModalProvider";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import { logger } from "@/lib/logger";
import { MIN_PAYMENT_BY_CURRENCY, SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";
import { useToast } from "@/app/hooks/useToast";

// Query params Stripe/our return URL add after a redirect-based payment method.
const STRIPE_RETURN_PARAMS = [
  "payment_intent",
  "payment_intent_client_secret",
  "redirect_status",
  "payment_id",
  "success",
  "canceled",
  "session_id",
];

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
  patronBoxMinimums: Record<SupportedCurrency, number>;

  isTermsAccepted: boolean;
  setIsTermsAccepted: (value: boolean) => void;
  showTermsError: boolean;
  setShowTermsError: (value: boolean) => void;
  /** Radix Checkbox onCheckedChange handler: sets acceptance and clears any shown error. */
  onTermsCheckedChange: (checked: boolean | "indeterminate") => void;

  isLoading: boolean;
  clientSecret: string | null;
  /** Methods Stripe allows for the current intent (from create-intent); drives the tip gate tiles. */
  paymentMethodTypes: string[];
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
  /** Resolves true once an intent (clientSecret) is ready for the checkout step. */
  submit: (amount: number | "", currency: string, minAmount: number, options?: CheckoutSubmitOptions) => Promise<boolean>;
  /** Drops the current intent (e.g. the viewer went back to change the amount or method). */
  resetCheckout: () => void;
  /**
   * Shows the result of a payment confirmed without leaving the page (card, BLIK, wallets) and
   * reconciles it in the background, exactly like a redirect return.
   */
  trackConfirmedPayment: (paymentId: string, outcome: "succeeded" | "processing") => void;
}

export interface CheckoutSubmitOptions {
  /** False when the caller keeps its own Terms consent (the tip gate asks for it on step 1). */
  requireTerms?: boolean;
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
  const queryClient = useQueryClient();

  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentMethodTypes, setPaymentMethodTypes] = useState<string[]>([]);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  // One idempotency key per distinct request: a changed amount or currency must create a
  // new intent (reusing the key returned the old intent with the old amount).
  const checkoutRequestRef = useRef<{ signature: string; id: string } | null>(null);
  const [paymentUiStatus, setPaymentUiStatus] = useState<string | null>(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  // True once a confirmed-success screen has been shown for this return (either Stripe's own
  // redirect_status said "succeeded", or the backend later confirmed it). Drives the full reload
  // on close so server-rendered supporter state (e.g. the comment Patron badge) is fresh.
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [minimums, setMinimums] = useState<Record<SupportedCurrency, number>>(MIN_PAYMENT_BY_CURRENCY);
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

  // Background reconciliation shared by the redirect return and in-page confirmations: the status
  // endpoint retrieves the PaymentIntent from Stripe and runs fulfillPayment() when still PENDING.
  // It never downgrades an already-shown success; it only upgrades a "processing" screen to
  // success (or surfaces a real failure).
  const stopTrackingRef = useRef<(() => void) | null>(null);
  const startTracking = useCallback(
    (trackedPaymentId: string, redirectSucceeded: boolean) => {
      stopTrackingRef.current?.();
      let interval: ReturnType<typeof setInterval> | undefined;
      let cancelled = false;
      let attempts = 0;
      const maxAttempts = 10;

      const reconcile = async (): Promise<boolean> => {
        attempts++;
        try {
          const res = await fetch(`/api/payments/${encodeURIComponent(trackedPaymentId)}`, { cache: "no-store" });
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

          // Already showing success: keep quietly reconciling until the grant lands so the
          // on-close reload reflects the fresh supporter state, but never change copy.
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

      const stop = () => {
        cancelled = true;
        if (interval) clearInterval(interval);
      };
      stopTrackingRef.current = stop;
      return stop;
    },
    [logPrefix],
  );

  useEffect(() => () => stopTrackingRef.current?.(), []);

  const showOutcome = useCallback(
    (trackedPaymentId: string, outcome: "succeeded" | "processing") => {
      setIsCheckoutModalOpen(true);
      setIsSuccess(true);
      setPaymentId(trackedPaymentId);
      queryClient.invalidateQueries();
      if (outcome === "succeeded") {
        setPaymentUiStatus("SUCCEEDED");
        setPaymentSucceeded(true);
        setIsSyncing(false);
      } else {
        setPaymentUiStatus("PROCESSING");
        setIsSyncing(true);
      }
      return startTracking(trackedPaymentId, outcome === "succeeded");
    },
    [queryClient, startTracking],
  );

  const trackConfirmedPayment = useCallback(
    (trackedPaymentId: string, outcome: "succeeded" | "processing") => {
      checkoutRequestRef.current = null;
      showOutcome(trackedPaymentId, outcome);
    },
    [showOutcome],
  );

  // Stripe return-URL handling: trust Stripe's own redirect_status for the visible message and
  // reconcile in the background. "succeeded" (or no param, as on a plain card confirmation)
  // shows the thank-you at once; genuinely async methods that come back "pending"/"processing"
  // get a neutral processing screen until the backend confirms.
  useEffect(() => {
    setIsMounted(true);
    const returnedPaymentId = searchParams.get("payment_id");
    if (searchParams.get("success") !== "true" || !returnedPaymentId) return;

    const redirectStatus = searchParams.get("redirect_status");
    if (redirectStatus === "failed") {
      // Stripe says the payment failed — show the failure message, nothing to reconcile.
      setIsCheckoutModalOpen(true);
      setIsSuccess(true);
      setPaymentId(returnedPaymentId);
      setIsSyncing(false);
      setPaymentUiStatus("FAILED_CANCELED");
      return;
    }

    const redirectSucceeded = redirectStatus === "succeeded" || redirectStatus === null;
    return showOutcome(returnedPaymentId, redirectSucceeded ? "succeeded" : "processing");
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
  // freshly granted access at once, and all client caches are rebuilt. For a non-success close
  // (e.g. "Back" before paying) only Stripe's return params need stripping, and that must stay
  // shallow: a router.replace here re-rendered the whole page on the server (flashing the
  // route's loading screen) and, with UrlMask's "/" address, even dropped the open video.
  const closeSuccessAndSync = useCallback(() => {
    setIsCheckoutModalOpen(false);
    if (paymentSucceeded) {
      window.location.replace(window.location.pathname);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const hadReturnParams = STRIPE_RETURN_PARAMS.some((key) => params.has(key));
    if (!hadReturnParams) return;
    STRIPE_RETURN_PARAMS.forEach((key) => params.delete(key));
    const query = params.toString();
    try {
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    } catch {
      // Cosmetic; the checkout is already closed.
    }
  }, [paymentSucceeded]);

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

  const resetCheckout = useCallback(() => {
    stopTrackingRef.current?.();
    setClientSecret(null);
    setPaymentMethodTypes([]);
    setPaymentId(null);
    setIsCheckoutModalOpen(false);
    setIsSuccess(false);
    setIsSyncing(false);
    setPaymentUiStatus(null);
  }, []);

  const submit = useCallback(
    async (amount: number | "", currency: string, minAmount: number, submitOptions: CheckoutSubmitOptions = {}) => {
      const { requireTerms = true } = submitOptions;
      if (!userId) {
        openAuthModal("sign-in");
        return false;
      }
      if (requireTerms && !isTermsAccepted) {
        setShowTermsError(true);
        return false;
      }
      setShowTermsError(false);

      if (!amount || amount < minAmount) {
        toast(getMinAmountTooLowMessage(minAmount, currency), "error");
        return false;
      }

      try {
        setIsLoading(true);
        const normalizedCurrency = currency.toUpperCase();
        const signature = [Number(amount), normalizedCurrency].join("|");
        if (checkoutRequestRef.current?.signature !== signature) {
          checkoutRequestRef.current = { signature, id: crypto.randomUUID() };
        }
        const requestId = checkoutRequestRef.current.id;

        const response = await fetch("/api/checkout/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountMinor: Math.round(Number(amount) * 100),
            currency: normalizedCurrency,
            title,
            requestId,
          }),
          cache: "no-store",
        });

        const data = await response.json();

        if (data?.clientSecret) {
          setClientSecret(data.clientSecret);
          setPaymentMethodTypes(Array.isArray(data.paymentMethodTypes) ? data.paymentMethodTypes : []);
          setPaymentId(data.paymentId || null);
          setIsCheckoutModalOpen(true);
          return true;
        } else if (data?.terminal) {
          setPaymentId(data.paymentId || null);
          setPaymentUiStatus(data.status || "FAILED_CANCELED");
          toast(attemptFinishedMessage, "error");
          checkoutRequestRef.current = null;
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
      return false;
    },
    [
      userId,
      openAuthModal,
      isTermsAccepted,
      toast,
      isPl,
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
    patronBoxMinimums,

    isTermsAccepted,
    setIsTermsAccepted,
    showTermsError,
    setShowTermsError,
    onTermsCheckedChange,

    isLoading,
    clientSecret,
    paymentMethodTypes,
    paymentId,
    paymentUiStatus,
    isCheckoutModalOpen,
    isMounted,
    isSuccess,
    isSyncing,

    handleRetryStatusCheck,
    closeSuccessAndSync,
    submit,
    resetCheckout,
    trackConfirmedPayment,
  };
}
