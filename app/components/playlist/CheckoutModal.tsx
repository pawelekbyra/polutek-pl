"use client";

import React from 'react';
import { X, Shield, Loader2 } from '../icons';
import { Button } from '@/components/ui/button';
import { Elements } from '@stripe/react-stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import CheckoutForm from '../CheckoutForm';
import CheckoutSummaryPanel from './CheckoutSummaryPanel';

interface CheckoutModalProps {
  isSuccess: boolean;
  isSyncing: boolean;
  language: string;
  amount: number | '';
  selectedCurrency: string;
  videoTitle?: string;
  /** True when the signed-in viewer already holds an active Patron grant. */
  viewerIsPatron?: boolean;
  clientSecret: string | null;
  paymentId?: string | null;
  paymentUiStatus?: string | null;
  stripePromise: Promise<Stripe | null> | null;
  onClose: () => void;
  onBackToSite: () => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isSuccess,
  isSyncing,
  language,
  amount,
  selectedCurrency,
  videoTitle,
  viewerIsPatron = false,
  clientSecret,
  paymentId,
  paymentUiStatus,
  stripePromise,
  onClose,
  onBackToSite,
}) => {
  return (
    <div className="fixed left-0 top-0 z-[9999] flex h-screen w-screen flex-col overflow-hidden paper-surface md:flex-row">
      {/* Left Column (Summary - Desktop) */}
      <CheckoutSummaryPanel
        language={language}
        amount={amount}
        selectedCurrency={selectedCurrency}
        videoTitle={videoTitle}
        viewerIsPatron={viewerIsPatron}
      />

      {/* Right Column (Form Area) */}
      <div className="relative flex h-full flex-1 flex-col paper-surface">
        <Button
          variant="ghost"
          onClick={onClose}
          className="absolute right-4 top-4 z-30 hidden h-12 w-12 rounded-xl border paper-border paper-surface shadow-[0_6px_18px_rgba(23,23,23,0.10)] hover:bg-[var(--najs-paper-soft)] md:flex"
        >
          <X className="h-6 w-6" />
        </Button>

        <div className="relative z-20 flex w-full shrink-0 items-center justify-between border-b paper-border paper-surface px-6 py-6 md:hidden">
          <div className="flex flex-col">
            <span className="mb-1 text-[10px] font-black uppercase leading-none tracking-widest muted-text">
              {language === 'pl' ? 'Kwota napiwku' : 'Tip amount'}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-2xl font-black ink-text">{amount}</span>
              <span className="font-mono text-sm font-bold muted-text">{selectedCurrency}</span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="paper-border paper-surface ink-text hover:bg-[var(--najs-paper-soft)]"
          >
            <span>{language === 'pl' ? 'Wróć' : 'Back'}</span>
            <X className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-start overflow-y-auto px-6 pb-10 pt-1 md:px-12 lg:px-16">
          <div className="w-full max-w-[480px]">
            {isSuccess ? (
              <div className="animate-in fade-in zoom-in-95 space-y-10 py-12 text-center duration-700">
                <div className="relative mx-auto h-24 w-24">
                  <div className="absolute inset-0 rotate-12 animate-pulse rounded-3xl bg-green-500 opacity-20" />
                  <div className="absolute inset-0 -rotate-12 animate-pulse rounded-3xl bg-green-500 opacity-20 delay-75" />
                  <div className="relative flex h-full w-full items-center justify-center paper-radius-panel bg-green-500 text-4xl font-black text-white shadow-2xl shadow-green-500/40">
                    ✓
                  </div>
                </div>

                <div className="space-y-4">
                  <h1 className="font-brand text-4xl font-black uppercase tracking-tighter ink-text">
                    {language === 'pl' ? 'Wielkie dzięki!' : 'Succeed!!!'}
                  </h1>
                  <p className="mx-auto max-w-sm text-lg font-medium italic leading-relaxed muted-text">
                    {paymentUiStatus === 'SUCCEEDED'
                      ? (language === 'pl' ? 'Wpłata potwierdzona, a dostęp Patrona jest aktywny.' : 'Payment confirmed and Patron access is active.')
                      : paymentUiStatus === 'ACCESS_SYNC_PENDING'
                        ? (language === 'pl' ? 'Wpłata potwierdzona. Kończymy synchronizację dostępu Patrona.' : 'Payment confirmed. Patron access sync is finishing.')
                        : paymentUiStatus === 'FAILED_CANCELED'
                          ? (language === 'pl' ? 'Płatność nie została ukończona albo została anulowana.' : 'The payment was not completed or was canceled.')
                          : paymentUiStatus === 'REFUNDED_DISPUTED'
                            ? (language === 'pl' ? 'Status płatności wymaga sprawdzenia po zwrocie lub sporze.' : 'The payment status needs review after a refund or dispute.')
                            : (language === 'pl'
                              ? 'Twoje wsparcie zostało zarejestrowane. Czekamy na potwierdzenie webhooka Stripe.'
                              : 'Your support was registered. Waiting for Stripe webhook confirmation.')}
                  </p>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={onBackToSite}
                    className="h-16 w-full paper-radius-panel ink-button text-xs font-black uppercase tracking-[0.2em] text-[var(--najs-paper)] shadow-xl transition-all duration-300 hover:bg-[rgba(23,23,23,0.9)]"
                  >
                    {language === 'pl' ? 'Wróć do serwisu' : 'Back to site'}
                  </Button>
                  <p className="mt-6 text-[10px] font-black uppercase tracking-widest text-[#9a958b]">
                    {isSyncing ? (language === 'pl' ? 'Oczekiwanie na webhook Stripe...' : 'Waiting for Stripe webhook...') : (paymentUiStatus || (language === 'pl' ? 'Status sprawdzony' : 'Status checked'))}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col pt-10">
                <div className="mb-6 hidden md:block">
                  <h2 className="font-brand text-2xl font-black uppercase leading-none tracking-tight ink-text">{language === 'pl' ? 'Przekaż jednorazowy napiwek' : 'Send a one-time tip'}</h2>
                  <p className="text-sm muted-text">{language === 'pl' ? 'Bezpieczna transakcja obsługiwana przez Stripe.' : 'Secure transaction handled by Stripe.'}</p>
                </div>

                <div className="relative mb-6 overflow-hidden rounded-[2.5rem] border paper-border paper-surface p-8 paper-shadow-card ring-8 ring-[#f1ead9]/60">
                  <div className="pointer-events-none absolute right-0 top-0 p-4 opacity-[0.06]">
                    <Shield size={120} />
                  </div>
                  {stripePromise && clientSecret ? (
                    <Elements stripe={stripePromise} options={{
                      clientSecret,
                      // Localize Stripe's own field labels ("Card number", etc.) to the site language.
                      locale: language === 'pl' ? 'pl' : 'en',
                      appearance: {
                        theme: 'flat',
                        variables: {
                          colorPrimary: '#2563eb',
                          colorBackground: '#f8f3e7',
                          colorText: '#171717',
                          borderRadius: '12px',
                          fontFamily: 'var(--font-brand)',
                        }
                      }
                    }}>
                      <CheckoutForm paymentId={paymentId} />
                    </Elements>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-8 py-24">
                      <Loader2 className="h-12 w-12 animate-spin muted-text" />
                      <p className="font-mono text-sm tracking-widest muted-text">{language === 'pl' ? 'Inicjalizacja systemu...' : 'Initializing system...'}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
