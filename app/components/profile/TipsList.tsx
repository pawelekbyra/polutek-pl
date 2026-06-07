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
      <div className="p-12 text-center space-y-6 bg-red-50 rounded-[2.5rem] border-2 border-dashed border-red-100">
        <div className="space-y-2">
          <h3 className="text-2xl font-black uppercase tracking-tight text-red-600">{error}</h3>
          <button
            onClick={fetchTips}
            className="mt-4 flex items-center gap-2 mx-auto px-6 py-2 bg-white hover:bg-neutral-50 rounded-full text-sm font-bold uppercase tracking-widest transition-all border border-red-100 text-red-600"
          >
            <RefreshCcw size={16} />
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }

  if (tips.length === 0) {
    return (
      <div className="p-12 text-center space-y-6 bg-[#1a1a1a]/5 rounded-[2.5rem] border-2 border-dashed border-[#1a1a1a]/10">
        <div className="flex justify-center">
           <Coins size={48} className="text-[#1a1a1a]/20" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black uppercase tracking-tight text-[#1a1a1a]">Brak wpłat</h3>
          <p className="text-[#1a1a1a]/50 font-serif italic text-lg leading-relaxed">Nie masz jeszcze żadnych zarejestrowanych wpłat w naszym serwisie.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-serif">
      <div className="grid grid-cols-1 gap-4">
        {tips.map((tip) => (
          <div key={tip.id} className="bg-white border-2 border-[#1a1a1a]/5 rounded-xl p-6 flex justify-between items-center shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center gap-6">
               <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Coins size={24} />
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#1a1a1a]/30 mb-1 italic">
                    {mounted ? format(new Date(tip.createdAt), 'd MMMM yyyy, HH:mm', { locale: pl }) : ''}
                  </p>
                  <h4 className="text-xl font-black text-[#1a1a1a] uppercase tracking-tight">
                    {tip.creator?.name ? `Dla: ${tip.creator.name}` : 'Wsparcie Projektu'}
                  </h4>
                  {tip.status !== 'SUCCEEDED' && (
                    <span className="text-[9px] font-black uppercase bg-red-100 text-red-600 px-2 py-0.5 rounded">
                      {tip.status === 'REFUNDED' ? 'Zwrócono' : 'Częściowy zwrot'}
                    </span>
                  )}
               </div>
            </div>
            <div className="text-right">
               <span className="text-2xl font-black text-primary">
                  {mounted ? (tip.amountMinor / 100).toLocaleString('pl-PL', { style: 'currency', currency: tip.currency }) : ''}
               </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
