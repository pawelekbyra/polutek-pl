"use client";

import React, { useState, useEffect, useTransition } from "react";
import { motion } from "framer-motion";
import { useAuth, useClerk } from "@clerk/nextjs";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { useLanguage } from "./LanguageContext";
import EmailSubscriptionConsentModal from "./subscriptions/EmailSubscriptionConsentModal";
import { Frame, INK, BLUE } from "./najs/primitives";

interface SubscribeButtonProps {
  creatorId?: string;
  creatorSlug?: string | null;
  creatorName?: string | null;
  initialSubscribersCount?: number;
  initialIsSubscribed?: boolean;
  className?: string;
  variant?: "default" | "compact";
  colorScheme?: "default" | "v2";
  gold?: boolean;
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
    className={className}
    aria-hidden="true"
  >
    <path
      d="M7.2 10.8c.15-3.2 1.9-5.35 4.8-5.35s4.65 2.15 4.8 5.35c.12 2.55.78 3.85 1.75 5.05.32.4.05 1-.46 1H5.91c-.51 0-.78-.6-.46-1 .97-1.2 1.63-2.5 1.75-5.05Z"
      fill={filled ? "currentColor" : "rgba(255,255,255,0.16)"}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.75 19.05c.52.6 1.3.95 2.25.95s1.73-.35 2.25-.95"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <path
      d="M10.25 4.7c.42-.55 1-.85 1.75-.85s1.33.3 1.75.85"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <path
      d="M5.4 8.9c-.62.56-1 1.28-1.15 2.16M18.6 8.9c.62.56 1 1.28 1.15 2.16"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      opacity="0.75"
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
  colorScheme = "default",
  gold = false,
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

  const isGoldActive = gold && !isSubscribed;

  return (
    <>
      {isGoldActive && (
        <style>{`
          @keyframes goldShimmer {
            0%   { background-position: 200% center; }
            100% { background-position: -200% center; }
          }
          .gold-btn {
            background: linear-gradient(105deg,
              #FFEA00 0%,
              #FFEA00 36%,
              #fff783 50%,
              #FFEA00 64%,
              #e5c900 100%
            );
            background-size: 250% 100%;
            animation: goldShimmer 4s linear infinite;
            box-shadow:
              0 2px 22px rgba(212,160,32,0.45),
              0 1px 0 rgba(255,240,140,0.35) inset,
              0 -1px 0 rgba(60,30,0,0.3) inset;
          }
          .gold-btn:hover {
            box-shadow:
              0 4px 32px rgba(212,160,32,0.65),
              0 1px 0 rgba(255,240,140,0.5) inset,
              0 -1px 0 rgba(60,30,0,0.3) inset;
          }
        `}</style>
      )}
      <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleSubscribe}
        disabled={isPending}
        className={cn(
          "relative text-[13.5px] font-bold h-[38px] px-[20px] flex items-center justify-center transition-all active:scale-95",
          isSubscribed
            ? "text-[#171717]"
            : isGoldActive
              ? "text-[#2d1400]"
              : "text-white",
          isGoldActive && "gold-btn",
          isPending && "opacity-50 cursor-wait",
          className,
        )}
        style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}
      >
        <Frame
          radius={20}
          seed={37}
          stroke={isGoldActive ? "#b8860b" : INK}
          strokeWidth={isGoldActive ? 1.6 : 1.2}
          fill={
            isGoldActive
              ? "transparent"
              : isSubscribed
                ? "rgba(248,243,231,.88)"
                : colorScheme === "v2"
                  ? BLUE
                  : "#171717"
          }
          showShadow={colorScheme === "v2" || isGoldActive}
        />
        <span className="relative inline-flex items-center justify-center gap-1.5 leading-none">
          <SubscribeBellIcon
            size={16}
            className="shrink-0 translate-y-[-0.5px]"
            filled={isSubscribed}
          />
          <span className="leading-none">
            {isSubscribed
              ? t.subscribed || "Subskrybujesz"
              : t.subscribe || "Subskrybuj"}
          </span>
        </span>
      </motion.button>
      {errorMessage && (
        <div className="mt-2 max-w-[280px] flex flex-col gap-1">
          <p className="text-xs font-medium text-red-600" role="alert">
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              executeSubscribe();
            }}
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
