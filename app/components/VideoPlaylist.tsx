"use client";

import { MIN_PAYMENT_BY_CURRENCY, type SupportedCurrency } from '@/lib/constants';
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from './LanguageContext';
import ReferralModal from './ReferralModal';
import { loadStripe } from '@stripe/stripe-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Modular Components
import SupportBox from './playlist/SupportBox';
import CheckoutModal from './playlist/CheckoutModal';
import ReferralInfo from './playlist/ReferralInfo';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

interface VideoPlaylistProps {
  videoId?: string;
  videoSlug?: string;
  videoTitle?: string;
  creatorId?: string;
  videos?: any[];
  onVideoSelect?: (id: string) => void;
  currentVideoId?: string;
}

const VideoPlaylist: React.FC<VideoPlaylistProps> = ({ videoTitle, creatorId }) => {
  const { t, language } = useLanguage();
  const { userId } = useAuth();
  const { openSignIn } = useClerk();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(t.currency);
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);
  const [isRegulaminOpen, setIsRegulaminOpen] = useState(false);
  const [isPolitykaOpen, setIsPolitykaOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [referralData, setReferralData] = useState<{ count: number, points: number, code: string | null }>({ count: 0, points: 0, code: null });

  const minAmount = MIN_PAYMENT_BY_CURRENCY[(selectedCurrency.toUpperCase() as SupportedCurrency)] ?? MIN_PAYMENT_BY_CURRENCY.PLN;
  const getSuggestedAmount = useCallback((curr: string) => {
    if (curr === 'PLN') return 25;
    return 10;
  }, []);

  const [amount, setAmount] = useState<number | ''>(getSuggestedAmount(t.currency));

  useEffect(() => {
    setIsMounted(true);
    let interval: NodeJS.Timeout;

    if (searchParams.get('success') === 'true') {
      setIsCheckoutModalOpen(true);
      setIsSuccess(true);
      setIsSyncing(true);

      let attempts = 0;
      const maxAttempts = 10;

      interval = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch('/api/user/sync');
          const data = await res.json();

          if (data.totalPaid > 0 || attempts >= maxAttempts) {
            clearInterval(interval);
            setIsSyncing(false);
            if (data.totalPaid > 0) router.refresh();
          }
        } catch (e) {
          console.error("Sync error", e);
        }
      }, 2000);
    }

    return () => { if (interval) clearInterval(interval); };
  }, [searchParams, router]);

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
          console.error("[VideoPlaylist] Failed to fetch referral data:", error);
        }
      };
      fetchReferralData();
    }
  }, [userId]);

  const handleCurrencyChange = (curr: string) => {
    setSelectedCurrency(curr);
    setAmount(getSuggestedAmount(curr));
  };

  const availableCurrencies = ['PLN', 'USD', 'EUR', 'GBP', 'CHF'].filter(curr => {
    if (language === 'en' && curr === 'PLN') return false;
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
      alert(language === 'pl' ? `Minimalna kwota wsparcia to ${minAmount} ${selectedCurrency}` : `Minimum support amount is ${minAmount} ${selectedCurrency}`);
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch('/api/checkout/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Number(amount),
            currency: selectedCurrency.toUpperCase(),
            title: videoTitle || "Tip The Guy / Patron",
            creatorId: creatorId
          }),
          cache: 'no-store'
      });

      const data = await response.json();

      if (data?.clientSecret) {
        setClientSecret(data.clientSecret);
        setIsCheckoutModalOpen(true);
      } else if (data?.error) {
        if (response.status === 401 || data.error.includes("AUTH_REQUIRED")) {
          alert(language === 'pl' ? "Twoja sesja wygasła. Zaloguj się ponownie." : "Your session has expired. Please sign in again.");
          openSignIn();
        } else {
          alert(language === 'pl' ? `Błąd: ${data.message || data.error}` : `Error: ${data.message || data.error}`);
        }
      }
    } catch (error: any) {
      console.error("Payment error", error);
      alert(language === 'pl' ? "Błąd połączenia z systemem płatności. Spróbuj odświeżyć stronę." : "Payment system connection error. Please refresh the page.");
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
          onAmountChange={(val) => setAmount(val === '' ? '' : parseInt(val))}
          onCurrencyChange={handleCurrencyChange}
          onTermsChange={(checked) => {
            setIsTermsAccepted(!!checked);
            if (checked) setShowTermsError(false);
          }}
          onSupport={onSupport}
          onOpenRegulamin={() => setIsRegulaminOpen(true)}
          onOpenPolityka={() => setIsPolitykaOpen(true)}
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
                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter border-b pb-4">Regulamin Serwisu POLUTEK.PL</DialogTitle>
                </DialogHeader>
                <div className="prose prose-sm prose-neutral max-w-none text-foreground">
                  <section className="space-y-6">
                    <div>
                      <h2 className="text-lg font-black uppercase tracking-tight">1. Charakter platformy</h2>
                      <p>Serwis POLUTEK.PL jest prywatną, autorską platformą wideo. Platforma działa w modelu dożywotniego patronatu.</p>
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
                      <p>Dla bezpieczeństwa i wygody użytkowników, POLUTEK.PL korzysta z zewnętrznego systemu uwierzytelniania <strong>Clerk</strong>.</p>
                    </div>
                  </section>
                </div>
            </DialogContent>
        </Dialog>
    </div>
  );
};

export default VideoPlaylist;
