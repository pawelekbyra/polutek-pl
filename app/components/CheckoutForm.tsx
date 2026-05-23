'use client';

import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useLanguage } from './LanguageContext';

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
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement options={{ layout: 'tabs' }} />
      {errorMessage && <div className="text-red-500 font-medium text-[11px] text-center mt-3">{errorMessage}</div>}
      <button
        type="submit"
        disabled={isLoading || !stripe || !elements}
        className="w-full bg-charcoal text-white py-4 rounded-md font-bold text-xs tracking-widest uppercase transition-all duration-300 hover:bg-black hover:shadow-lg disabled:opacity-50 active:scale-[0.98] border border-charcoal"
      >
        {isLoading ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block mr-2" />
        ) : null}
        {language === 'pl' ? 'NAPIWKUJ' : 'PAY NOW'}
      </button>
    </form>
  );
}
