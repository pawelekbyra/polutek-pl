'use client';

import { logger } from "@/lib/logger";
import React, { useEffect, useState } from 'react';
import { getUserTips } from '@/lib/actions/tips';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Loader2, Coins, RefreshCcw } from '../icons';
import { TipsListSkeleton } from '@/components/skeletons';

type TipListItem = {
  id: string;
  createdAt: Date | string;
  amountMinor: number;
  currency: string;
  status: string;
  creator?: { name: string } | null;
};

export default function TipsList() {
  const [tips, setTips] = useState<TipListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const fetchTips = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUserTips();
      setTips(data);
    } catch (error) {
      logger.error("Error fetching tips:", error);
      setError("Nie udało się załadować historii wpłat.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchTips();
  }, []);

  if (isLoading) {
    return <TipsListSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/60 p-10 text-center space-y-4">
        <h3 className="font-brand text-lg font-bold text-red-700">{error}</h3>
        <button
          onClick={fetchTips}
          className="mx-auto flex items-center gap-2 rounded-full border border-red-200 bg-white px-5 py-2 text-[13px] font-bold text-red-600 transition-colors hover:bg-red-50"
        >
          <RefreshCcw size={16} />
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  if (tips.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--cm-line-90)] bg-[var(--chan-surface)] p-12 text-center">
        <div className="flex justify-center">
           <Coins size={40} className="text-[var(--chan-muted)] opacity-50" />
        </div>
        <div className="mt-4 space-y-1.5">
          <h3 className="font-brand text-xl font-bold text-[var(--chan-ink)]">Brak wpłat</h3>
          <p className="mx-auto max-w-sm text-[14px] leading-relaxed text-[var(--chan-muted)]">Nie masz jeszcze żadnych zarejestrowanych wpłat w naszym serwisie.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tips.map((tip) => (
        <div
          key={tip.id}
          className="flex items-center justify-between gap-4 rounded-[18px] border border-[var(--cm-line-80)] bg-[var(--chan-card)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_10px_24px_-18px_rgba(23,23,23,0.18)] transition-shadow hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_14px_30px_-16px_rgba(23,23,23,0.22)]"
        >
          <div className="flex min-w-0 items-center gap-4">
             <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--chan-blue-soft)] text-[var(--chan-blue)]">
                <Coins size={22} />
             </div>
             <div className="min-w-0">
                <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--chan-muted)]">
                  {mounted ? format(new Date(tip.createdAt), 'd MMMM yyyy, HH:mm', { locale: pl }) : ''}
                </p>
                <h4 className="font-sans text-[15px] font-bold text-[var(--chan-ink)]">
                  {tip.creator?.name ? `Dla: ${tip.creator.name}` : 'Wsparcie Projektu'}
                </h4>
                {tip.status !== 'SUCCEEDED' && (
                  <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-600">
                    {tip.status === 'REFUNDED' ? 'Zwrócono' : 'Częściowy zwrot'}
                  </span>
                )}
             </div>
          </div>
          <div className="shrink-0 text-right">
             <span className="font-sans text-lg font-bold tabular-nums text-[var(--chan-ink)]">
                {mounted ? (tip.amountMinor / 100).toLocaleString('pl-PL', { style: 'currency', currency: tip.currency }) : ''}
             </span>
          </div>
        </div>
      ))}
    </div>
  );
}
