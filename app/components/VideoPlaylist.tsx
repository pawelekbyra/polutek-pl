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
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 shadow-sm mb-6 text-center space-y-3 animate-in zoom-in-95 duration-500">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-md">
                  <Check size={20} className="text-white" />
              </div>
              <h3 className="font-bold text-green-900">Dziękujemy za wsparcie!</h3>
              <p className="text-xs text-green-700 leading-relaxed">Twoja wpłata została pomyślnie przetworzona. Twoje wsparcie pozwala nam tworzyć więcej treści!</p>
              <button
                onClick={() => {
                    setIsSuccess(false);
                    const url = new URL(window.location.href);
                    url.searchParams.delete('success');
                    window.history.replaceState({}, '', url.toString());
                }}
                className="text-[10px] font-bold text-green-800 uppercase tracking-widest hover:underline"
              >
                Zamknij
              </button>
          </div>
      );
    }

    if (clientSecret) {
        return (
            <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-sm uppercase tracking-tight">Dokończ wpłatę</h3>
                    <button
                        onClick={() => setClientSecret(null)}
                        className="text-[10px] font-bold text-neutral-400 hover:text-neutral-900 uppercase tracking-widest transition-colors"
                    >
                        Anuluj
                    </button>
                </div>
                <div className="bg-neutral-50 rounded-lg p-4 mb-6 border border-neutral-100">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-neutral-500">Kwota wsparcia:</span>
                        <span className="font-bold text-lg">{selectedAmount} PLN</span>
                    </div>
                </div>
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'flat', variables: { colorPrimary: '#2563eb', colorBackground: '#ffffff', colorText: '#171717', borderRadius: '8px' } } }}>
                    <CheckoutForm returnUrl={`${window.location.origin}${window.location.pathname}?success=true`} />
                </Elements>
            </div>
        );
    }

    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm mb-6 space-y-6 animate-in fade-in duration-500">
          <div className="text-center space-y-2">
            <h3 className="font-bold text-base tracking-tight italic">Twoje wsparcie ma znaczenie</h3>
            <p className="text-[11px] text-neutral-500 leading-relaxed italic">
                Wspieraj rozwój projektów POLUTEK.PL dobrowolnym napiwkiem. <br />
                Dziękuję za zaufanie!
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
              {[10, 20, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setSelectedAmount(amt)}
                    className={cn(
                        "py-3 rounded-lg border font-bold text-sm transition-all",
                        selectedAmount === amt
                            ? "bg-blue-600 border-blue-600 text-white shadow-md scale-[1.02]"
                            : "bg-white border-neutral-200 text-neutral-600 hover:border-blue-400 hover:bg-blue-50/50"
                    )}
                  >
                      {amt} PLN
                  </button>
              ))}
          </div>

          <div className="relative group">
              <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                <span className="text-[10px] font-bold text-neutral-400">PLN</span>
              </div>
              <input
                type="number"
                min="10"
                value={selectedAmount}
                onChange={(e) => setSelectedAmount(e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-3 px-4 text-sm font-bold text-neutral-900 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all"
                placeholder="Inna kwota"
              />
          </div>

          <button
            onClick={() => handleSupport(Number(selectedAmount))}
            disabled={isLoading || !selectedAmount || Number(selectedAmount) < 10}
            className="w-full bg-charcoal text-white py-4 rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase transition-all hover:bg-black active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={16} /> : <>WYŚLIJ NAPIWEK <ArrowRight size={14} /></>}
          </button>
      </div>
    );
  }

  // Standard Playlist view (if no videoTitle)
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
