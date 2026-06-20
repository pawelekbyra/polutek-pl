"use client";

import { logger } from "@/lib/logger";
import { PublicVideoDTO } from '../types/video';
import { MAIN_CREATOR_NAME, MIN_PAYMENT_BY_CURRENCY, SUPPORTED_CURRENCIES, type SupportedCurrency } from '@/lib/constants';
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from './LanguageContext';
import { useToast } from '@/app/hooks/useToast';
import ReferralModal from './ReferralModal';
import { loadStripe } from '@stripe/stripe-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SupportBox from './playlist/SupportBox';
import CheckoutModal from './playlist/CheckoutModal';
import ReferralInfo from './playlist/ReferralInfo';


// Modular Components

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

interface VideoPlaylistProps {
  videoId?: string;
  videoSlug?: string;
  videoTitle?: string;
  creatorId?: string;
  videos?: PublicVideoDTO[];
  onVideoSelect?: (id: string) => void;
  currentVideoId?: string;
  isPatron?: boolean;
}

const VideoPlaylist: React.FC<VideoPlaylistProps> = ({ videoTitle, creatorId, isPatron = false }) => {
  const { t, language } = useLanguage();
  const toast = useToast();
  const { userId } = useAuth();
  const { openSignIn } = useClerk();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState(t.currency);
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);
  const [isRegulaminOpen, setIsRegulaminOpen] = useState(false);
  const [isPolitykaOpen, setIsPolitykaOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [paymentUiStatus, setPaymentUiStatus] = useState<string | null>(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [referralData, setReferralData] = useState<{ count: number, points: number, code: string | null }>({ count: 0, points: 0, code: null });
  const [minimums, setMinimums] = useState<Record<SupportedCurrency, number>>(MIN_PAYMENT_BY_CURRENCY);

  const minAmount = minimums[(selectedCurrency.toUpperCase() as SupportedCurrency)] ?? minimums.PLN;
  const getSuggestedAmount = useCallback((curr: string) => {
    if (curr === 'PLN') return 25;
    return 10;
  }, []);

  const [amount, setAmount] = useState<number | ''>(getSuggestedAmount(t.currency));

  useEffect(() => {
    fetch('/api/payment-settings', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data?.limits) return;
        const nextMinimums = { ...MIN_PAYMENT_BY_CURRENCY } as Record<SupportedCurrency, number>;
        for (const currency of SUPPORTED_CURRENCIES) {
          const minAmount = Number(data.limits[currency]?.minAmount);
          if (Number.isFinite(minAmount) && minAmount > 0) nextMinimums[currency] = minAmount;
        }
        setMinimums(nextMinimums);
      })
      .catch((error) => logger.warn('[VideoPlaylist] Failed to fetch payment minimums:', error))
      .finally(() => setIsInitialLoading(false));
  }, []);

  useEffect(() => {
    setIsMounted(true);
    let interval: NodeJS.Timeout;

    const returnedPaymentId = searchParams.get('payment_id');
    if (searchParams.get('success') === 'true' && returnedPaymentId) {
      setIsCheckoutModalOpen(true);
      setIsSuccess(true);
      setIsSyncing(true);
      setPaymentId(returnedPaymentId);

      // Invalidate queries to refresh patron status and other state
      queryClient.invalidateQueries();

      let attempts = 0;
      const maxAttempts = 10;

      interval = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch(`/api/payments/${encodeURIComponent(returnedPaymentId)}`, { cache: 'no-store' });
          const data = await res.json();
          setPaymentUiStatus(data.uiStatus || null);

          if (data.uiStatus === 'SUCCEEDED' || data.uiStatus === 'FAILED_CANCELED' || data.uiStatus === 'REFUNDED_DISPUTED' || attempts >= maxAttempts) {
            clearInterval(interval);
            setIsSyncing(false);
            if (data.uiStatus === 'SUCCEEDED') router.refresh();
          }
        } catch (e) {
          logger.error("Sync error", e);
        }
      }, 2000);
    }

    return () => { if (interval) clearInterval(interval); };
  }, [searchParams, router, queryClient]);

  useEffect(() => {
    if (isCheckoutModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isCheckoutModalOpen]);

  useEffect(() => {
    setSelectedCurrency(t.currency);
    setAmount(getSuggestedAmount(t.currency));
  }, [t.currency, getSuggestedAmount]);

  useEffect(() => {
    if (userId) {
      const fetchReferralData = async () => {
        try {
          const response = await fetch(`/api/user/referrals`);
          if (response.ok) {
            const data = await response.json();
            setReferralData({
              count: data.referralCount || 0,
              points: data.referralPoints || 0,
              code: data.referralCode || userId
            });
          }
        } catch (error) {
          logger.error("[VideoPlaylist] Failed to fetch referral data:", error);
        }
      };
      fetchReferralData();
    }
  }, [userId]);

  const handleCurrencyChange = (curr: string) => {
    setSelectedCurrency(curr);
    setAmount(getSuggestedAmount(curr));
  };

  const availableCurrencies = [...SUPPORTED_CURRENCIES].filter((currency) => {
    if (language === 'en' && currency === 'PLN') return false;
    return true;
  });

  const onSupport = async () => {
    if (!userId) {
      openSignIn();
      return;
    }

    if (!isTermsAccepted) {
      setShowTermsError(true);
      return;
    }
    setShowTermsError(false);

    if (!amount || amount < minAmount) {
      toast(language === 'pl' ? `Minimalna kwota wsparcia to ${minAmount} ${selectedCurrency}` : `Minimum support amount is ${minAmount} ${selectedCurrency}`, 'error');
      return;
    }

    try {
      setIsLoading(true);
      const requestId = checkoutRequestId || crypto.randomUUID();
      setCheckoutRequestId(requestId);

      const response = await fetch('/api/checkout/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountMinor: Number(amount) * 100,
            currency: selectedCurrency.toUpperCase(),
            title: videoTitle || "Tip The Guy / Patron",
            creatorId: creatorId,
            requestId,
          }),
          cache: 'no-store'
      });

      const data = await response.json();

      if (data?.clientSecret) {
        setClientSecret(data.clientSecret);
        setPaymentId(data.paymentId || null);
        setIsCheckoutModalOpen(true);
      } else if (data?.terminal) {
        setPaymentId(data.paymentId || null);
        setPaymentUiStatus(data.status || 'FAILED_CANCELED');
        toast(language === 'pl' ? 'Ta próba płatności jest zakończona. Rozpocznij nową wpłatę.' : 'This payment attempt is finished. Start a new support attempt.', 'error');
        setCheckoutRequestId(null);
      } else if (data?.error) {
        if (response.status === 401 || data.error.includes("AUTH_REQUIRED")) {
          toast(language === 'pl' ? "Twoja sesja wygasła. Zaloguj się ponownie." : "Your session has expired. Please sign in again.", 'error');
          openSignIn();
        } else {
          toast(language === 'pl' ? `Błąd: ${data.message || data.error}` : `Error: ${data.message || data.error}`, 'error');
        }
      }
    } catch (error: unknown) {
      logger.error("Payment error", error);
      toast(language === 'pl' ? "Błąd połączenia z systemem płatności. Spróbuj odświeżyć stronę." : "Payment system connection error. Please refresh the page.", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 px-2 relative scroll-mt-20" id="donations">
        <SupportBox
          t={t}
          language={language}
          selectedCurrency={selectedCurrency}
          amount={amount}
          minAmount={minAmount}
          isLoading={isLoading}
          isTermsAccepted={isTermsAccepted}
          showTermsError={showTermsError}
          availableCurrencies={availableCurrencies}
          onAmountChange={(val) => setAmount(val === '' ? '' : Number(val))}
          onCurrencyChange={handleCurrencyChange}
          onTermsChange={(checked) => {
            setIsTermsAccepted(!!checked);
            if (checked) setShowTermsError(false);
          }}
          onSupport={onSupport}
          onOpenRegulamin={() => setIsRegulaminOpen(true)}
          onOpenPolityka={() => setIsPolitykaOpen(true)}
          isPatron={isPatron}
          isInitialLoading={isInitialLoading}
        />

        <ReferralInfo
          userId={userId}
          onOpenReferral={() => setIsReferralModalOpen(true)}
          openSignIn={openSignIn}
        />

        {userId && (
          <ReferralModal
            isOpen={isReferralModalOpen}
            onClose={() => setIsReferralModalOpen(false)}
            referralCode={referralData.code || userId}
            referralPoints={referralData.points}
          />
        )}

        {isMounted && isCheckoutModalOpen && (clientSecret || isSuccess) && createPortal(
          <CheckoutModal
            isSuccess={isSuccess}
            isSyncing={isSyncing}
            language={language}
            amount={amount}
            selectedCurrency={selectedCurrency}
            videoTitle={videoTitle}
            clientSecret={clientSecret}
            paymentId={paymentId}
            paymentUiStatus={paymentUiStatus}
            stripePromise={stripePromise}
            onClose={() => {
              setIsCheckoutModalOpen(false);
              if (isSuccess) router.replace(window.location.pathname);
            }}
            onBackToSite={() => {
              setIsCheckoutModalOpen(false);
              router.replace(window.location.pathname);
            }}
          />,
          document.body
        )}

        <Dialog open={isRegulaminOpen} onOpenChange={setIsRegulaminOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter border-b pb-4">Regulamin serwisu</DialogTitle>
                </DialogHeader>
                <div className="prose prose-sm prose-neutral max-w-none text-foreground">
                  <section className="space-y-6">
                    <div>
                      <h2 className="text-lg font-black uppercase tracking-tight">1. Charakter serwisu</h2>
                      <p>Serwis kanału {MAIN_CREATOR_NAME} jest prywatnym, autorskim kanałem wideo. Działa on w modelu patronatu.</p>
                    </div>
                  </section>
                </div>
            </DialogContent>
        </Dialog>

        <Dialog open={isPolitykaOpen} onOpenChange={setIsPolitykaOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter border-b pb-4">Polityka Prywatności</DialogTitle>
                </DialogHeader>
                <div className="prose prose-sm prose-neutral max-w-none text-foreground">
                  <section className="space-y-6">
                    <div>
                      <h2 className="text-lg font-black uppercase tracking-tight">1. Dane osobowe i logowanie</h2>
                      <p>Dla bezpieczeństwa i wygody użytkowników, serwis korzysta z zewnętrznego systemu uwierzytelniania <strong>Clerk</strong>.</p>
                    </div>
                  </section>
                </div>
            </DialogContent>
        </Dialog>
    </div>
  );
};

export default VideoPlaylist;
