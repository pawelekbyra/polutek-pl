"use client";

import { useAuth, SignInButton, useClerk } from "@clerk/nextjs";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, Gem, Lock } from './icons';
import { AccessTier } from "@prisma/client";
import { useLanguage } from './LanguageContext';

interface VideoAccessContextType {
  hasAccess: boolean;
  videoUrl: string | null;
  isLoading: boolean;
  effectiveTier: AccessTier;
}

const VideoAccessContext = createContext<VideoAccessContextType>({
  hasAccess: false,
  videoUrl: null,
  isLoading: true,
  effectiveTier: "PUBLIC" as AccessTier,
});

export const useVideoAccess = () => useContext(VideoAccessContext);

interface PremiumWrapperProps {
  children: React.ReactNode;
  videoId: string;
  requiredTier?: AccessTier;
  isMainFeatured?: boolean;
  variant?: 'default' | 'thumbnail';
}

export default function PremiumWrapper({
  children,
  videoId,
  requiredTier: initialTier,
  isMainFeatured,
  variant = 'default'
}: PremiumWrapperProps) {
  const { userId, isLoaded } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [dbTier, setDbTier] = useState<AccessTier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveTier = initialTier || dbTier || ("PUBLIC" as AccessTier);
  const isPublic = effectiveTier === "PUBLIC";
  const isUnlockedByAuth = !!userId && effectiveTier === "LOGGED_IN";

  useEffect(() => {
    async function checkAccess() {
      const mediaUrl = `/api/media/${videoId}`;

      if (isPublic) {
        setHasAccess(true);
        setVideoUrl(mediaUrl);
        setIsLoading(false);
        return;
      }

      if (isLoaded && !userId) {
        setHasAccess(false);
        setIsLoading(false);
        return;
      }

      if (!isLoaded || !userId) return;

      try {
        const response = await fetch(`/api/access?videoId=${videoId}`);
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const data = await response.json();
        setHasAccess(data.hasAccess);
        if (data.hasAccess) {
          setVideoUrl(mediaUrl);
        }
        if (data.requiredTier) setDbTier(data.requiredTier);
      } catch (error) {
        console.error("Error checking video access:", error);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkAccess();
  }, [userId, isLoaded, videoId, isPublic]);

  if (!mounted) {
    return <div className="animate-pulse bg-neutral/5 rounded-xl w-full h-full" />;
  }

  const contextValue = { hasAccess: isPublic || isUnlockedByAuth || hasAccess, videoUrl, isLoading, effectiveTier };

  if (contextValue.hasAccess) {
    return (
      <VideoAccessContext.Provider value={contextValue}>
        <div className="animate-in fade-in duration-500 h-full w-full">
          {children}
        </div>
      </VideoAccessContext.Provider>
    );
  }

  if (isLoading) {
    if (isLoaded && !userId && !isPublic) {
        return <PaywallOverlay requiredTier={effectiveTier} isLoggedIn={false} variant={variant} />;
    }
    return <div className="animate-pulse bg-neutral/5 rounded-xl w-full h-full" />;
  }

  return (
    <VideoAccessContext.Provider value={contextValue}>
      <PaywallOverlay requiredTier={effectiveTier} isLoggedIn={!!userId} variant={variant} />
    </VideoAccessContext.Provider>
  );
}

function CustomAuthTrigger({ children }: { children: React.ReactNode }) {
  const { openSignUp } = useClerk();
  const { language } = useLanguage();

  const handleAuth = () => {
    // Check for referral cookie
    const cookies = document.cookie.split('; ');
    const refCookie = cookies.find(row => row.startsWith('clerk_referrer_id='));
    const referrerId = refCookie ? refCookie.split('=')[1] : undefined;

    openSignUp({
      unsafeMetadata: {
        referrerId,
        language: language
      }
    });
  };

  return (
    <div onClick={handleAuth} className="cursor-pointer contents">
      {children}
    </div>
  );
}

function PaywallOverlay({ requiredTier, isLoggedIn, variant }: { requiredTier: AccessTier, isLoggedIn: boolean, variant: 'default' | 'thumbnail' }) {
  const { t } = useLanguage();
  const isVIPGated = requiredTier === "PATRON";
  const isThumbnail = variant === 'thumbnail';

  return (
    <div className={cn(
        "animate-in fade-in zoom-in-95 duration-700 h-full w-full relative group",
        isThumbnail ? "rounded-lg" : "rounded-lg"
    )}>
      <div className={cn(
          "aspect-video bg-[#0a0a0a] overflow-hidden relative border flex items-center justify-center h-full w-full shadow-2xl transition-all duration-500",
          isThumbnail ? "rounded-lg border-white/10" : "rounded-lg border-[#1a1a1a]"
      )}>

         <div className="absolute inset-0 z-0 opacity-60">
            <div className={cn(
                "w-full h-full blur-[16px] transition-all duration-700 group-hover:scale-110",
                isVIPGated
                    ? 'bg-gradient-to-br from-amber-900 via-black to-amber-950'
                    : 'bg-gradient-to-br from-blue-900 via-black to-blue-950'
            )} />
         </div>

         <div className={cn(
             "relative z-10 flex flex-col items-center text-center max-w-none origin-center transition-transform duration-500",
             isThumbnail ? "scale-[0.18] w-[550%]" : "px-6 w-full"
         )}>
            <div className={cn(
                "transition-all duration-700 group-hover:scale-110 flex items-center justify-center",
                isThumbnail ? "mb-10" : "mb-4 md:mb-8"
            )}>
               {isVIPGated ? (
                 <Gem className="text-amber-500 w-16 h-16 md:w-24 md:h-24" />
               ) : (
                 <CustomAuthTrigger>
                    <button className="hover:opacity-40 transition-opacity cursor-pointer flex items-center justify-center">
                      <Lock className="text-blue-400 w-16 h-16 md:w-24 md:h-24" />
                    </button>
                 </CustomAuthTrigger>
               )}
            </div>

            <div className="flex flex-col items-center font-brand font-black">
              {isVIPGated ? (
                <div className="flex flex-col items-center">
                    <span className="text-[clamp(2rem,10vw,6rem)] uppercase tracking-tighter leading-[0.8] text-amber-500">
                        {(t as any).patronZoneLine1}
                    </span>
                    <div className="h-px w-24 md:w-48 bg-white/10 my-1 md:my-2" />
                    <span className="text-[clamp(2rem,10vw,6rem)] uppercase tracking-tighter leading-[0.8] text-white">
                        {(t as any).patronZoneLine2}
                    </span>

                    <div className={cn(isThumbnail && "invisible")}>
                      <a href="#donations" className="group flex flex-col items-center gap-2 mt-6 md:mt-10">
                         <div className="h-px w-16 md:w-24 bg-white/10 group-hover:w-48 transition-all duration-500" />
                         <span className="text-[8px] md:text-[10px] font-brand font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-white/30 group-hover:text-amber-500 transition-colors">
                            {t.paywallUnlock}
                         </span>
                      </a>
                    </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                    <span className="text-[clamp(2rem,10vw,6rem)] uppercase tracking-tighter leading-[0.8] text-white">
                        {t.paywallText}
                    </span>
                    <div className="h-px w-24 md:w-48 bg-white/10 my-1 md:my-2" />
                    <span className="text-[clamp(2rem,10vw,6rem)] uppercase tracking-tighter leading-[0.8] text-blue-400">
                        {t.paywallAction}
                    </span>

                    <div className={cn(isThumbnail && "invisible")}>
                      <CustomAuthTrigger>
                        <button className="group flex flex-col items-center gap-2 mt-6 md:mt-10">
                           <div className="h-px w-16 md:w-24 bg-white/10 group-hover:w-48 transition-all duration-500" />
                           <span className="text-[8px] md:text-[10px] font-brand font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-white/30 group-hover:text-primary transition-colors">
                              {t.loginGatedText}
                           </span>
                        </button>
                      </CustomAuthTrigger>
                    </div>
                </div>
              )}
            </div>
         </div>
      </div>
    </div>
  );
}
