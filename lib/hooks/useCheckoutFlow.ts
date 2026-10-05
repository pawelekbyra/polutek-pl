"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@/lib/auth/react";
import { useAuthModal } from "@/app/components/auth/AuthModalProvider";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { MIN_PAYMENT_BY_CURRENCY, SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/constants";
import { useToast } from "@/app/hooks/useToast";
import { LEGAL_DOCUMENTS_VERSION } from "@/lib/legal/version";
import type { Tx } from "@/lib/i18n/ui";

// Query params Stripe/our return URL add after a redirect-based payment method.
const STRIPE_RETURN_PARAMS = [
  "payment_intent",
  "payment_intent_client_secret",
  "redirect_status",
  "payment_id",
  "success",
];

/**
 * One tip attempt = one requestId = one PaymentIntent on the server (which updates the intent when
 * the amount changes). Kept for the tab's session, so closing and re-opening the gate continues
 * the same attempt instead of opening a new intent; dropped once the attempt is finished.
 */
const ATTEMPT_STORAGE_KEY = "pp:tip-attempt-id";

function readAttemptId(): string | null {
  try {
    return window.sessionStorage.getItem(ATTEMPT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeAttemptId(id: string | null) {
  try {
    if (id) window.sessionStorage.setItem(ATTEMPT_STORAGE_KEY, id);
    else window.sessionStorage.removeItem(ATTEMPT_STORAGE_KEY);
  } catch {
    // Storage blocked (private mode): the attempt simply lives as long as this hook.
  }
}

/** Payment status as reported by GET /api/payments/[id] (PaymentUiStatus) plus local states. */
export type TipUiStatus = "PROCESSING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | "TIMED_OUT";

export interface UseCheckoutFlowOptions {
  /** True for Polish copy, false for English — drives the handful of fixed toast strings. */
  tx: Tx;
}

export interface UseCheckoutFlowResult {
  /** Signed-in viewer id, or null/undefined when signed out. */
  userId: string | null | undefined;
  /** Viewer's e-mail, prefilled where a payment form asks for one. */
  userEmail: string | undefined;

  isInitialLoading: boolean;
  /** Minimum tip per currency (major units), the same one the server enforces. */
  minimums: Record<SupportedCurrency, number>;

  clientSecret: string | null;
  /** Methods Stripe allows for the current intent (from create-intent); drives the tip gate tiles. */
  paymentMethodTypes: string[];
  paymentId: string | null;
  paymentUiStatus: TipUiStatus | null;
  /** True once a confirmed payment (or a Stripe return) moved the gate to its result screen. */
  isSuccess: boolean;
  isSyncing: boolean;

  /** Re-checks payment status on demand (the "check again" action). */
  handleRetryStatusCheck: () => Promise<void>;
  /** Leaves the result screen: full reload after a confirmed payment, URL cleanup otherwise. */
  closeSuccessAndSync: () => void;
  /**
   * Creates or updates the intent for this amount; resolves true once a client secret is ready.
   * `termsAccepted`: the payer ticked the Terms checkbox (the server records the accepted version).
   */
  submit: (amount: number | "", currency: string, minAmount: number, termsAccepted?: boolean) => Promise<boolean>;
  /** Leaves the result screen state (e.g. "try again" after a failure). */
  resetCheckout: () => void;
  /**
   * Shows the result of a payment confirmed without leaving the page (card, BLIK, wallets) and
   * reconciles it in the background, exactly like a redirect return.
   */
  trackConfirmedPayment: (paymentId: string, outcome: "succeeded" | "processing") => void;
}

/**
 * Checkout plumbing for the tip gate (SupportModal): per-currency minimums, the
 * create-intent call, the Stripe return-URL handling and the background reconciliation loop.
 */
export function useCheckoutFlow(options: UseCheckoutFlowOptions): UseCheckoutFlowResult {
  const { tx } = options;

  const toast = useToast();
  const { userId } = useAuth();
  const { user } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress;
  const { open: openAuthModal } = useAuthModal();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentMethodTypes, setPaymentMethodTypes] = useState<string[]>([]);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentUiStatus, setPaymentUiStatus] = useState<TipUiStatus | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  // True once a confirmed-success screen has been shown. Drives the full reload on close so
  // server-rendered supporter state (e.g. the comment Patron badge) is fresh.
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [minimums, setMinimums] = useState<Record<SupportedCurrency, number>>(MIN_PAYMENT_BY_CURRENCY);

  useEffect(() => {
    fetch("/api/payment-settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.limits) return;
        const next = { ...MIN_PAYMENT_BY_CURRENCY } as Record<SupportedCurrency, number>;
        for (const currency of SUPPORTED_CURRENCIES) {
          const min = Number(data.limits[currency]?.minAmount);
          if (Number.isFinite(min) && min > 0) next[currency] = min;
        }
        setMinimums(next);
      })
      .catch((error) => logger.warn("[TipFlow] Failed to fetch payment minimums:", error))
      .finally(() => setIsInitialLoading(false));
  }, []);

  // Background reconciliation shared by the redirect return and in-page confirmations: the status
  // endpoint retrieves the PaymentIntent from Stripe and runs fulfillPayment() when needed.
  // It never downgrades an already-shown success; it only upgrades a "processing" screen to
  // success (or surfaces a real failure).
  const stopTrackingRef = useRef<(() => void) | null>(null);
  const startTracking = useCallback((trackedPaymentId: string, redirectSucceeded: boolean) => {
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
        const nextStatus = (data.uiStatus as TipUiStatus | undefined) ?? null;
        const isTerminal = nextStatus === "SUCCEEDED" || nextStatus === "FAILED" || nextStatus === "REFUNDED";

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

        // Already showing success: keep quietly reconciling until it is recorded so the
        // on-close reload reflects it, but never change the copy.
        return isTerminal || attempts >= maxAttempts;
      } catch (e) {
        logger.error("[TipFlow] Reconcile error", e);
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
  }, []);

  useEffect(() => () => stopTrackingRef.current?.(), []);

  const showOutcome = useCallback(
    (trackedPaymentId: string, outcome: "succeeded" | "processing") => {
      // This attempt is finished: the next tip starts a new one.
      storeAttemptId(null);
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
      showOutcome(trackedPaymentId, outcome);
    },
    [showOutcome],
  );

  // Stripe return-URL handling: trust Stripe's own redirect_status for the visible message and
  // reconcile in the background. "succeeded" (or no param, as on a plain card confirmation)
  // shows the thank-you at once; async methods that come back "pending"/"processing" get a
  // neutral processing screen until the backend confirms.
  useEffect(() => {
    const returnedPaymentId = searchParams.get("payment_id");
    if (searchParams.get("success") !== "true" || !returnedPaymentId) return;

    const redirectStatus = searchParams.get("redirect_status");
    if (redirectStatus === "failed") {
      // Stripe says this attempt failed; the intent can still be paid, so the attempt is kept.
      setIsSuccess(true);
      setPaymentId(returnedPaymentId);
      setIsSyncing(false);
      setPaymentUiStatus("FAILED");
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
      const nextStatus = (data.uiStatus as TipUiStatus | undefined) ?? null;
      setPaymentUiStatus(nextStatus ?? "TIMED_OUT");
      if (nextStatus === "SUCCEEDED") setPaymentSucceeded(true);
    } catch (e) {
      logger.error("[TipFlow] Manual status check error", e);
      setPaymentUiStatus("TIMED_OUT");
    } finally {
      setIsSyncing(false);
    }
  }, [paymentId]);

  // Leaving the result screen: after a confirmed payment, a full reload to the clean URL so every
  // server-rendered surface reflects it. Otherwise only Stripe's return params are stripped, and
  // shallowly: a router.replace re-renders the whole page on the server and drops the open video.
  const closeSuccessAndSync = useCallback(() => {
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
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    } catch {
      // Cosmetic; the gate is already closed.
    }
  }, [paymentSucceeded]);

  const resetCheckout = useCallback(() => {
    stopTrackingRef.current?.();
    setIsSuccess(false);
    setIsSyncing(false);
    setPaymentUiStatus(null);
  }, []);

  const requestIntent = useCallback(async (amountMinor: number, currency: string, requestId: string, termsAccepted: boolean) => {
    const response = await fetch("/api/checkout/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountMinor,
        currency,
        requestId,
        ...(termsAccepted ? { acceptedTermsVersion: LEGAL_DOCUMENTS_VERSION } : {}),
      }),
      cache: "no-store",
    });
    return { response, data: await response.json().catch(() => null) };
  }, []);

  const submit = useCallback(
    async (amount: number | "", currency: string, minAmount: number, termsAccepted = false) => {
      if (!userId) {
        openAuthModal("sign-in");
        return false;
      }
      if (!amount || amount < minAmount) {
        toast(
          tx("Minimalna kwota napiwku to {0} {1}", "Minimum tip amount is {0} {1}", minAmount, currency),
          "error",
        );
        return false;
      }

      try {
        const normalizedCurrency = currency.toUpperCase();
        const amountMinor = Math.round(Number(amount) * 100);
        let requestId = readAttemptId() ?? crypto.randomUUID();
        storeAttemptId(requestId);

        let { response, data } = await requestIntent(amountMinor, normalizedCurrency, requestId, termsAccepted);
        if (data?.terminal) {
          // The stored attempt is finished (paid, failed to start, canceled): start a new one.
          requestId = crypto.randomUUID();
          storeAttemptId(requestId);
          ({ response, data } = await requestIntent(amountMinor, normalizedCurrency, requestId, termsAccepted));
        }

        if (data?.clientSecret) {
          setClientSecret(data.clientSecret);
          setPaymentMethodTypes(Array.isArray(data.paymentMethodTypes) ? data.paymentMethodTypes : []);
          setPaymentId(data.paymentId || null);
          return true;
        }

        if (response.status === 401 || String(data?.error).includes("AUTH_REQUIRED")) {
          toast(tx("Twoja sesja wygasła. Zaloguj się ponownie.", "Your session has expired. Please sign in again."), "error");
          openAuthModal("sign-in");
        } else if (data?.error === "PAYMENT_IN_PROGRESS") {
          toast(
            tx("Ten napiwek jest właśnie opłacany (np. czeka na potwierdzenie w banku). Dokończ go albo spróbuj za kilka minut.", "This tip is being paid right now (e.g. waiting for your bank). Finish it or try again in a few minutes."),
            "error",
          );
        } else {
          toast(
            tx("Nie udało się rozpocząć płatności. Spróbuj ponownie za chwilę.", "The payment could not be started. Please try again in a moment."),
            "error",
          );
        }
      } catch (error: unknown) {
        logger.error("[TipFlow] Payment error", error);
        toast(
          tx("Błąd połączenia z systemem płatności. Spróbuj odświeżyć stronę.", "Payment system connection error. Please refresh the page."),
          "error",
        );
      }
      return false;
    },
    [userId, openAuthModal, toast, tx, requestIntent],
  );

  return {
    userId,
    userEmail,
    isInitialLoading,
    minimums,
    clientSecret,
    paymentMethodTypes,
    paymentId,
    paymentUiStatus,
    isSuccess,
    isSyncing,
    handleRetryStatusCheck,
    closeSuccessAndSync,
    submit,
    resetCheckout,
    trackConfirmedPayment,
  };
}
