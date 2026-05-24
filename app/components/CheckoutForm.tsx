'use client';

import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useLanguage } from './LanguageContext';
import { Loader2 } from './icons';

export default function CheckoutForm({ returnUrl }: { returnUrl?: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const { language } = useLanguage();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) return;

    setIsLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl || `${window.location.origin}/?success=true`,
      },
    });

    if (error) {
      setErrorMessage(error.message || 'An unexpected error occurred.');
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="min-h-[200px]">
        <PaymentElement options={{
          layout: {
            type: 'tabs',
            defaultCollapsed: false,
          },
          business: { name: 'POLUTEK.PL' },
        }} />
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg font-medium text-[12px] text-center animate-in fade-in zoom-in-95">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !stripe || !elements}
        className="group relative w-full bg-neutral-900 text-white py-5 rounded-2xl font-black text-[13px] tracking-[0.2em] uppercase transition-all duration-500 hover:bg-black hover:shadow-2xl hover:shadow-blue-500/20 disabled:opacity-50 active:scale-[0.98] overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-white/10 to-blue-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />

        <div className="relative flex items-center justify-center gap-3">
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          ) : (
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          )}
          <span>
            {isLoading
              ? (language === 'pl' ? 'PRZETWARZANIE...' : 'PROCESSING...')
              : (language === 'pl' ? 'POTWIERDŹ WPŁATĘ' : 'CONFIRM PAYMENT')
            }
          </span>
        </div>
      </button>

      <p className="text-[10px] text-neutral-400 text-center uppercase tracking-widest font-medium">
        Secure SSL Encrypted Connection
      </p>
    </form>
  );
}
