"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from './LanguageContext';
import ReferralModal from './ReferralModal';
import BrandName from './BrandName';
import { ChevronDown, Trophy, Loader2, X } from './icons';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import CheckoutForm from './CheckoutForm';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
    let interval: NodeJS.Timeout;

    // Auto-open modal if returning from Stripe with success
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

  const minAmount = 10;

  const getSuggestedAmount = (curr: string) => {
    if (curr === 'PLN') return 25;
    return 10;
  };

  const [amount, setAmount] = useState<number | ''>(getSuggestedAmount(t.currency));
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setSelectedCurrency(t.currency);
    setAmount(getSuggestedAmount(t.currency));
  }, [t.currency]);

  const handleCurrencyChange = (curr: string) => {
    setSelectedCurrency(curr);
    setAmount(getSuggestedAmount(curr));
  };

  const availableCurrencies = ['PLN', 'USD', 'EUR', 'GBP', 'CHF'].filter(curr => {
    if (language === 'en' && curr === 'PLN') return false;
    return true;
  });
  const [referralData, setReferralData] = useState<{ count: number, points: number, code: string | null }>({ count: 0, points: 0, code: null });
  const { userId } = useAuth();
  const { openSignIn } = useClerk();

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
            currency: selectedCurrency.toLowerCase(),
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
        <div className="bg-white border border-neutral-200 p-6 shadow-md relative overflow-hidden rounded-xl text-center">
          <div className="space-y-4 relative z-10">
            <h3 className="text-xl font-sans font-black text-neutral-900 uppercase tracking-tight flex flex-wrap items-center justify-center gap-2">
              {t.supportArtist}
              <Trophy size={32} className="text-neutral-900" />
            </h3>

            <div className="space-y-3 text-center">
              <p className="font-sans text-[13px] leading-relaxed text-neutral-500 whitespace-pre-wrap">
                {t.donationDescription}
              </p>

              {showTermsError && (
                <p className="text-destructive font-sans font-bold text-[10px] uppercase tracking-widest animate-bounce">
                  {t.pleaseAcceptTerms}
                </p>
              )}

              <div className="space-y-2 pt-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  {language === 'pl' ? `Kwota wsparcia (Min ${minAmount}.00 ${selectedCurrency})` : `Transaction amount (Min ${minAmount}.00 ${selectedCurrency})`}
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 right-0 flex items-center">
                    <select
                      value={selectedCurrency}
                      onChange={(e) => handleCurrencyChange(e.target.value)}
                      className="h-full bg-transparent border-none pr-8 pl-4 font-mono text-xl font-bold text-neutral-400 focus:text-neutral-900 focus:ring-0 outline-none cursor-pointer appearance-none transition-colors"
                      aria-label="Select Currency"
                    >
                      {availableCurrencies.map(curr => (
                        <option key={curr} value={curr}>{curr}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity">
                       <ChevronDown size={14} />
                    </div>
                  </div>
                  <input
                    type="number"
                    min={minAmount}
                    step="1"
                    value={amount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAmount(val === '' ? '' : parseInt(val));
                    }}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-4 px-12 font-mono text-3xl font-black text-neutral-900 text-center focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder:text-neutral-200"
                    placeholder={String(minAmount)}
                  />
                </div>
                {typeof amount === 'number' && amount < minAmount && (
                  <p className="font-mono text-[10px] text-destructive font-bold uppercase animate-pulse">
                    {language === 'pl' ? `Błąd: Nie osiągnięto minimum (${minAmount} ${selectedCurrency})` : `Error: Minimum amount not met (${minAmount} ${selectedCurrency})`}
                  </p>
                )}
              </div>
            </div>

            <Button
              type="button"
              onClick={onSupport}
              disabled={isLoading || amount === '' || amount < minAmount}
              className="w-full h-12 uppercase tracking-wider text-sm"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {language === 'pl' ? "PRZETWARZANIE..." : "LOADING..."}
                </>
              ) : (
                language === 'pl' ? 'WYŚLIJ NAPIWEK' : 'TIP THE GUY'
              )}
            </Button>

            {/* Terms below the button */}
            <div className="flex justify-center">
              <label className="flex items-center gap-2 cursor-pointer group opacity-40 hover:opacity-100 transition-opacity">
                <Checkbox
                  id="accept-terms"
                  checked={isTermsAccepted}
                  onCheckedChange={(checked) => {
                    setIsTermsAccepted(!!checked);
                    if (checked) setShowTermsError(false);
                  }}
                />
                <span className="text-neutral-500 font-sans font-medium text-[10px] tracking-tight transition-colors">
                  {language === 'pl' ? (
                    <>
                      Akceptuję{' '}
                      <button type="button" onClick={() => setIsRegulaminOpen(true)} className="underline hover:text-neutral-900">Regulamin</button>
                      {' '}i{' '}
                      <button type="button" onClick={() => setIsPolitykaOpen(true)} className="underline hover:text-neutral-900">Politykę Prywatności</button>
                    </>
                  ) : (
                    <>
                      I accept the{' '}
                      <button type="button" onClick={() => setIsRegulaminOpen(true)} className="underline hover:text-neutral-900">Terms</button>
                      {' '}and{' '}
                      <button type="button" onClick={() => setIsPolitykaOpen(true)} className="underline hover:text-neutral-900">Privacy Policy</button>
                    </>
                  )}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* "Nie mam hajsu" outside the box */}
        <button
          type="button"
          onClick={() => userId ? setIsModalOpen(true) : openSignIn()}
          className="absolute -bottom-5 right-6 text-[#1a1a1a]/20 hover:text-black hover:bg-[#1a1a1a]/5 px-2 py-1 rounded font-brand font-black text-[9px] uppercase tracking-[0.25em] transition-all z-30"
        >
          {t.noMoney}
        </button>

        {userId && (
          <ReferralModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            referralCode={referralData.code || userId}
            referralPoints={referralData.points}
          />
        )}

        {/* Checkout Full-Screen Takeover */}
        {isMounted && isCheckoutModalOpen && (clientSecret || isSuccess) && createPortal(
          <div className="fixed top-0 left-0 w-screen h-screen z-[9999] bg-white flex flex-col md:flex-row overflow-hidden">

             {/* Left Column (Summary - Desktop) */}
             <div className="hidden md:flex md:w-[45%] bg-neutral-50 text-neutral-900 flex-col justify-start px-10 md:px-12 lg:px-20 pt-1 pb-10 relative overflow-hidden h-full border-r border-neutral-200">
                <div className="relative z-10">
                   <div className="flex flex-col">
                      <span className="inline-block w-fit px-3 py-0.5 bg-blue-600/10 rounded text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 leading-none">Premium Access</span>
                      <h1 className="text-5xl lg:text-6xl font-brand font-black uppercase tracking-tighter leading-[0.85] mt-6">
                        Zostań <br /> Patronem
                      </h1>
                      <p className="text-base text-neutral-500 font-medium italic max-w-md">
                        &quot;{videoTitle || "Wsparcie twórcy"}&quot;
                      </p>
                   </div>

                   <div className="space-y-6">
                      <div className="flex items-baseline gap-3 border-b border-neutral-200 pb-6 mb-6">
                         <span className="text-4xl lg:text-5xl font-mono font-black tracking-tighter">{amount}</span>
                         <span className="text-xl font-mono text-neutral-300">{selectedCurrency}</span>
                      </div>

                      <div className="grid grid-cols-1 gap-8">
                         <div className="flex items-start gap-5">
                            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center shrink-0 mt-1">
                               <span className="text-white text-xs font-black">✓</span>
                            </div>
                            <div className="space-y-1.5">
                               <p className="text-sm font-black uppercase tracking-widest">Dożywotni Dostęp</p>
                               <p className="text-sm text-neutral-500 leading-relaxed">Wszystkie obecne i przyszłe materiały premium bez żadnych limitów czasowych.</p>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="relative z-10 flex justify-between items-center mt-auto">
                   <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-300">
                      POLUTEK.PL &copy; {new Date().getFullYear()}
                   </p>
                </div>
             </div>

             {/* Right Column (Form Area) */}
             <div className="flex-1 bg-white flex flex-col relative h-full">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsCheckoutModalOpen(false);
                    if (isSuccess) router.replace(window.location.pathname);
                  }}
                  className="hidden md:flex absolute top-4 right-4 z-30 w-12 h-12 rounded-md shadow-md"
                >
                  <X className="h-6 w-6" />
                </Button>

                <div className="md:hidden w-full px-6 py-6 flex justify-between items-center shrink-0 relative z-20 border-b border-neutral-100 bg-white">
                   <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-black text-xs">P</div>
                      <h3 className="text-lg font-brand font-black uppercase tracking-tighter">POLUTEK<span className="text-neutral-400">.PL</span></h3>
                   </div>

                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => {
                       setIsCheckoutModalOpen(false);
                       if (isSuccess) router.replace(window.location.pathname);
                     }}
                   >
                     <span>Wróć</span>
                     <X className="ml-2 h-4 w-4" />
                   </Button>
                </div>

                <div className="flex-1 flex flex-col items-center justify-start px-6 md:px-12 lg:px-16 pt-1 pb-10 relative z-10 overflow-y-auto">
                   <div className="w-full max-w-[480px]">
                      {isSuccess ? (
                        <div className="text-center space-y-8 py-10 animate-in fade-in zoom-in-95 duration-500">
                           <div className="w-20 h-20 bg-green-500 rounded-md flex items-center justify-center mx-auto shadow-2xl shadow-green-500/20 text-white text-4xl">
                              ✓
                           </div>
                           <div className="space-y-2">
                              <h1 className="text-3xl font-brand font-black uppercase tracking-tighter">
                                {language === 'pl' ? 'Dziękujemy!' : 'Thank you!'}
                              </h1>
                              <p className="text-base text-muted-foreground font-medium italic">
                                {language === 'pl'
                                  ? 'Twój napiwek został pomyślnie przekazany.'
                                  : 'Your tip has been successfully received.'}
                              </p>
                           </div>

                           <Button
                             onClick={() => {
                               setIsCheckoutModalOpen(false);
                               router.replace(window.location.pathname);
                             }}
                             className="w-full h-14 uppercase tracking-widest text-xs"
                           >
                             {language === 'pl' ? 'Wróć do serwisu' : 'Back to site'}
                           </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col pt-10">
                          <div className="hidden md:block mb-6">
                             <h2 className="text-2xl font-brand font-black uppercase tracking-tight leading-none">{language === 'pl' ? 'Przekaż napiwek' : 'Finalize payment'}</h2>
                             <p className="text-sm text-muted-foreground">Bezpieczna transakcja obsługiwana przez Stripe.</p>
                          </div>

                          <div className="bg-white border border-neutral-200 p-8 shadow-md rounded-[2.5rem] mb-6">
                                {stripePromise && clientSecret ? (
                                  <Elements stripe={stripePromise} options={{
                                    clientSecret,
                                    appearance: {
                                      theme: 'flat',
                                      variables: {
                                        colorPrimary: '#2563eb',
                                        colorBackground: '#ffffff',
                                        colorText: '#171717',
                                        borderRadius: '8px',
                                        fontFamily: 'var(--font-jakarta)',
                                      }
                                    }
                                  }}>
                                    <CheckoutForm />
                                  </Elements>
                                ) : (
                                  <div className="flex flex-col items-center justify-center py-24 space-y-8">
                                    <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                                    <p className="text-sm font-mono text-muted-foreground tracking-widest">Inicjalizacja systemu...</p>
                                  </div>
                                )}
                          </div>
                        </div>
                      )}
                   </div>
                </div>
             </div>
          </div>,
          document.body
        )}

        {/* Regulamin Dialog */}
        <Dialog open={isRegulaminOpen} onOpenChange={setIsRegulaminOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter border-b pb-4">Regulamin Serwisu POLUTEK.PL</DialogTitle>
                </DialogHeader>
                <div className="prose prose-sm prose-neutral max-w-none">
                  <section className="space-y-6 text-foreground">
                    <div>
                      <h2 className="text-lg font-black uppercase tracking-tight">1. Charakter platformy</h2>
                      <p>Serwis POLUTEK.PL jest prywatną, autorską platformą wideo. Platforma działa w modelu dożywotniego patronatu.</p>
                    </div>
                  </section>
                </div>
            </DialogContent>
        </Dialog>

        {/* Polityka Dialog */}
        <Dialog open={isPolitykaOpen} onOpenChange={setIsPolitykaOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter border-b pb-4">Polityka Prywatności</DialogTitle>
                </DialogHeader>
                <div className="prose prose-sm prose-neutral max-w-none">
                  <section className="space-y-6 text-foreground">
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
