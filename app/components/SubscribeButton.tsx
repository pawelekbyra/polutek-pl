"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { toggleSubscriptionAction, getSubscriptionStatusAction } from '@/app/actions/subscription';
import { useLanguage } from './LanguageContext';
import { BellSimple } from './icons';

interface SubscribeButtonProps {
    creatorId: string;
    initialSubscribersCount: number;
    initialIsSubscribed?: boolean;
    className?: string;
}

export default function SubscribeButton({
    creatorId,
    initialSubscribersCount,
    initialIsSubscribed,
    className
}: SubscribeButtonProps) {
    const { t } = useLanguage();
    const { userId } = useAuth();
    const { openSignIn } = useClerk();
    const [isSubscribed, setIsSubscribed] = useState(() => initialIsSubscribed ?? false);
    const [isPending, startTransition] = useTransition();
    const [mounted, setMounted] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (initialIsSubscribed !== undefined) setIsSubscribed(initialIsSubscribed);
        if (userId && creatorId && initialIsSubscribed === undefined) {
            getSubscriptionStatusAction(creatorId)
                .then(data => setIsSubscribed(data.isSubscribed))
                .catch(err => console.error("Error fetching subscription status:", err));
        }
        if (!userId && mounted) setIsSubscribed(false);
    }, [userId, creatorId, initialIsSubscribed, mounted]);

    const handleSubscribe = async () => {
        if (!userId) { openSignIn(); return; }
        if (!creatorId || isPending) return;
        if (!isSubscribed) { setShowConfirm(true); return; }
        executeSubscribe();
    };

    const executeSubscribe = async () => {
        const prevSubscribed = isSubscribed;
        setIsSubscribed(!prevSubscribed);
        startTransition(async () => {
            try {
                const result = await toggleSubscriptionAction(creatorId) as any;
                if (result.error) setIsSubscribed(prevSubscribed);
            } catch (err) {
                setIsSubscribed(prevSubscribed);
            }
        });
    };

    return (
        <>
        <button
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
        </button>

        {showConfirm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white border border-neutral-300 p-8 max-w-sm w-full rounded-xl shadow-lg animate-in zoom-in-95 duration-300">
                    <h3 className="text-xl font-bold text-neutral-900 tracking-tight mb-2">{t.confirmSubscribeTitle}</h3>
                    <p className="text-sm text-neutral-500 mb-8">{t.confirmSubscribeText}</p>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => { setShowConfirm(false); executeSubscribe(); }} className="bg-charcoal text-white py-2 rounded-md font-semibold text-sm hover:bg-neutral-800 transition-all">{t.yes}</button>
                        <button onClick={() => setShowConfirm(false)} className="bg-white border border-neutral-300 text-neutral-900 py-2 rounded-md font-semibold text-sm hover:bg-neutral-50 transition-all">{t.no}</button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
