"use client";

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../components/LanguageContext';
import { Trophy, Users, Heart, Star, Gem, Check, ArrowRight, Loader2, ChevronDown, LogIn } from '../components/icons';
import EmbeddedComments from '../components/comments/EmbeddedComments';
import Hero from '../components/Hero';
import { createPortal } from 'react-dom';
import { useAuth, useClerk, SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import BrandName from '../components/BrandName';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import CheckoutForm from '../components/CheckoutForm';
import { cn } from '@/lib/utils';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

interface CampaignContentProps {
  adminData: any;
  creator: any;
  userProfile: any;
  totalRaised: number;
  supportersCount: number;
}

const REWARDS = [
  {
    id: 'reward_1',
    amount: 50,
    title: 'Wspierający',
    description: 'Twoje imię pojawi się w napisach końcowych mojego projektu. Dziękuję za zaufanie!',
    icon: <Heart className="text-red-500" size={24} />,
    perks: ['Imię w napisach', 'Podziękowanie e-mail', 'Dożywotni Patron (Tier 1)']
  },
  {
    id: 'reward_2',
    amount: 150,
    title: 'Mecenas Projektu',
    description: 'Dostęp do ekskluzywnych nagrań zza kulis powstawania projektu oraz wcześniejszy dostęp do materiałów.',
    icon: <Star className="text-amber-500" size={24} />,
    perks: ['Wszystko z Tier 1', 'Nagrania Behind-the-scenes', 'Wcześniejszy dostęp', 'Dożywotni Patron (Tier 2)']
  },
  {
    id: 'reward_3',
    amount: 500,
    title: 'Partner Strategiczny',
    description: 'Zaproszenie na zamknięte spotkanie online, gdzie omówię szczegóły projektu i odpowiem na Twoje pytania.',
    icon: <Gem className="text-blue-500" size={24} />,
    perks: ['Wszystko z Tier 2', 'Spotkanie online Q&A', 'Dostęp do Discorda VIP', 'Limitowana koszulka projektu']
  }
];

export default function CampaignContent({
  creator: initialCreator,
  userProfile,
  totalRaised: initialRaised,
  supportersCount: initialSupporters
}: CampaignContentProps) {
  const { language, t: translations } = useLanguage();
  const { userId } = useAuth();
  const { openSignIn } = useClerk();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | ''>(50);
  const [activeTab, setActiveTab] = useState<'support' | 'comments'>('support');

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setIsCheckoutModalOpen(true);
      setIsSuccess(true);
      setIsSyncing(true);
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch('/api/user/sync');
          const data = await res.json();
          if (data.totalPaid > 0 || attempts >= 10) {
            clearInterval(interval);
            setIsSyncing(false);
          }
        } catch (e) {
          console.error("Sync error", e);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, []);

  const goal = 50000;
  const progress = Math.min(Math.round((initialRaised / goal) * 100), 100);
  const amountRemaining = Math.max(goal - initialRaised, 0);

  const handleSupport = async (amount: number) => {
    if (!userId) {
      alert(language === 'pl' ? "Zaloguj się, aby wesprzeć projekt." : "Please sign in to support the project.");
      openSignIn();
      return;
    }

    if (!amount || amount < 10) {
      alert(language === 'pl' ? "Minimalna kwota to 10 PLN" : "Minimum amount is 10 PLN");
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
            title: `Wsparcie projektu: I rise money for my secret project`,
            creatorId: initialCreator?.id
          }),
          cache: 'no-store'
      });

      const data = await response.json();

      if (data?.clientSecret) {
        setClientSecret(data.clientSecret);
        setIsCheckoutModalOpen(true);
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

  if (!mounted) return null;

  const dummyCampaignVideo = {
    id: 'crowdfunding_zrzutka',
    title: 'I rise money for my secret project',
    description: `Witajcie! Przez ostatnie miesiące pracowałem w ukryciu nad czymś, co może całkowicie zmienić sposób, w jaki postrzegacie niezależne dziennikarstwo i śledztwa w sieci.\n\n"Secret Project" to rozbudowana platforma, która pozwoli nam wszystkim dotrzeć do prawdy tam, gdzie inni wolą milczeć. Potrzebuję Waszego wsparcia, aby sfinalizować produkcję i zabezpieczyć infrastrukturę.\n\nKampania autorstwa POLUTEK.PL`,
    videoUrl: 'https://pub-309ebc4b2d654f78b2a22e1d57917b94.r2.dev/Wuthering-Heights.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop',
    creatorId: initialCreator?.id || '',
    creator: {
      ...initialCreator,
      name: 'POLUTEK.PL',
      subscribersCount: initialCreator?.subscribersCount || 1250000
    },
    slug: 'campaign-video',
    tier: 'PUBLIC',
    views: 1250400,
    likesCount: 45000,
    dislikesCount: 120,
    publishedAt: new Date().toISOString()
  };

  return (
    <div className="relative bg-neutral-50 min-h-screen font-sans text-neutral-900">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 pt-8 pb-12">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <Hero
              video={dummyCampaignVideo as any}
              initialInteraction={userProfile?.initialInteraction}
              initialIsSubscribed={userProfile?.initialIsSubscribed}
            />

            <div className="lg:hidden flex border-b border-neutral-300 mt-4">
               <button
                 onClick={() => setActiveTab('support')}
                 className={cn(
                   "flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-all border-b-2",
                   activeTab === 'support' ? "border-blue-600 text-blue-600" : "border-transparent text-neutral-400"
                 )}
               >
                 Wsparcie
               </button>
               <button
                 onClick={() => setActiveTab('comments')}
                 className={cn(
                   "flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-all border-b-2",
                   activeTab === 'comments' ? "border-blue-600 text-blue-600" : "border-transparent text-neutral-400"
                 )}
               >
                 Komentarze
               </button>
            </div>

            <div className="lg:hidden mt-6">
               {activeTab === 'comments' ? (
                 <EmbeddedComments videoId="crowdfunding_zrzutka" userProfile={userProfile} videoTier="PUBLIC" />
               ) : (
                 <div className="space-y-6">
                    {/* MOBILE SUPPORT CONTENT */}
                    <div className="bg-white border border-neutral-200 p-6 shadow-md rounded-xl space-y-6 relative overflow-hidden">
                        <div className="relative z-10 space-y-6">
                            <div className="space-y-4">
                                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Postęp kampanii</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-bold tracking-tighter text-neutral-900">{initialRaised.toLocaleString()}</span>
                                    <span className="text-lg font-medium text-neutral-400">PLN</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-neutral-500 font-medium">Cel: {goal.toLocaleString()} PLN</span>
                                    <span className="text-blue-600 font-bold">Pozostało: {amountRemaining.toLocaleString()} PLN</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-600 transition-all duration-1000 ease-out" style={{ width: `${progress}%` }} />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-neutral-100">
                                <div className="relative group">
                                <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                                    <span className="text-sm font-semibold text-neutral-400">PLN</span>
                                </div>
                                <input
                                    type="number"
                                    min="10"
                                    step="1"
                                    value={selectedAmount}
                                    onChange={(e) => setSelectedAmount(e.target.value === '' ? '' : parseInt(e.target.value))}
                                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-3 px-4 text-lg font-semibold text-neutral-900 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                                    placeholder="10"
                                />
                                </div>
                                <button
                                onClick={() => handleSupport(Number(selectedAmount))}
                                disabled={isLoading || !selectedAmount || Number(selectedAmount) < 10}
                                className="w-full bg-blue-600 text-white py-3 rounded-md font-semibold text-sm uppercase tracking-wider transition-colors hover:bg-blue-700 disabled:opacity-50"
                                >
                                {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'WESPRZYJ PROJEKT'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-lg font-bold tracking-tight px-1">Nagrody dla Ciebie</h2>
                        <div className="space-y-4">
                            {REWARDS.map((reward) => (
                                <div key={reward.id} className="group bg-white border border-neutral-200 p-5 shadow-sm rounded-xl hover:border-blue-600 transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-2 bg-neutral-50 rounded-lg border border-neutral-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">{reward.icon}</div>
                                        <span className="text-xl font-bold">{reward.amount} <span className="text-xs font-normal text-neutral-400">PLN</span></span>
                                    </div>
                                    <h3 className="text-base font-bold tracking-tight mb-2 group-hover:text-blue-600 transition-colors">{reward.title}</h3>
                                    <p className="text-xs text-neutral-500 mb-6 leading-relaxed">{reward.description}</p>
                                    <button
                                    onClick={() => handleSupport(reward.amount)}
                                    disabled={isLoading}
                                    className="w-full bg-charcoal text-white hover:bg-black py-2.5 rounded-md font-bold text-[10px] tracking-widest uppercase transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
                                    >
                                    {isLoading && selectedAmount === reward.amount ? <Loader2 className="animate-spin" size={14} /> : <>WYBIERAM <ArrowRight size={14} /></>}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                 </div>
               )}
            </div>

            <div className="hidden lg:block mt-10">
               <EmbeddedComments videoId="crowdfunding_zrzutka" userProfile={userProfile} videoTier="PUBLIC" />
            </div>
          </div>

          <div className="hidden lg:block lg:col-span-4 space-y-6 lg:sticky lg:top-6 h-fit">
            <div className="bg-white border border-neutral-200 p-6 shadow-md rounded-xl space-y-6 relative overflow-hidden">
               <div className="relative z-10 space-y-6">
                  <div className="space-y-4">
                     <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Postęp kampanii</p>
                     <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold tracking-tighter text-neutral-900">{initialRaised.toLocaleString()}</span>
                        <span className="text-lg font-medium text-neutral-400">PLN</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-500 font-medium">Cel: {goal.toLocaleString()} PLN</span>
                        <span className="text-blue-600 font-bold">Pozostało: {amountRemaining.toLocaleString()} PLN</span>
                     </div>
                  </div>

                  <div className="space-y-2">
                     <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 transition-all duration-1000 ease-out" style={{ width: `${progress}%` }} />
                     </div>
                     <div className="flex justify-between items-center text-xs font-medium text-neutral-500 uppercase tracking-tight">
                        <span>{progress}% sfinalizowane</span>
                        <span className="text-blue-600">Wspieraj teraz</span>
                     </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-neutral-100">
                    <div className="relative group">
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                        <span className="text-sm font-semibold text-neutral-400">PLN</span>
                      </div>
                      <input
                        type="number"
                        min="10"
                        step="1"
                        value={selectedAmount}
                        onChange={(e) => setSelectedAmount(e.target.value === '' ? '' : parseInt(e.target.value))}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-3 px-4 text-lg font-semibold text-neutral-900 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                        placeholder="10"
                      />
                    </div>
                    <button
                      onClick={() => handleSupport(Number(selectedAmount))}
                      disabled={isLoading || !selectedAmount || Number(selectedAmount) < 10}
                      className="w-full bg-blue-600 text-white py-3 rounded-md font-semibold text-sm uppercase tracking-wider transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'WESPRZYJ PROJEKT'}
                    </button>
                  </div>
               </div>
            </div>

            <div className="space-y-4">
               <h2 className="text-lg font-bold tracking-tight px-1">Nagrody dla Ciebie</h2>
               <div className="space-y-4">
                  {REWARDS.map((reward) => (
                     <div key={reward.id} className="group bg-white border border-neutral-200 p-5 shadow-sm rounded-xl hover:border-blue-600 transition-all">
                        <div className="flex justify-between items-start mb-4">
                           <div className="p-2 bg-neutral-50 rounded-lg border border-neutral-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">{reward.icon}</div>
                           <span className="text-xl font-bold">{reward.amount} <span className="text-xs font-normal text-neutral-400">PLN</span></span>
                        </div>
                        <h3 className="text-base font-bold tracking-tight mb-2 group-hover:text-blue-600 transition-colors">{reward.title}</h3>
                        <p className="text-xs text-neutral-500 mb-6 leading-relaxed">{reward.description}</p>
                        <button
                          onClick={() => handleSupport(reward.amount)}
                          disabled={isLoading}
                          className="w-full bg-charcoal text-white hover:bg-black py-2.5 rounded-md font-bold text-[10px] tracking-widest uppercase transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
                        >
                           {isLoading && selectedAmount === reward.amount ? <Loader2 className="animate-spin" size={14} /> : <>WYBIERAM <ArrowRight size={14} /></>}
                        </button>
                     </div>
                  ))}
               </div>
            </div>
          </div>
        </div>
      </div>

      {isCheckoutModalOpen && (clientSecret || isSuccess) && createPortal(
          <div className="fixed top-0 left-0 w-screen h-screen z-[9999] bg-white flex flex-col md:flex-row overflow-hidden">
             <div className="hidden md:flex md:w-[40%] bg-neutral-50 text-neutral-900 flex-col justify-start px-12 pt-20 pb-10 relative overflow-hidden h-full border-r border-neutral-200">
                <div className="relative z-10">
                   <h1 className="text-4xl font-bold tracking-tighter mb-8">Zostań <br /> Mecenasem</h1>
                   <div className="flex items-baseline gap-2 border-b border-neutral-200 pb-6 mb-6">
                      <span className="text-5xl font-bold tracking-tighter">{selectedAmount}</span>
                      <span className="text-xl font-medium text-neutral-400">PLN</span>
                   </div>
                   <p className="text-base text-neutral-500 italic">&quot;I rise money for my secret project&quot;</p>
                </div>
             </div>

             <div className="flex-1 bg-white flex flex-col relative h-full">
                <button onClick={() => setIsCheckoutModalOpen(false)} className="absolute top-4 right-4 z-30 flex items-center justify-center w-10 h-10 border border-neutral-200 rounded-full hover:bg-neutral-50 transition-colors bg-white text-xl">×</button>
                <div className="flex-1 flex flex-col items-center justify-start px-6 pt-20 pb-10 relative z-10 overflow-y-auto">
                   <div className="w-full max-w-[440px]">
                      {isSuccess ? (
                        <div className="text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
                           <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-lg"><Check size={24} className="text-white" /></div>
                           <h1 className="text-2xl font-bold tracking-tight">Dziękujemy!</h1>
                           <button onClick={() => { setIsCheckoutModalOpen(false); router.push('/'); }} className="w-full bg-charcoal text-white py-3 rounded-full font-bold text-xs uppercase tracking-widest transition-all hover:bg-black active:scale-95">Wróć do kampanii</button>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                           <h2 className="text-xl font-bold tracking-tight mb-8">Dokończ wpłatę</h2>
                           <div className="bg-white border border-neutral-200 p-6 shadow-sm rounded-xl">
                                 {stripePromise && clientSecret ? (
                                   <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'flat', variables: { colorPrimary: '#2563eb', colorBackground: '#ffffff', colorText: '#171717', borderRadius: '8px' } } }}>
                                     <CheckoutForm returnUrl={`${window.location.origin}/?success=true`} />
                                   </Elements>
                                 ) : <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-neutral-400" size={32} /></div>}
                           </div>
                        </div>
                      )}
                   </div>
                </div>
             </div>
          </div>,
          document.body
        )}
    </div>
  );
}
