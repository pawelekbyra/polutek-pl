"use client";

import React, { useState, useEffect, useTransition } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth/react";
import { useAuthModal } from "./auth/AuthModalProvider";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { useLanguage } from "./LanguageContext";
import EmailSubscriptionConsentModal from "./subscriptions/EmailSubscriptionConsentModal";
import { useClientReady } from "@/app/hooks/useClientEnvironment";
import { Bell, BellOff, BellRing, Check } from "lucide-react";

interface SubscribeButtonProps {
  creatorId?: string;
  creatorSlug?: string | null;
  creatorName?: string | null;
  initialSubscribersCount?: number;
  initialIsSubscribed?: boolean;
  /** The bell of the viewer's subscription to this channel (default true). */
  initialNotify?: boolean;
  className?: string;
  variant?: "default" | "compact";
  onStatusChange?: (isSubscribed: boolean, subscribersCount?: number) => void;
}

export default function SubscribeButton({
  creatorId,
  creatorSlug,
  creatorName,
  initialSubscribersCount,
  initialIsSubscribed,
  initialNotify,
  className,
  variant = "default",
  onStatusChange,
}: SubscribeButtonProps) {
  const { t, language, tx } = useLanguage();
  const { userId } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [isSubscribed, setIsSubscribed] = useState(
    initialIsSubscribed ?? false,
  );
  const [notify, setNotify] = useState(initialNotify ?? true);
  const [bellPending, setBellPending] = useState(false);
  const [isPending, startTransition] = useTransition();
  const mounted = useClientReady();
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch status if not provided
  useEffect(() => {
    if (userId && initialIsSubscribed === undefined) {
      // The status of THIS channel (no id = the main channel, the old behaviour).
      const query = creatorId ? `?creatorId=${encodeURIComponent(creatorId)}` : "";
      fetch(`/api/subscriptions${query}`)
        .then(async (response) => {
          if (!response.ok)
            throw new Error(`Subscription status failed: ${response.status}`);
          return response.json() as Promise<{ isSubscribed: boolean; notify?: boolean }>;
        })
        .then((data) => {
          setIsSubscribed(data.isSubscribed);
          setNotify(data.notify ?? true);
        })
        .catch((err) => logger.warn("[SUBSCRIPTION_STATUS_FETCH_ERROR]", err));
    }
  }, [userId, creatorId, creatorSlug, initialIsSubscribed]);

  const effectiveIsSubscribed = Boolean(mounted && userId && isSubscribed);

  const handleSubscribe = async () => {
    if (!userId) {
      openAuthModal("sign-in");
      return;
    }
    if (isPending) return;

    if (!effectiveIsSubscribed) {
      setShowConfirm(true);
      return;
    }

    executeSubscribe();
  };

  const executeSubscribe = async () => {
    const nextState = !effectiveIsSubscribed;
    const previousState = effectiveIsSubscribed;
    setErrorMessage(null);
    setIsSubscribed(nextState);

    startTransition(async () => {
      try {
        const response = await fetch("/api/subscriptions", {
          method: nextState ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(creatorId ? { creatorId } : {}),
        });

        const result = (await response.json().catch(() => ({}))) as {
          isSubscribed: boolean;
          subscribersCount: number;
          notify?: boolean;
          error?: string;
          message?: string;
        };
        if (!response.ok) {
          const code = result.error;
          const message =
            response.status === 401
              ? tx("Zaloguj się, aby zarządzać powiadomieniami.", "Sign in to manage notifications.")
              : response.status === 400 && code === "TRUSTED_EMAIL_REQUIRED"
                ? tx("Konto musi mieć zweryfikowany adres e-mail.", "The account needs a verified email address.")
                : response.status === 404 && code === "CHANNEL_NOT_FOUND"
                  ? tx("Ten kanał nie jest dostępny.", "This channel is not available.")
                : response.status === 409 &&
                    code === "EMAIL_PREFERENCE_IDENTITY_CONFLICT"
                  ? tx("Ten adres e-mail jest już przypisany do innego konta.", "This email address is already linked to another account.")
                  : response.status === 429
                    ? tx("Zbyt wiele prób. Spróbuj ponownie później.", "Too many attempts. Please try again later.")
                    : result.message ||
                      tx("Nie udało się zapisać subskrypcji. Spróbuj ponownie.", "Could not save the subscription. Please try again.");
          setErrorMessage(message);
          setIsSubscribed(previousState);
          return;
        }

        setIsSubscribed(result.isSubscribed);
        setNotify(result.isSubscribed ? result.notify ?? true : true);
        onStatusChange?.(result.isSubscribed, result.subscribersCount);
      } catch (err) {
        logger.warn("[SUBSCRIPTION_TOGGLE_ERROR]", err);
        setIsSubscribed(previousState);
        setErrorMessage(tx("Nie udało się połączyć z serwerem. Spróbuj ponownie.", "Could not reach the server. Please try again."));
      }
    });
  };

  // The bell: switches notifications of this subscription only (PATCH, optimistic, rolled back on error).
  const toggleNotify = async () => {
    if (bellPending || !effectiveIsSubscribed) return;
    const next = !notify;
    setErrorMessage(null);
    setNotify(next);
    setBellPending(true);
    try {
      const response = await fetch("/api/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creatorId ? { creatorId, notify: next } : { notify: next }),
      });
      if (!response.ok) throw new Error(`Notify toggle failed: ${response.status}`);
    } catch (err) {
      logger.warn("[SUBSCRIPTION_NOTIFY_ERROR]", err);
      setNotify(!next);
      setErrorMessage(tx("Nie udało się zmienić powiadomień. Spróbuj ponownie.", "Could not change notifications. Please try again."));
    } finally {
      setBellPending(false);
    }
  };

  const bellLabel = notify
    ? tx("Powiadomienia: włączone", "Notifications: on")
    : tx("Powiadomienia: wyłączone", "Notifications: off");

  return (
    <>
      <div className="inline-flex items-center gap-1.5">
      <motion.button
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleSubscribe}
        disabled={isPending}
        className={cn(
          "relative text-sm font-bold h-9 px-4 flex items-center justify-center gap-1.5 border border-[var(--cm-ink-14-line)] transition-[transform,background-color,border-color,box-shadow] duration-200 active:translate-y-0 active:scale-[0.97] rounded-full font-sans text-[var(--chan-ink)] bg-[var(--cm-card-58-white)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_6px_16px_-8px_rgba(23,23,23,0.2)] hover:-translate-y-px hover:border-[var(--cm-blue-38-line)] hover:bg-[var(--cm-card-72-white)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_10px_22px_-8px_rgba(23,23,23,0.26)]",
          isPending && "opacity-50 cursor-wait",
          className,
        )}
      >
        {effectiveIsSubscribed ? (
          <Check size={16} className="relative shrink-0 z-10" strokeWidth={1.8} />
        ) : (
          <Bell size={16} className="relative shrink-0 z-10" />
        )}
        <span className="relative leading-none z-10">{effectiveIsSubscribed ? (t.subscribed || "Subskrajbd") : (t.subscribe || "Subskrajb")}</span>
      </motion.button>
      {effectiveIsSubscribed && (
        <button
          type="button"
          onClick={toggleNotify}
          disabled={bellPending}
          aria-pressed={notify}
          aria-label={bellLabel}
          title={bellLabel}
          className={cn(
            "h-9 w-9 shrink-0 flex items-center justify-center rounded-full border border-[var(--cm-ink-14-line)] bg-[var(--cm-card-58-white)] text-[var(--chan-ink)] transition-colors hover:border-[var(--cm-blue-38-line)] hover:bg-[var(--cm-card-72-white)]",
            bellPending && "opacity-50 cursor-wait",
          )}
        >
          {notify ? <BellRing size={16} strokeWidth={1.8} /> : <BellOff size={16} strokeWidth={1.8} />}
        </button>
      )}
      </div>
      {errorMessage && (
        <div className="mt-2 max-w-[280px] flex flex-col gap-1">
          <p
            className="text-xs font-medium text-red-600"
            role="alert"
          >
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={() => { setErrorMessage(null); executeSubscribe(); }}
            className="text-xs font-bold text-primary underline hover:opacity-70 text-left"
          >
            {tx("Spróbuj ponownie", "Try again")}
          </button>
        </div>
      )}

      <EmailSubscriptionConsentModal
        open={showConfirm}
        pending={isPending}
        onConfirm={() => {
          setShowConfirm(false);
          executeSubscribe();
        }}
        onDismiss={() => setShowConfirm(false)}
      />
    </>
  );
}
