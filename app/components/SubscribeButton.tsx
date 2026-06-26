"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { useLanguage } from './LanguageContext';
import { BellSimple } from './icons';
import EmailSubscriptionConsentModal from './subscriptions/EmailSubscriptionConsentModal';
import { motion } from 'motion/react';

interface SubscribeButtonProps {
  creatorId?: string;
  creatorSlug?: string | null;
  creatorName?: string | null;
  initialSubscribersCount?: number;
  initialIsSubscribed?: boolean;
  className?: string;
  variant?: 'default' | 'compact';
  onStatusChange?: (isSubscribed: boolean, subscribersCount?: number) => void;
}

export default function SubscribeButton({
  creatorId,
  creatorSlug,
  creatorName,
  initialSubscribersCount,
  initialIsSubscribed,
  className,
  variant = 'default',
  onStatusChange,
}: SubscribeButtonProps) {
  const { t } = useLanguage();
  const { userId } = useAuth();
  const { openSignIn } = useClerk();
  const [isSubscribed, setIsSubscribed] = useState(initialIsSubscribed ?? false);
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
          if (!response.ok) throw new Error(`Subscription status failed: ${response.status}`);
          return response.json() as Promise<{ isSubscribed: boolean }>;
        })
        .then(data => {
            setIsSubscribed(data.isSubscribed);
        })
        .catch(err => logger.warn("[SUBSCRIPTION_STATUS_FETCH_ERROR]", err));
    }
  }, [userId, creatorId, creatorSlug, initialIsSubscribed]);

  useEffect(() => {
    if (!userId && mounted) setIsSubscribed(false);
  }, [userId, mounted]);

  const handleSubscribe = async () => {
    if (!userId) { openSignIn(); return; }
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
        const response = await fetch('/api/subscriptions', {
          method: nextState ? 'POST' : 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });

        const result = await response.json().catch(() => ({})) as { isSubscribed: boolean, subscribersCount: number, error?: string, message?: string };
        if (!response.ok) {
          const code = result.error;
          const message =
            response.status === 401 ? "Zaloguj się, aby zarządzać powiadomieniami." :
            response.status === 400 && code === "TRUSTED_EMAIL_REQUIRED" ? "Konto musi mieć zweryfikowany adres e-mail." :
            response.status === 409 && code === "EMAIL_PREFERENCE_IDENTITY_CONFLICT" ? "Ten adres e-mail jest już przypisany do innego konta." :
            response.status === 429 ? "Zbyt wiele prób. Spróbuj ponownie później." :
            result.message || "Nie udało się zapisać subskrypcji. Spróbuj ponownie.";
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
          "text-xs font-bold rounded-full px-6 h-9 flex items-center justify-center transition-all uppercase tracking-widest sm:min-w-[154px] border active:scale-95",
          isSubscribed
            ? "bg-neutral-100 text-neutral-600 border-neutral-400"
            : "bg-charcoal text-white border-charcoal hover:bg-black",
          isPending && "opacity-50 cursor-wait",
          className
        )}
      >
        {!isSubscribed && <BellSimple size={16} className="mr-2" />}
        <span>{isSubscribed ? t.subscribed : t.subscribe}</span>
      </motion.button>
      {errorMessage && (
        <p className="mt-2 max-w-[260px] text-xs font-medium text-red-600" role="alert">
          {errorMessage}
        </p>
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
