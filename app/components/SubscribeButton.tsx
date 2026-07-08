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

// Hand-drawn bell in the same "najs" sketch style as the like/share/download icons
// (app/components/najs/primitives.tsx). Uses the shared bell silhouette so the subscribe
// control matches the rest of the UI; fills the body when the viewer is subscribed.
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
    {/* The bell glyph's visible ink sits lower than the 24x24 viewBox's geometric
        center, so it reads as vertically offset next to the button label — nudge
        it up by 1 unit to optically re-center it on the same axis as the text. */}
    <g transform="translate(0,-1)">
      <path
        d="M7 10 c0 -4 2 -6 5 -6 s5 2 5 6 v4 l2 3 H5 l2 -3 Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 20 c1.3 1 2.7 1 4 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
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
          "relative text-[13px] font-bold h-[38px] px-[18px] flex items-center justify-center gap-2 transition-all active:scale-95",
          isFlat
            ? cn(
                "rounded-[12px] font-sans overflow-hidden",
                "before:absolute before:inset-0 before:rounded-[12px]",
                "before:border before:border-white/[0.12] before:pointer-events-none",
                "before:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_20px_rgba(255,255,255,0.04)]",
                "before:backdrop-blur-xl before:transition-all before:duration-300",
                "hover:before:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_0_30px_rgba(255,255,255,0.12)]",
                "hover:before:border-white/[0.2]",
                "focus-visible:before:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_40px_rgba(255,255,255,0.16)]",
                isSubscribed
                  ? "bg-gradient-to-br from-[var(--chan-surface)]/95 to-[var(--chan-surface)]/85 text-[var(--chan-ink)]"
                  : "bg-gradient-to-br from-black/95 to-black/85 text-white shadow-[0_0_24px_rgba(0,0,0,0.4)]",
                "hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
              )
            : cn(isSubscribed ? "text-[#171717]" : "text-white"),
          isPending && "opacity-50 cursor-wait",
          className,
        )}
        style={isFlat ? undefined : { fontFamily: "var(--font-najs, Kalam, cursive)" }}
      >
        {!isFlat && (
          <Frame
            radius={20}
            seed={37}
            stroke={INK}
            strokeWidth={1.2}
            fill={isSubscribed ? "rgba(248,243,231,.88)" : BLUE}
            showShadow={colorScheme === "v2"}
          />
        )}
        <SubscribeBellIcon size={16} className="relative shrink-0 z-10" filled={isSubscribed} />
        <span className="relative leading-none z-10">{isSubscribed ? (t.subscribed || "Subskrajbujesz") : (t.subscribe || "Subskrajb")}</span>
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