"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from './LanguageContext';
import ReferralModal from './ReferralModal';
import BrandName from './BrandName';
import { ChevronDown, Trophy } from './icons';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import CheckoutForm from './CheckoutForm';
import { Checkbox } from 'flowbite-react';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

interface VideoPlaylistProps {
  videoId?: string;
  videoSlug?: string;
  videoTitle?: string;
}

const VideoPlaylist: React.FC<VideoPlaylistProps> = ({ videoTitle }) => {
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

  const startSyncing = async () => {
    // Legacy function, logic moved to useEffect for better cleanup
  };

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
            title: videoTitle || "Tip The Guy / Patron"
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
        <div className="bg-white border border-neutral-200 p-6 shadow-md relative overflow-hidden rounded-xl">
          <div className="space-y-4 relative z-10">
            <h3 className="text-xl font-sans font-black text-neutral-900 uppercase tracking-tight flex flex-wrap items-center justify-center gap-2 text-center">
              {t.supportArtist}
              <Trophy size={32} className="text-neutral-900" />
            </h3>

            <div className="space-y-3">
              <p className="font-sans text-[13px] leading-relaxed text-neutral-500 whitespace-pre-wrap text-left">
                {t.donationDescription}
              </p>

              {showTermsError && (
                <p className="text-red-600 font-sans font-bold text-[10px] text-center uppercase tracking-widest animate-bounce">
                  {t.pleaseAcceptTerms}
                </p>
              )}

              <div className="space-y-2 pt-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 text-center">
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
                  <p className="font-mono text-[10px] text-red-600 font-bold uppercase animate-pulse text-center">
                    {language === 'pl' ? `Błąd: Nie osiągnięto minimum (${minAmount} ${selectedCurrency})` : `Error: Minimum amount not met (${minAmount} ${selectedCurrency})`}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onSupport}
              disabled={isLoading || amount === '' || amount < minAmount}
              className={`w-full bg-blue-600 text-white py-3.5 rounded-md font-semibold text-sm uppercase tracking-wider transition-all hover:bg-blue-700 flex items-center justify-center gap-2 active:scale-[0.98] ${isLoading ? 'opacity-70 cursor-wait' : ''} ${amount === '' || amount < minAmount ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {language === 'pl' ? "PRZETWARZANIE..." : "LOADING..."}
                </>
              ) : (
                language === 'pl' ? 'WYŚLIJ NAPIWEK' : 'TIP THE GUY'
              )}
            </button>

            {/* Terms below the button, no absolute positioning */}
            <div className="flex justify-center">
              <label className="flex items-center gap-2 cursor-pointer group opacity-40 hover:opacity-100 transition-opacity">
                <Checkbox
                  id="accept-terms"
                  checked={isTermsAccepted}
                  onChange={(e) => {
                    setIsTermsAccepted(e.target.checked);
                    if (e.target.checked) setShowTermsError(false);
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

        {/* "Nie mam hajsu" outside the box, positioned to not add height */}
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
                {/* Main Summary content */}
                <div className="relative z-10 mt-0">
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
                         <div className="flex items-start gap-5">
                            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center shrink-0 mt-1">
                               <span className="text-white text-xs font-black">✓</span>
                            </div>
                            <div className="space-y-1.5">
                               <p className="text-sm font-black uppercase tracking-widest">Niezależne Śledztwa</p>
                               <p className="text-sm text-neutral-500 leading-relaxed">Twoje wsparcie pozwala nam tworzyć unikalne treści i niezależne raporty.</p>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Footer attribution */}
                <div className="relative z-10 flex justify-between items-center">
                   <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-300">
                      POLUTEK.PL &copy; {new Date().getFullYear()}
                   </p>
                   <div className="flex gap-4 opacity-20">
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Secure Payment</span>
                   </div>
                </div>

                {/* Decorative background element */}
                <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-blue-50/50 rounded-full blur-[120px]" />
             </div>

             {/* Right Column (Form Area) */}
             <div className="flex-1 bg-white flex flex-col relative h-full">
                {/* Integrated Close Button (Desktop Only) */}
                <button
                  onClick={() => {
                    setIsCheckoutModalOpen(false);
                    if (isSuccess) router.replace(window.location.pathname);
                  }}
                  className="hidden md:flex absolute top-4 right-4 z-30 group items-center justify-center w-12 h-12 border border-neutral-200 rounded-md font-bold hover:bg-neutral-50 transition-all bg-white shadow-md"
                  aria-label="Zamknij"
                >
                  <span className="text-2xl leading-none flex items-center justify-center">×</span>
                </button>

                {/* Mobile Header Overlap */}
                <div className="md:hidden w-full px-6 py-6 flex justify-between items-center shrink-0 relative z-20 border-b border-neutral-100 bg-white">
                   <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-black text-xs">P</div>
                      <h3 className="text-lg font-brand font-black uppercase tracking-tighter">POLUTEK<span className="text-neutral-400">.PL</span></h3>
                   </div>

                   <button
                     onClick={() => {
                       setIsCheckoutModalOpen(false);
                       if (isSuccess) router.replace(window.location.pathname);
                     }}
                     className="group flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 rounded-md font-bold uppercase tracking-widest text-[10px] hover:bg-neutral-50 transition-all bg-white shadow-sm"
                   >
                     <span>Wróć</span>
                     <span className="text-base leading-none">×</span>
                   </button>
                </div>

                {/* Main Form content */}
                <div className="flex-1 flex flex-col items-center justify-start px-6 md:px-12 lg:px-16 pt-1 pb-10 relative z-10 overflow-y-auto">
                   <div className="w-full max-w-[480px]">
                      {isSuccess ? (
                        <div className="text-center space-y-8 py-10 animate-in fade-in zoom-in-95 duration-500">
                           <div className="w-20 h-20 bg-green-500 rounded-md flex items-center justify-center mx-auto shadow-2xl shadow-green-500/20">
                              <span className="text-white text-4xl">✓</span>
                           </div>
                           <div className="space-y-2">
                              <h1 className="text-3xl font-brand font-black uppercase tracking-tighter">
                                {language === 'pl' ? 'Dziękujemy!' : 'Thank you!'}
                              </h1>
                              <p className="text-base text-[#1a1a1a]/60 font-medium italic">
                                {language === 'pl'
                                  ? 'Twój napiwek został pomyślnie przekazany.'
                                  : 'Your tip has been successfully received.'}
                              </p>
                           </div>

                           <div className="bg-white border border-[#1a1a1a]/5 p-6 rounded-xl space-y-3">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a1a1a]/40">
                                 {isSyncing
                                    ? (language === 'pl' ? 'Synchronizacja statusu...' : 'Syncing status...')
                                    : (language === 'pl' ? 'Status zaktualizowany' : 'Status updated')}
                              </p>
                              <div className="flex items-center justify-center gap-3">
                                 {isSyncing && <span className="w-3 h-3 border-2 border-[#1a1a1a]/10 border-t-[#1a1a1a] rounded-full animate-spin" />}
                                 <span className="text-[10px] font-mono font-black uppercase tracking-tighter">
                                    {language === 'pl' ? 'Dziękujemy za wsparcie niezależnych mediów.' : 'Thank you for supporting independent media.'}
                                 </span>
                              </div>
                           </div>

                           <button
                             onClick={() => {
                               setIsCheckoutModalOpen(false);
                               router.replace(window.location.pathname);
                             }}
                             className="w-full bg-blue-600 text-white py-4 rounded-md font-bold text-xs tracking-widest uppercase transition-all hover:bg-blue-700 hover:shadow-xl active:scale-[0.98]"
                           >
                             {language === 'pl' ? 'Wróć do serwisu' : 'Back to site'}
                           </button>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          {/* Desktop Heading hint */}
                          <div className="hidden md:block mb-6 mt-0">
                             <h2 className="text-2xl font-brand font-black uppercase tracking-tight leading-none">{language === 'pl' ? 'Przekaż napiwek' : 'Finalize payment'}</h2>
                             <p className="text-sm text-neutral-400">Bezpieczna transakcja obsługiwana przez Stripe.</p>
                          </div>

                          {/* Mobile-only summary head */}
                          <div className="md:hidden text-center space-y-3 mb-6">
                             <span className="inline-block px-2 py-0.5 bg-neutral-100 rounded text-[9px] font-black uppercase tracking-[0.3em] text-neutral-500">{language === 'pl' ? 'Bezpieczna płatność' : 'Secure payment'}</span>
                             <h1 className="text-3xl font-brand font-black uppercase tracking-tighter leading-tight">{language === 'pl' ? 'Przekaż napiwek' : 'Tip the Guy'}</h1>
                             <div className="py-6 border-y border-neutral-100">
                                <p className="text-5xl font-mono font-black tracking-tighter">{amount} <span className="text-xl align-top opacity-20">{selectedCurrency}</span></p>
                             </div>
                          </div>

                          {/* Stripe form card */}
                          <div className="bg-white border border-neutral-200 p-1 shadow-md rounded-[2.5rem] mb-6">
                             <div className="p-6 md:p-8 lg:p-10">
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
                                    <span className="w-12 h-12 border-4 border-[#1a1a1a]/10 border-t-[#1a1a1a] rounded-full animate-spin" />
                                    <p className="text-sm font-mono text-[#1a1a1a]/40 tracking-widest">Inicjalizacja systemu...</p>
                                  </div>
                                )}
                             </div>
                          </div>
                        </div>
                      )}

                      {/* Trust indicators */}
                          <div className="flex justify-center items-center gap-10 opacity-30 grayscale contrast-200 mt-2">
                         <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-md bg-neutral-900" />
                           <span className="text-[10px] font-black uppercase tracking-widest">SSL encryption</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-md bg-neutral-900" />
                           <span className="text-[10px] font-black uppercase tracking-widest">Secure stripe check</span>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Subtle right-side background pattern */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.02] pointer-events-none z-0">
                   <div className="absolute top-0 right-0 w-[500px] h-[500px] border border-[#1a1a1a] rounded-md -mr-40 -mt-40" />
                </div>
             </div>
          </div>,
          document.body
        )}

        {/* Regulamin Modal */}
        {isRegulaminOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
             <div className="bg-[#FDFBF7] border-2 border-[#1a1a1a] p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-sm relative animate-in zoom-in-95 duration-300">
                <button
                  onClick={() => setIsRegulaminOpen(false)}
                  className="absolute top-4 right-4 text-black hover:opacity-50 transition-opacity font-bold uppercase tracking-widest text-xs"
                >
                  [ Zamknij ]
                </button>
                <div className="prose prose-sm prose-neutral">
                  <h1 className="text-2xl font-black uppercase tracking-tighter mb-8 border-b-2 border-[#1a1a1a]/10 pb-4">Regulamin Serwisu POLUTEK.PL</h1>
                  <section className="space-y-6 text-[#1a1a1a]">
                    <div>
                      <h2 className="text-lg font-black uppercase tracking-tight">1. Charakter platformy</h2>
                      <p>Serwis POLUTEK.PL jest prywatną, autorską platformą wideo. Platforma działa w modelu dożywotniego patronatu. Dostęp do treści cyfrowych jest uzależniony od łącznej kwoty wsparcia przekazanego twórcy.</p>
                    </div>
                    <div>
                      <h2 className="text-lg font-black uppercase tracking-tight">2. Model wsparcia i dostęp do treści</h2>
                      <p>Wsparcie finansowe przekazywane przez użytkowników ma charakter dobrowolnej wpłaty (napiwku). Użytkownicy odblokowują kolejne poziomy dostępu (Tiers) na podstawie swojej historycznej sumy wpłat (Lifetime Total).</p>
                    </div>
                    <div>
                      <h2 className="text-lg font-black uppercase tracking-tight">3. Płatności i brak zwrotów</h2>
                      <p>Wszelkie wpłaty są procesowane przez Stripe i mają charakter bezzwrotny. Raz odblokowany poziom dostępu jest przypisany do konta użytkownika na stałe (Lifetime Access).</p>
                    </div>
                    <div>
                      <h2 className="text-lg font-black uppercase tracking-tight">4. Prywatność i konto użytkownika</h2>
                      <p>Autoryzacja w serwisie odbywa się za pośrednictwem systemu Clerk. Użytkownik zobowiązuje się do korzystania z serwisu w sposób zgodny z prawem.</p>
                    </div>
                  </section>
                </div>
             </div>
          </div>
        )}

        {/* Polityka Prywatnosci Modal */}
        {isPolitykaOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
             <div className="bg-[#FDFBF7] border-2 border-[#1a1a1a] p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-sm relative animate-in zoom-in-95 duration-300">
                <button
                  onClick={() => setIsPolitykaOpen(false)}
                  className="absolute top-4 right-4 text-black hover:opacity-50 transition-opacity font-bold uppercase tracking-widest text-xs"
                >
                  [ Zamknij ]
                </button>
                <div className="prose prose-sm prose-neutral">
                  <h1 className="text-2xl font-black uppercase tracking-tighter mb-8 border-b-2 border-[#1a1a1a]/10 pb-4">Polityka Prywatności</h1>
                  <section className="space-y-6 text-[#1a1a1a]">
                    <div>
                      <h2 className="text-lg font-black uppercase tracking-tight">1. Dane osobowe i logowanie</h2>
                      <p>Dla bezpieczeństwa i wygody użytkowników, POLUTEK.PL korzysta z zewnętrznego systemu uwierzytelniania <strong>Clerk</strong>. Clerk zarządza procesem rejestracji, logowania oraz danymi profilowymi użytkowników.</p>
                    </div>
                    <div>
                      <h2 className="text-lg font-black uppercase tracking-tight">2. Płatności i bezpieczeństwo finansowe</h2>
                      <p>Wszystkie operacje finansowe (darowizny, napiwki) są procesowane wyłącznie przez <strong>Stripe</strong>. POLUTEK.PL nie przechowuje ani nie ma bezpośredniego dostępu do danych kart płatniczych.</p>
                    </div>
                    <div>
                      <h2 className="text-lg font-black uppercase tracking-tight">3. Przetwarzanie i wykorzystanie danych</h2>
                      <p>Twoje dane są wykorzystywane wyłącznie w celu zapewnienia prawidłowego funkcjonowania serwisu i personalizacji dostępu do materiałów.</p>
                    </div>
                  </section>
                </div>
             </div>
          </div>
        )}
    </div>
  );
};

export default VideoPlaylist;
