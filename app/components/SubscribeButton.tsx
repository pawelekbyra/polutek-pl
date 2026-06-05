"use client";

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import { logger } from '@/lib/logger';
import { useAuth, useClerk } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { toggleSubscriptionAction, getSubscriptionStatusAction } from '@/app/actions/subscription';
import { useLanguage } from './LanguageContext';
import { BellSimple } from './icons';

interface SubscribeButtonProps {
  creatorId: string;
  creatorSlug?: string | null;
  creatorName?: string | null;
  initialIsSubscribed?: boolean;
  className?: string;
  variant?: 'default' | 'compact';
}

type PendingAction = 'subscribe' | 'unsubscribe' | null;

export default function SubscribeButton({
  creatorId,
  initialIsSubscribed,
  className,
  variant = 'default',
}: SubscribeButtonProps) {
  const { t } = useLanguage();
  const { userId } = useAuth();
  const { openSignIn } = useClerk();
  const [isSubscribed, setIsSubscribed] = useState(() => initialIsSubscribed ?? false);
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  useEffect(() => {
    if (initialIsSubscribed !== undefined) {
      setIsSubscribed(initialIsSubscribed);
      return;
    }

    if (!userId) {
      setIsSubscribed(false);
      return;
    }

    let isActive = true;

    getSubscriptionStatusAction(creatorId)
      .then((data) => {
        if (isActive) setIsSubscribed(data.isSubscribed);
      })
      .catch((err) => logger.error("Error fetching subscription status:", err));

    return () => {
      isActive = false;
    };
  }, [userId, creatorId, initialIsSubscribed]);

  const modalCopy = useMemo(() => {
    if (pendingAction === 'unsubscribe') {
      return {
        title: t.confirmUnsubscribeTitle,
        text: t.confirmUnsubscribeText,
        confirmLabel: t.yes,
        cancelLabel: t.no,
      };
    }

    return {
      title: t.confirmSubscribeTitle,
      text: t.confirmSubscribeText,
      confirmLabel: t.yes,
      cancelLabel: t.no,
    };
  }, [pendingAction, t]);

  const handleSubscribe = async () => {
    if (!userId) { openSignIn(); return; }
    if (!creatorId || isPending) return;

    setPendingAction(isSubscribed ? 'unsubscribe' : 'subscribe');
  };

  const executeSubscribe = async () => {
    if (!pendingAction) return;

    const prevSubscribed = isSubscribed;
    setPendingAction(null);
    setIsSubscribed(!prevSubscribed);

    startTransition(async () => {
      try {
        const result = await toggleSubscriptionAction(creatorId) as { success: boolean; error?: string; message?: string };
        if (result.error) setIsSubscribed(prevSubscribed);
      } catch (err) {
        setIsSubscribed(prevSubscribed);
      }
    });
  };

  const closeModal = () => setPendingAction(null);

  return (
    <>
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={isPending}
        className={cn(
          "inline-flex items-center justify-center rounded-full border font-brand text-xs font-bold uppercase tracking-widest transition-all active:scale-95",
          variant === 'compact' ? "h-9 px-5 sm:min-w-[136px]" : "h-10 px-7 sm:min-w-[154px]",
          isSubscribed
            ? "border-neutral-400 bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            : "border-charcoal bg-charcoal text-white shadow-brutalist-sm hover:-translate-y-0.5 hover:bg-black hover:shadow-brutalist",
          isPending && "cursor-wait opacity-50 hover:translate-y-0 hover:shadow-brutalist-sm",
          className
        )}
      >
        {!isSubscribed && <BellSimple size={16} className="mr-2" />}
        <span>{isSubscribed ? t.subscribed : t.subscribe}</span>
      </button>

      {pendingAction && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-300"
          role="presentation"
          onClick={closeModal}
        >
          <div
            aria-modal="true"
            role="dialog"
            aria-labelledby="subscription-confirm-title"
            aria-describedby="subscription-confirm-description"
            className="w-full max-w-sm rounded-xl border border-neutral-300 bg-white p-8 font-sans shadow-lg animate-in zoom-in-95 duration-300"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="subscription-confirm-title" className="mb-2 font-heading text-xl font-bold tracking-tight text-neutral-900">
              {modalCopy.title}
            </h3>
            <p id="subscription-confirm-description" className="mb-8 text-sm leading-6 text-neutral-500">
              {modalCopy.text}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={executeSubscribe}
                className="rounded-md bg-charcoal py-2 font-brand text-sm font-semibold uppercase tracking-wide text-white transition-all hover:bg-neutral-800"
              >
                {modalCopy.confirmLabel}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-neutral-300 bg-white py-2 font-brand text-sm font-semibold uppercase tracking-wide text-neutral-900 transition-all hover:bg-neutral-50"
              >
                {modalCopy.cancelLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
