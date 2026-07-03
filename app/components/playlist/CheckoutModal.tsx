"use client";

import React from 'react';
import { X, Star, Gem, Shield, Loader2 } from '../icons';
import { MAIN_CREATOR_NAME } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Elements } from '@stripe/react-stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import CheckoutForm from '../CheckoutForm';

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
    <div className="fixed top-0 left-0 w-screen h-screen z-[9999] bg-white flex flex-col md:flex-row overflow-hidden">
      {/* Left Column (Summary - Desktop) */}
      <div className="hidden md:flex md:w-[45%] bg-[#050505] text-white flex-col justify-center px-10 md:px-12 lg:px-20 py-20 relative overflow-hidden h-full border-r border-white/[0.05]">
        {/* Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
        </div>

        <div className="relative z-10 space-y-12">
          <div className="space-y-6 animate-in fade-in slide-in-from-left-8 duration-700 delay-100 fill-mode-both">
            <div className="relative inline-block overflow-hidden rounded-full group">
              <span className="relative z-10 inline-block px-4 py-1.5 bg-blue-600/10 border border-blue-500/30 text-blue-400 backdrop-blur-md text-[10px] font-black uppercase tracking-[0.3em]">
                {viewerIsPatron
                  ? (language === 'pl' ? 'Dodatkowe wsparcie' : 'Extra Support')
                  : (language === 'pl' ? 'Dobrowolny napiwek' : 'Voluntary Tip')}
              </span>
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer" />
            </div>
            <h1 className="text-6xl lg:text-7xl font-brand font-black uppercase tracking-[-0.05em] leading-[0.9] mb-4 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
              {viewerIsPatron
                ? (language === 'pl' ? <>Wspierasz <br /> Dalej</> : <>Keep <br /> Supporting</>)
                : (language === 'pl' ? <>Zostań <br /> Patronem</> : <>Become a <br /> Patron</>)}
            </h1>
            <div className="h-1.5 w-24 bg-blue-600 rounded-full shadow-[0_0_30px_rgba(37,99,235,0.8)]" />
            <p className="text-lg text-neutral-400 font-medium italic max-w-md border-l-2 border-blue-600/30 pl-6 py-2">
              &quot;{videoTitle || (language === 'pl' ? "Wsparcie kanału" : "Channel Support")}&quot;
            </p>
          </div>

          <div className="space-y-8 animate-in fade-in slide-in-from-left-8 duration-700 delay-300 fill-mode-both">
            <div className="flex items-baseline gap-4 group cursor-default">
              <span className="text-7xl lg:text-8xl font-mono font-black tracking-tighter text-white drop-shadow-[0_0_30px_rgba(37,99,235,0.3)] transition-all duration-500 group-hover:scale-105 group-hover:text-blue-500">{amount}</span>
              <span className="text-2xl font-mono text-neutral-500 font-bold group-hover:text-neutral-300 transition-colors">{selectedCurrency}</span>
            </div>

            <div className="space-y-6">
              {viewerIsPatron ? (
                <>
                  <div className="flex items-start gap-5 group hover:bg-white/[0.04] p-5 -ml-5 rounded-[2rem] transition-all duration-500 hover:scale-[1.02] border border-transparent hover:border-white/[0.05] backdrop-blur-sm">
                    <div className="w-14 h-14 bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-2xl flex items-center justify-center shrink-0 border border-white/[0.1] group-hover:border-blue-500/50 transition-all duration-500 shadow-2xl">
                      <Star size={24} className="text-blue-500 group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-black uppercase tracking-widest text-white/90 group-hover:text-white">
                        {language === 'pl' ? 'Masz już pełny dostęp' : 'You already have full access'}
                      </p>
                      <p className="text-[13px] text-neutral-500 leading-relaxed max-w-xs font-medium group-hover:text-neutral-400">
                        {language === 'pl'
                          ? 'Twój dostęp do Strefy Fenkju jest już zapewniony. Ta wpłata niczego nowego nie odblokowuje.'
                          : 'Your access to the Thank You Zone is already secured. This tip doesn’t unlock anything new.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-5 group hover:bg-white/[0.04] p-5 -ml-5 rounded-[2rem] transition-all duration-500 hover:scale-[1.02] border border-transparent hover:border-white/[0.05] backdrop-blur-sm">
                    <div className="w-14 h-14 bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-2xl flex items-center justify-center shrink-0 border border-white/[0.1] group-hover:border-blue-500/50 transition-all duration-500 shadow-2xl">
                      <Gem size={24} className="text-blue-500 group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-black uppercase tracking-widest text-white/90 group-hover:text-white">
                        {language === 'pl' ? 'Czysty gest wsparcia' : 'A pure show of support'}
                      </p>
                      <p className="text-[13px] text-neutral-500 leading-relaxed max-w-xs font-medium italic group-hover:text-neutral-400">
                        {language === 'pl'
                          ? 'Dowolna kwota, bez nowych korzyści — bezpośrednio wspiera dalszy rozwój kanału.'
                          : 'Any amount, no new benefits — it directly supports the channel’s continued growth.'}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-5 group hover:bg-white/[0.04] p-5 -ml-5 rounded-[2rem] transition-all duration-500 hover:scale-[1.02] border border-transparent hover:border-white/[0.05] backdrop-blur-sm">
                    <div className="w-14 h-14 bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-2xl flex items-center justify-center shrink-0 border border-white/[0.1] group-hover:border-blue-500/50 transition-all duration-500 shadow-2xl">
                      <Star size={24} className="text-blue-500 group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-black uppercase tracking-widest text-white/90 group-hover:text-white">
                        {language === 'pl' ? 'Dostęp do Strefy Fenkju' : 'Access to the Thank You Zone'}
                      </p>
                      <p className="text-[13px] text-neutral-500 leading-relaxed max-w-xs font-medium group-hover:text-neutral-400">
                        {language === 'pl'
                          ? 'Jednorazowa wpłata finansuje rozwój POLUTEK.PL — projektu, który dopiero raczkuje — i daje dożywotni, nielimitowany dostęp do wszystkich obecnych i przyszłych materiałów dodatkowych.'
                          : 'A one-time tip funds the growth of POLUTEK.PL — a project still in its early days — and grants lifetime, unlimited access to all current and future bonus materials.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-5 group hover:bg-white/[0.04] p-5 -ml-5 rounded-[2rem] transition-all duration-500 hover:scale-[1.02] border border-transparent hover:border-white/[0.05] backdrop-blur-sm">
                    <div className="w-14 h-14 bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-2xl flex items-center justify-center shrink-0 border border-white/[0.1] group-hover:border-blue-500/50 transition-all duration-500 shadow-2xl">
                      <Gem size={24} className="text-blue-500 group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-black uppercase tracking-widest text-white/90 group-hover:text-white">
                        {language === 'pl' ? 'Rosnąca biblioteka' : 'Growing library'}
                      </p>
                      <p className="text-[13px] text-neutral-500 leading-relaxed max-w-xs font-medium italic group-hover:text-neutral-400">
                        {language === 'pl'
                          ? 'Na razie niewiele materiałów, ale dzięki Tobie będzie ich coraz więcej.'
                          : "Not much there yet, but thanks to you it'll keep growing."}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-10 lg:left-20 z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-700">
            {MAIN_CREATOR_NAME} &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>

      {/* Right Column (Form Area) */}
      <div className="flex-1 bg-white flex flex-col relative h-full">
        <Button
          variant="ghost"
          onClick={onClose}
          className="hidden md:flex absolute top-4 right-4 z-30 w-12 h-12 rounded-md shadow-md"
        >
          <X className="h-6 w-6" />
        </Button>

        <div className="md:hidden w-full px-6 py-6 flex justify-between items-center shrink-0 relative z-20 border-b border-neutral-100 bg-white">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 leading-none mb-1">
              {language === 'pl' ? 'Kwota napiwku' : 'Tip amount'}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-mono font-black text-neutral-900">{amount}</span>
              <span className="text-sm font-mono font-bold text-neutral-400">{selectedCurrency}</span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            <span>{language === 'pl' ? 'Wróć' : 'Back'}</span>
            <X className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-start px-6 md:px-12 lg:px-16 pt-1 pb-10 relative z-10 overflow-y-auto">
          <div className="w-full max-w-[480px]">
            {isSuccess ? (
              <div className="text-center space-y-10 py-12 animate-in fade-in zoom-in-95 duration-700">
                <div className="relative mx-auto w-24 h-24">
                  <div className="absolute inset-0 bg-green-500 rounded-3xl rotate-12 opacity-20 animate-pulse" />
                  <div className="absolute inset-0 bg-green-500 rounded-3xl -rotate-12 opacity-20 animate-pulse delay-75" />
                  <div className="relative w-full h-full bg-green-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-green-500/40 text-white text-4xl font-black">
                    ✓
                  </div>
                </div>

                <div className="space-y-4">
                  <h1 className="text-4xl font-brand font-black uppercase tracking-tighter text-neutral-900">
                    {language === 'pl' ? 'Wielkie dzięki!' : 'Succeed!!!'}
                  </h1>
                  <p className="text-lg text-neutral-500 font-medium italic leading-relaxed max-w-sm mx-auto">
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
                    className="w-full h-16 rounded-2xl bg-neutral-900 hover:bg-black text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl transition-all duration-300"
                  >
                    {language === 'pl' ? 'Wróć do serwisu' : 'Back to site'}
                  </Button>
                  <p className="mt-6 text-[10px] font-black uppercase tracking-widest text-neutral-300">
                    {isSyncing ? (language === 'pl' ? 'Oczekiwanie na webhook Stripe...' : 'Waiting for Stripe webhook...') : (paymentUiStatus || (language === 'pl' ? 'Status sprawdzony' : 'Status checked'))}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col pt-10">
                <div className="hidden md:block mb-6">
                  <h2 className="text-2xl font-brand font-black uppercase tracking-tight leading-none">{language === 'pl' ? 'Przekaż jednorazowy napiwek' : 'Send a one-time tip'}</h2>
                  <p className="text-sm text-muted-foreground">{language === 'pl' ? 'Bezpieczna transakcja obsługiwana przez Stripe.' : 'Secure transaction handled by Stripe.'}</p>
                </div>

                <div className="bg-white border border-neutral-200 p-8 shadow-md rounded-[2.5rem] mb-6 ring-8 ring-neutral-50 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
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
                          colorBackground: '#ffffff',
                          colorText: '#171717',
                          borderRadius: '12px',
                          fontFamily: 'var(--font-brand)',
                        }
                      }
                    }}>
                      <CheckoutForm paymentId={paymentId} />
                    </Elements>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 space-y-8">
                      <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                      <p className="text-sm font-mono text-muted-foreground tracking-widest">{language === 'pl' ? 'Inicjalizacja systemu...' : 'Initializing system...'}</p>
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
