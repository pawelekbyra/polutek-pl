"use client";

import React, { useEffect, useState } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';
import { Bell, BellOff, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { useLanguage } from './LanguageContext';

type SubscribeButtonProps = {
  creatorId?: string | null;
  creatorSlug?: string | null;
  creatorName?: string | null;
  initialSubscribed?: boolean;
  variant?: 'default' | 'compact';
};

type SubscriptionResponse = {
  isSubscribed?: boolean;
  error?: string;
  message?: string;
};

export default function SubscribeButton({
  creatorId,
  creatorSlug,
  creatorName,
  initialSubscribed = false,
  variant = 'default',
}: SubscribeButtonProps) {
  const { userId, isLoaded } = useAuth();
  const { openSignIn } = useClerk();
  const { language } = useLanguage();
  const [isSubscribed, setIsSubscribed] = useState(initialSubscribed);
  const [isBusy, setIsBusy] = useState(false);
  const [isConsentOpen, setIsConsentOpen] = useState(false);
  const [isUnsubscribeOpen, setIsUnsubscribeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labels = language === 'pl'
    ? {
        subscribe: 'Subskrybuj',
        subscribed: 'Subskrybowano',
        loading: 'Zapisywanie...',
        consentTitle: 'Subskrypcja kanału',
        consentDescription: 'Subskrybując, zgadzasz się na otrzymywanie maili z nowościami z tego kanału. To nie daje dostępu Patron.',
        unsubscribeTitle: 'Wyłączyć powiadomienia?',
        unsubscribeDescription: 'Przestaniesz otrzymywać mailowe powiadomienia o nowościach z tego kanału. Status Patron, jeśli go masz, pozostaje bez zmian.',
        confirmSubscribe: 'Włącz powiadomienia',
        confirmUnsubscribe: 'Wyłącz powiadomienia',
        cancel: 'Anuluj',
        signInRequired: 'Zaloguj się, aby subskrybować powiadomienia mailowe.',
        genericError: 'Nie udało się zmienić subskrypcji. Spróbuj ponownie.',
      }
    : {
        subscribe: 'Subscribe',
        subscribed: 'Subscribed',
        loading: 'Saving...',
        consentTitle: 'Channel subscription',
        consentDescription: 'By subscribing, you agree to receive email updates from this channel. This does not grant Patron access.',
        unsubscribeTitle: 'Turn off notifications?',
        unsubscribeDescription: 'You will stop receiving email updates from this channel. Your Patron status, if any, is unchanged.',
        confirmSubscribe: 'Enable notifications',
        confirmUnsubscribe: 'Disable notifications',
        cancel: 'Cancel',
        signInRequired: 'Sign in to subscribe to email notifications.',
        genericError: 'Could not update this subscription. Please try again.',
      };

  const creatorLabel = creatorName || creatorSlug || (language === 'pl' ? 'ten kanał' : 'this channel');
  const hasCreatorRef = Boolean(creatorId || creatorSlug);

  useEffect(() => {
    setIsSubscribed(initialSubscribed);
  }, [initialSubscribed, creatorId, creatorSlug]);

  useEffect(() => {
    if (!isLoaded || !userId || !hasCreatorRef) return;

    const controller = new AbortController();
    const params = new URLSearchParams();
    if (creatorId) params.set('creatorId', creatorId);
    else if (creatorSlug) params.set('creatorSlug', creatorSlug);

    fetch(`/api/subscriptions?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) return null;
        const data = await response.json() as SubscriptionResponse;
        if (!response.ok) throw new Error(data.message || data.error || 'SUBSCRIPTION_STATUS_ERROR');
        return data;
      })
      .then((data) => {
        if (data && typeof data.isSubscribed === 'boolean') {
          setIsSubscribed(data.isSubscribed);
        }
      })
      .catch((fetchError) => {
        if ((fetchError as Error).name !== 'AbortError') {
          logger.error('[SubscribeButton] Failed to fetch subscription status', fetchError);
        }
      });

    return () => controller.abort();
  }, [creatorId, creatorSlug, hasCreatorRef, isLoaded, userId]);

  const requestSubscriptionChange = async (method: 'POST' | 'DELETE') => {
    if (!hasCreatorRef) return;

    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/subscriptions', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, creatorSlug }),
      });
      const data = await response.json() as SubscriptionResponse;

      if (!response.ok) {
        throw new Error(data.message || data.error || labels.genericError);
      }

      setIsSubscribed(data.isSubscribed === true);
      setIsConsentOpen(false);
      setIsUnsubscribeOpen(false);
    } catch (changeError) {
      logger.error('[SubscribeButton] Failed to update subscription', changeError);
      setError(changeError instanceof Error ? changeError.message : labels.genericError);
    } finally {
      setIsBusy(false);
    }
  };

  const handleClick = () => {
    setError(null);

    if (!userId) {
      openSignIn();
      return;
    }

    if (!hasCreatorRef || isBusy) return;

    if (isSubscribed) {
      setIsUnsubscribeOpen(true);
    } else {
      setIsConsentOpen(true);
    }
  };

  const buttonText = isBusy ? labels.loading : (isSubscribed ? labels.subscribed : labels.subscribe);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={!hasCreatorRef || isBusy}
        aria-pressed={isSubscribed}
        title={!userId ? labels.signInRequired : undefined}
        className={cn(
          'inline-flex h-9 items-center justify-center gap-2 rounded-full border px-4 text-[13px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
          isSubscribed
            ? 'border-neutral-300 bg-neutral-100 text-neutral-900 hover:bg-neutral-200'
            : 'border-[#0f0f0f] bg-[#0f0f0f] text-white hover:bg-[#272727]',
          variant === 'compact' && 'h-8 px-3 text-[11px]'
        )}
      >
        {isSubscribed ? <Check size={16} /> : <Bell size={16} />}
        <span>{buttonText}</span>
      </button>

      <Dialog open={isConsentOpen} onOpenChange={setIsConsentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{labels.consentTitle}</DialogTitle>
            <DialogDescription>
              {labels.consentDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
            <strong className="text-neutral-950">{creatorLabel}</strong>
            <p className="mt-1">{labels.consentDescription}</p>
          </div>
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsConsentOpen(false)} disabled={isBusy}>
              {labels.cancel}
            </Button>
            <Button type="button" onClick={() => requestSubscriptionChange('POST')} disabled={isBusy}>
              <Bell size={16} />
              {labels.confirmSubscribe}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isUnsubscribeOpen} onOpenChange={setIsUnsubscribeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{labels.unsubscribeTitle}</DialogTitle>
            <DialogDescription>
              {labels.unsubscribeDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
            <strong className="text-neutral-950">{creatorLabel}</strong>
            <p className="mt-1">{labels.unsubscribeDescription}</p>
          </div>
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsUnsubscribeOpen(false)} disabled={isBusy}>
              {labels.cancel}
            </Button>
            <Button type="button" variant="destructive" onClick={() => requestSubscriptionChange('DELETE')} disabled={isBusy}>
              <BellOff size={16} />
              {labels.confirmUnsubscribe}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
