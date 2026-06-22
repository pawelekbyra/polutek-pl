"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { useAuth } from '@clerk/nextjs';
import { logger } from '@/lib/logger';
import EmailSubscriptionConsentModal from './EmailSubscriptionConsentModal';

export default function FirstLoginEmailConsentPrompt() {
  const { userId, isLoaded } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [hasCheckedStatus, setHasCheckedStatus] = useState(false);

  const DISMISSED_KEY = userId ? `polutek:first-login-email-consent-dismissed:${userId}` : null;
  const SEEN_KEY = userId ? `polutek:first-login-email-consent-seen:${userId}` : null;

  useEffect(() => {
    if (isLoaded && userId && !hasCheckedStatus) {
      const isDismissed = DISMISSED_KEY ? localStorage.getItem(DISMISSED_KEY) === 'true' : false;

      if (isDismissed) {
        setHasCheckedStatus(true);
        return;
      }

      fetch('/api/subscriptions')
        .then(async (res) => {
          if (res.status === 401) return null;
          if (!res.ok) throw new Error('Failed to fetch subscription status');
          return res.json();
        })
        .then((data) => {
          if (data) {
            setIsSubscribed(data.isSubscribed);
            if (!data.isSubscribed) {
              setIsOpen(true);
              if (SEEN_KEY) localStorage.setItem(SEEN_KEY, 'true');
            }
          }
          setHasCheckedStatus(true);
        })
        .catch((err) => {
          logger.warn('[FIRST_LOGIN_CONSENT_FETCH_ERROR]', err);
          setHasCheckedStatus(true);
        });
    }
  }, [isLoaded, userId, hasCheckedStatus, DISMISSED_KEY, SEEN_KEY]);

  const handleConfirm = () => {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch('/api/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const result = await response.json().catch(() => ({})) as { error?: string, message?: string };

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

        setIsOpen(false);
      } catch (err) {
        logger.warn("[FIRST_LOGIN_CONSENT_POST_ERROR]", err);
        setErrorMessage("Nie udało się połączyć z serwerem. Spróbuj ponownie.");
      }
    });
  };

  const handleDismiss = () => {
    setIsOpen(false);
    if (DISMISSED_KEY) {
      localStorage.setItem(DISMISSED_KEY, 'true');
    }
  };

  if (!isLoaded || !userId || !isOpen) return null;

  return (
    <EmailSubscriptionConsentModal
      open={isOpen}
      pending={isPending}
      errorMessage={errorMessage}
      onConfirm={handleConfirm}
      onDismiss={handleDismiss}
    />
  );
}
