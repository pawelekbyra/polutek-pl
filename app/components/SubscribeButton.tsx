"use client";

import React, { useState, useEffect, useTransition } from "react";
import { motion } from "framer-motion";
import { useAuth, useClerk } from "@clerk/nextjs";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { useLanguage } from "./LanguageContext";
import EmailSubscriptionConsentModal from "./subscriptions/EmailSubscriptionConsentModal";

interface SubscribeButtonProps {
  creatorId?: string;
  creatorSlug?: string | null;
  creatorName?: string | null;
  initialSubscribersCount?: number;
  initialIsSubscribed?: boolean;
  className?: string;
  variant?: "default" | "compact";
  onStatusChange?: (isSubscribed: boolean, subscribersCount?: number) => void;
}

const SubscribeBellIcon = ({
  size = 16,
  filled = false,
  className,
}: {
  size?: number;
  filled?: boolean;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("najs-pen-icon", className)}
    aria-hidden="true"
  >
    {filled && (
      <path
        d="M6.4 16.7c.35-1.1 1.25-2.3 1.25-6.35 0-3.55 1.78-5.45 4.35-5.45s4.35 1.9 4.35 5.45c0 4.05.9 5.25 1.25 6.35H6.4Z"
        fill="currentColor"
        opacity="0.12"
      />
    )}
    <path
      d="M6.25 16.75c.46-.62 1.42-1.76 1.42-6.18 0-3.68 1.75-5.6 4.33-5.6 2.63 0 4.35 1.92 4.35 5.6 0 4.42.97 5.56 1.43 6.18.19.26.02.66-.33.66H6.58c-.35 0-.53-.4-.33-.66Z"
      stroke="currentColor"
      strokeWidth="1.65"
    />
    <path
      d="M9.78 19.25c.43.57 1.2.91 2.22.91 1.01 0 1.78-.34 2.22-.91"
      stroke="currentColor"
      strokeWidth="1.65"
    />
    <path
      d="M11.93 4.96c-.03-.7.18-1.24.55-1.37.46-.16.88.32.91 1.08"
      stroke="currentColor"
      strokeWidth="1.65"
    />
  </svg>
);

export default function SubscribeButton({
  creatorId,
  creatorSlug,
  creatorName,
  initialSubscribersCount,
  initialIsSubscribed,
  className,
  variant = "default",
  onStatusChange,
}: SubscribeButtonProps) {
  const { t, language } = useLanguage();
  const { userId } = useAuth();
  const { openSignIn } = useClerk();
  const [isSubscribed, setIsSubscribed] = useState(
    initialIsSubscribed ?? false,
  );
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync with prop if it changes
  useEffect(() => {
    if (initialIsSubscribed !== undefined) {
      setIsSubscribed(initialIsSubscribed);
    }
  }, [initialIsSubscribed]);

  // Fetch status if not provided
  useEffect(() => {
    if (userId && initialIsSubscribed === undefined) {
      fetch(`/api/subscriptions`)
        .then(async (response) => {
          if (!response.ok)
            throw new Error(`Subscription status failed: ${response.status}`);
          return response.json() as Promise<{ isSubscribed: boolean }>;
        })
        .then((data) => {
          setIsSubscribed(data.isSubscribed);
        })
        .catch((err) => logger.warn("[SUBSCRIPTION_STATUS_FETCH_ERROR]", err));
    }
  }, [userId, creatorId, creatorSlug, initialIsSubscribed]);

  useEffect(() => {
    if (!userId && mounted) setIsSubscribed(false);
  }, [userId, mounted]);

  const handleSubscribe = async () => {
    if (!userId) {
      openSignIn();
      return;
    }
    if (isPending) return;

    if (!isSubscribed) {
      setShowConfirm(true);
      return;
    }

    executeSubscribe();
  };

  const executeSubscribe = async () => {
    const nextState = !isSubscribed;
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/subscriptions", {
          method: nextState ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
        });

        const result = (await response.json().catch(() => ({}))) as {
          isSubscribed: boolean;
          subscribersCount: number;
          error?: string;
          message?: string;
        };
        if (!response.ok) {
          const code = result.error;
          const message =
            response.status === 401
              ? "Zaloguj się, aby zarządzać powiadomieniami."
              : response.status === 400 && code === "TRUSTED_EMAIL_REQUIRED"
                ? "Konto musi mieć zweryfikowany adres e-mail."
                : response.status === 409 &&
                    code === "EMAIL_PREFERENCE_IDENTITY_CONFLICT"
                  ? "Ten adres e-mail jest już przypisany do innego konta."
                  : response.status === 429
                    ? "Zbyt wiele prób. Spróbuj ponownie później."
                    : result.message ||
                      "Nie udało się zapisać subskrypcji. Spróbuj ponownie.";
          setErrorMessage(message);
          return;
        }

        setIsSubscribed(result.isSubscribed);
        onStatusChange?.(result.isSubscribed, result.subscribersCount);
      } catch (err) {
        logger.warn("[SUBSCRIPTION_TOGGLE_ERROR]", err);
        setErrorMessage("Nie udało się połączyć z serwerem. Spróbuj ponownie.");
      }
    });
  };

  return (
    <>
      <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleSubscribe}
        disabled={isPending}
        className={cn(
          "najs-action-button text-[13.5px] font-bold rounded-full h-[38px] px-[20px] flex items-center justify-center transition-all active:scale-95 border",
          isSubscribed
            ? "bg-secondary text-[#171717] border-input"
            : "bg-[#171717] text-white border-[#171717]",
          isPending && "opacity-50 cursor-wait",
          className,
        )}
      >
        <SubscribeBellIcon size={17} className="mr-2" filled={isSubscribed} />
        <span>{isSubscribed ? (t.subscribed || "subskrajbd") : (t.subscribe || "Subskrajb")}</span>
      </motion.button>
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
            {language === "pl" ? "Spróbuj ponownie" : "Try again"}
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