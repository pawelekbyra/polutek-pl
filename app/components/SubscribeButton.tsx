"use client";

import React, { useState, useEffect, useTransition } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/nextjs";
import { useAuthModal } from "./auth/AuthModalProvider";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { useLanguage } from "./LanguageContext";
import EmailSubscriptionConsentModal from "./subscriptions/EmailSubscriptionConsentModal";
import { Frame, INK, BLUE } from "./najs/primitives";
import { Rocket } from "lucide-react";

export type SubscribeButtonColorScheme = "default" | "v2" | "flat";

interface SubscribeButtonProps {
  creatorId?: string;
  creatorSlug?: string | null;
  creatorName?: string | null;
  initialSubscribersCount?: number;
  initialIsSubscribed?: boolean;
  className?: string;
  variant?: "default" | "compact";
  colorScheme?: SubscribeButtonColorScheme;
  onStatusChange?: (isSubscribed: boolean, subscribersCount?: number) => void;
}

export default function SubscribeButton({
  creatorId,
  creatorSlug,
  creatorName,
  initialSubscribersCount,
  initialIsSubscribed,
  className,
  variant = "default",
  colorScheme = "default",
  onStatusChange,
}: SubscribeButtonProps) {
  const { t, language } = useLanguage();
  const { userId } = useAuth();
  const { open: openAuthModal } = useAuthModal();
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
      openAuthModal("sign-in");
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

  const isFlat = colorScheme === "flat";

  return (
    <>
      <motion.button
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleSubscribe}
        disabled={isPending}
        className={cn(
          "relative text-sm font-bold h-10 px-3 flex items-center justify-center gap-1.5 transition-[background-color,box-shadow] duration-160 active:scale-95 rounded-[12px] font-sans text-[var(--chan-ink)] bg-[var(--chan-surface)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.08)]",
          isPending && "opacity-50 cursor-wait",
          className,
        )}
      >
        <span className="relative leading-none z-10">{isSubscribed ? (t.subscribed || "Subskrajbujesz") : (t.subscribe || "Subskrajb")}</span>
        <Rocket size={20} className="relative shrink-0 z-10" fill={isSubscribed ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} />
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