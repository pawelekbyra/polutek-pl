"use client";

import React, { useState, useEffect, useRef, useTransition } from 'react';
import { useAuth, useUser } from "@/lib/auth/react";
import { logger } from '@/lib/logger';
import EmailSubscriptionConsentModal from './EmailSubscriptionConsentModal';
import { useLanguage } from '../LanguageContext';

// How long after account creation we still consider this the user's "first
// login after registration" — the only automatic (non-button-click) trigger
// for this modal, so it doesn't nag returning users on every page load.
const FRESH_REGISTRATION_WINDOW_MS = 10 * 60 * 1000;

export default function UnsubscribedEmailConsentPrompt() {
  const { userId, isLoaded } = useAuth();
  const { user } = useUser();
  const { tx } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasCheckedStatus, setHasCheckedStatus] = useState(false);

  // First Google sign-in: the nickname dialog (OnboardingDialog) must be finished before this
  // prompt opens, otherwise the two overlap. Remember that onboarding happened in this session,
  // so the "fresh registration" window below is not missed when picking a nickname takes a while.
  const onboardingPending = Boolean(user?.onboardingPending);
  const sawOnboarding = useRef(false);
  useEffect(() => {
    if (onboardingPending) sawOnboarding.current = true;
  }, [onboardingPending]);

  const DISMISSED_KEY = userId ? `polutek:email-consent-prompt-dismissed:${userId}` : null;

  // The home page's entry gate (z-index above any dialog) covers the site right after sign-in.
  // Opening under it made the gate's own click count as a click outside the dialog, which
  // dismissed it unseen. Wait until the gate is gone.
  const [gateGone, setGateGone] = useState(false);
  useEffect(() => {
    // Also never on /sso-callback: that page redirects right after sign-up, which closed the
    // dialog a split second after it opened and still counted it as "shown".
    const check = () =>
      !window.location.pathname.startsWith('/sso-callback') &&
      !document.querySelector('[data-testid="site-preloader"]');
    if (check()) {
      setGateGone(true);
      return;
    }
    const timer = window.setInterval(() => {
      if (check()) {
        setGateGone(true);
        window.clearInterval(timer);
      }
    }, 300);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    // user (with createdAt) must be loaded too, or a fresh sign-up would be judged "not fresh".
    if (isLoaded && userId && user && gateGone && !onboardingPending && !hasCheckedStatus) {
      const isDismissed = DISMISSED_KEY ? localStorage.getItem(DISMISSED_KEY) === 'true' : false;

      const isFreshRegistration = sawOnboarding.current || Boolean(
        user?.createdAt &&
        Date.now() - new Date(user.createdAt).getTime() < FRESH_REGISTRATION_WINDOW_MS
      );

      if (isDismissed || !isFreshRegistration) {
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
          if (data && !data.isSubscribed) {
            setIsOpen(true);
            // Mark as shown immediately (not only on explicit confirm/dismiss) so
            // abandoning the page without answering still counts as "shown once".
            if (DISMISSED_KEY) localStorage.setItem(DISMISSED_KEY, 'true');
          }
          setHasCheckedStatus(true);
        })
        .catch((err) => {
          logger.warn('[EMAIL_CONSENT_PROMPT_FETCH_ERROR]', err);
          setHasCheckedStatus(true);
        });
    }
  }, [isLoaded, userId, user, gateGone, onboardingPending, hasCheckedStatus, DISMISSED_KEY]);

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
            response.status === 401 ? tx("Zaloguj się, aby zarządzać powiadomieniami.", "Sign in to manage notifications.") :
            response.status === 400 && code === "TRUSTED_EMAIL_REQUIRED" ? tx("Konto musi mieć zweryfikowany adres e-mail.", "The account needs a verified email address.") :
            response.status === 409 && code === "EMAIL_PREFERENCE_IDENTITY_CONFLICT" ? tx("Ten adres e-mail jest już przypisany do innego konta.", "This email address is already linked to another account.") :
            response.status === 429 ? tx("Zbyt wiele prób. Spróbuj ponownie później.", "Too many attempts. Please try again later.") :
            result.message || tx("Nie udało się zapisać subskrypcji. Spróbuj ponownie.", "Could not save the subscription. Please try again.");
          setErrorMessage(message);
          return;
        }

        setIsOpen(false);
        if (DISMISSED_KEY) {
          localStorage.setItem(DISMISSED_KEY, 'true');
        }
      } catch (err) {
        logger.warn("[EMAIL_CONSENT_PROMPT_POST_ERROR]", err);
        setErrorMessage(tx("Nie udało się połączyć z serwerem. Spróbuj ponownie.", "Could not reach the server. Please try again."));
      }
    });
  };

  const handleDismiss = () => {
    setIsOpen(false);
    if (DISMISSED_KEY) {
      localStorage.setItem(DISMISSED_KEY, 'true');
    }
  };

  if (!isLoaded || !userId || !isOpen || onboardingPending) return null;

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
