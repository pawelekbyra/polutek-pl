"use client";

import React, { useState, useEffect } from 'react';
import { useLanguage } from './LanguageContext';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import CheckoutForm from './CheckoutForm';
import { Loader2, ArrowRight, Check } from './icons';
import { useAuth, useClerk } from '@clerk/nextjs';
import { cn } from '@/lib/utils';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

const VideoPlaylist = ({
  videos = [],
  currentVideoId,
  onVideoSelect,
  videoTitle,
  creatorId
}: any) => {
  const { language, t } = useLanguage();
  const { userId } = useAuth();
  const { openSignIn } = useClerk();

  const [selectedAmount, setSelectedAmount] = useState<number | ''>(20);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setIsSuccess(true);
    }
  }, []);

  const handleSupport = async (amount: number) => {
    if (!userId) {
      alert(language === 'pl' ? "Zaloguj się, aby wesprzeć projekt." : "Please sign in to support the project.");
      openSignIn();
      return;
    }

    try {
      setIsLoading(true);
      setSelectedAmount(amount);

      const response = await fetch('/api/checkout/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Number(amount),
            currency: 'pln',
            title: `Napiwek: ${videoTitle || 'Wsparcie twórcy'}`,
            creatorId: creatorId
          }),
          cache: 'no-store'
      });

      const data = await response.json();

      if (data?.clientSecret) {
        setClientSecret(data.clientSecret);
      } else {
        alert(language === 'pl' ? `Błąd: ${data.message || data.error}` : `Error: ${data.message || data.error}`);
      }
    } catch (error) {
      console.error("Payment error", error);
      alert("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // If videoTitle is present, show Tipping Gateway
  if (videoTitle) {
    if (isSuccess) {
      return (
          <div className="bg-white border border-neutral-200 rounded-xl p-8 shadow-md mb-6 text-center space-y-6 animate-in zoom-in-95 duration-500">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
                  <Check size={24} className="text-white" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight">Dziękujemy!</h3>
              <p className="text-sm text-neutral-500 leading-relaxed italic">Twoja wpłata została pomyślnie przetworzona. Twoje wsparcie pozwala nam tworzyć więcej treści!</p>
              <button
                onClick={() => {
                    setIsSuccess(false);
                    const url = new URL(window.location.href);
                    url.searchParams.delete('success');
                    window.history.replaceState({}, '', url.toString());
                }}
                className="w-full bg-charcoal text-white py-3 rounded-full font-bold text-xs uppercase tracking-widest transition-all hover:bg-black active:scale-95"
              >
                Zamknij
              </button>
          </div>
      );
    }

    if (clientSecret) {
        return (
            <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-md mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold tracking-tight">Dokończ wpłatę</h2>
                    <button
                        onClick={() => setClientSecret(null)}
                        className="w-8 h-8 border border-neutral-200 rounded-full flex items-center justify-center hover:bg-neutral-50 transition-colors text-xl"
                    >
                        ×
                    </button>
                </div>
                <div className="bg-neutral-50 rounded-lg p-5 mb-8 border border-neutral-200">
                    <div className="flex justify-between items-baseline">
                        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Kwota wsparcia:</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold tracking-tighter">{selectedAmount}</span>
                            <span className="text-sm font-medium text-neutral-400">PLN</span>
                        </div>
                    </div>
                </div>
                <div className="bg-white border border-neutral-200 p-6 shadow-sm rounded-xl">
                    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'flat', variables: { colorPrimary: '#2563eb', colorBackground: '#ffffff', colorText: '#171717', borderRadius: '8px' } } }}>
                        <CheckoutForm returnUrl={`${window.location.origin}${window.location.pathname}?success=true`} />
                    </Elements>
                </div>
            </div>
        );
    }

    return (
      <div className="bg-white border border-neutral-200 p-6 shadow-md rounded-xl space-y-6 animate-in fade-in duration-500">
          <div className="space-y-4">
             <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Wesprzyj Twórcę</p>
             <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tighter text-neutral-900">{selectedAmount || '0'}</span>
                <span className="text-lg font-medium text-neutral-400">PLN</span>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
              {[20, 50, 150, 500].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setSelectedAmount(amt)}
                    className={cn(
                        "py-3 rounded-lg border font-bold text-sm transition-all",
                        selectedAmount === amt
                            ? "bg-blue-600 border-blue-600 text-white shadow-md"
                            : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-blue-600 hover:bg-white"
                    )}
                  >
                      {amt} PLN
                  </button>
              ))}
          </div>

          <div className="space-y-4 pt-4 border-t border-neutral-100">
            <div className="relative group">
                <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                  <span className="text-sm font-semibold text-neutral-400">PLN</span>
                </div>
                <input
                  type="number"
                  min="10"
                  value={selectedAmount}
                  onChange={(e) => setSelectedAmount(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-3 px-4 text-lg font-semibold text-neutral-900 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                  placeholder="10"
                />
            </div>

            <button
              onClick={() => handleSupport(Number(selectedAmount))}
              disabled={isLoading || !selectedAmount || Number(selectedAmount) < 10}
              className="w-full bg-blue-600 text-white py-3 rounded-md font-semibold text-sm uppercase tracking-wider transition-colors hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
            >
              {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'WESPRZYJ PROJEKT'}
            </button>
          </div>
      </div>
    );
  }

  // Standard Playlist view
  return (
    <div className="flex flex-col space-y-3 w-full">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a1a1a] mb-2">
        Kolejne filmy
      </h3>
      
      <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        {videos.map((video: any) => {
          const isActive = video.id === currentVideoId;
          
          return (
            <div
              key={video.id}
              onClick={() => onVideoSelect(video.id)}
              className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                isActive 
                  ? 'bg-slate-100 dark:bg-zinc-800/80 shadow-sm border border-transparent dark:border-white/10' 
                  : 'hover:bg-slate-50 dark:hover:bg-zinc-900/50 border border-transparent'
              }`}
            >
              <div className="relative w-32 h-20 flex-shrink-0 bg-gray-200 dark:bg-zinc-800 rounded-lg overflow-hidden">
                {video.thumbnailUrl && (
                  <img 
                    src={video.thumbnailUrl} 
                    alt={video.title} 
                    className="object-cover w-full h-full"
                    loading="lazy"
                  />
                )}
              </div>
              
              <div className="flex flex-col flex-grow overflow-hidden">
                <h4 className={`text-sm font-medium line-clamp-2 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
                  {video.title}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                  {video.author || 'Autor'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VideoPlaylist;
