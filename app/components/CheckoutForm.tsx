'use client';

import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useLanguage } from './LanguageContext';
import { Loader2 } from './icons';
import { MAIN_CREATOR_NAME } from '@/lib/constants';

export default function CheckoutForm({ returnUrl, paymentId }: { returnUrl?: string; paymentId?: string | null }) {
  const stripe = useStripe();
  const elements = useElements();
  const { language } = useLanguage();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) return;

    setIsLoading(true);

    // We use confirmPayment but we need to ensure Link is not interfering.
    // Actually, setting fields.billingDetails.email to 'never' in PaymentElement is the key.
    const currentUrl = new URL(returnUrl || window.location.href);
    currentUrl.searchParams.set('success', 'true');
    if (paymentId) currentUrl.searchParams.set('payment_id', paymentId);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: currentUrl.toString(),
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
          business: { name: MAIN_CREATOR_NAME },
          paymentMethodOrder: ['card', 'blik', 'p24', 'apple_pay', 'google_pay'],
          wallets: {
            applePay: 'auto',
            googlePay: 'auto',
            link: 'never'
          },
          fields: {
            billingDetails: {
              email: 'never'
            }
          }
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
        className="group relative w-full overflow-hidden rounded-2xl bg-[#171717] py-5 text-[13px] font-black uppercase tracking-[0.2em] text-[#f8f3e7] transition-all duration-500 hover:bg-[#171717]/90 hover:shadow-2xl hover:shadow-blue-500/20 disabled:opacity-50 active:scale-[0.98]"
      >
        <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-blue-600/0 via-white/10 to-blue-600/0 transition-transform duration-1000 ease-in-out group-hover:translate-x-[100%]" />

        <div className="relative flex items-center justify-center gap-3">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
          ) : (
            <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          )}
          <span>
            {isLoading
              ? (language === 'pl' ? 'PRZETWARZANIE...' : 'PROCESSING...')
              : (language === 'pl' ? 'POTWIERDŹ WPŁATĘ' : 'CONFIRM PAYMENT')
            }
          </span>
        </div>
      </button>

      <p className="text-center text-[10px] font-medium uppercase tracking-widest text-[#6b665d]">
        Secure SSL Encrypted Connection
      </p>
    </form>
  );
}
