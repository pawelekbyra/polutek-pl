"use client";

import { logger } from "@/lib/logger";
import { useAuth, SignInButton, useClerk } from "@clerk/nextjs";
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Star, Gem, Lock } from './icons';
import { useLanguage } from './LanguageContext';
import type { PlaybackPlan } from "@/lib/services/playback/playback.dto";
import { AccessTier } from "@prisma/client";
import { AccessTierDto } from "@/lib/services/comments/comment.dto";
import { PlayerSkeleton } from "@/components/skeletons";
import { PlayerErrorOverlay } from "./PlayerErrorOverlay";
import { PlayerStateFrame } from "./PlayerStateFrame";

interface VideoAccessContextType {
  hasAccess: boolean;
  playbackPlan: PlaybackPlan | null;
  isLoading: boolean;
  effectiveTier: AccessTierDto;
  refreshPlaybackPlan: () => Promise<void>;
}

const VideoAccessContext = createContext<VideoAccessContextType>({
  hasAccess: false,
  playbackPlan: null,
  isLoading: true,
  effectiveTier: "PUBLIC" as AccessTierDto,
  refreshPlaybackPlan: async () => {},
});

export const useVideoAccess = () => useContext(VideoAccessContext);

interface PremiumWrapperProps {
  children: React.ReactNode;
  videoId: string;
  requiredTier?: AccessTierDto;
  isMainFeatured?: boolean;
  variant?: 'default' | 'thumbnail';
  onAccessLoad?: (hasAccess: boolean) => void;
  /** Optional pre-calculated access state to avoid unnecessary fetches (useful for thumbnails) */
  hasAccess?: boolean;
}

export default function PremiumWrapper({
  children,
  videoId,
  requiredTier: initialTier,
  isMainFeatured,
  variant = 'default',
  onAccessLoad,
  hasAccess: providedHasAccess
}: PremiumWrapperProps) {
  const { userId, isLoaded, orgRole } = useAuth();
  const [internalHasAccess, setInternalHasAccess] = useState<boolean>(false);
  const [playbackPlan, setPlaybackPlan] = useState<PlaybackPlan | null>(null);
  const [dbTier, setDbTier] = useState<AccessTierDto | null>(null);
  const [isLoading, setIsLoading] = useState(variant !== 'thumbnail');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveTier = (initialTier || dbTier || "PUBLIC") as AccessTierDto;
  const isPublic = effectiveTier === "PUBLIC";
  const isUnlockedByAuth = !!userId && effectiveTier === "LOGGED_IN";

  const checkAccess = useCallback(async () => {
    // Skip fetching if we're in thumbnail mode or have pre-provided access
    if (variant === 'thumbnail' || providedHasAccess !== undefined) {
      setIsLoading(false);
      return;
    }

    if (isLoaded && !userId && !isPublic) {
      setInternalHasAccess(false);
      setPlaybackPlan(null);
      setIsLoading(false);
      return;
    }

    if (!isLoaded && !isPublic) return;

    try {
      const response = await fetch(`/api/media-source/${videoId}`);
      const data = await response.json();

      if (!response.ok) {
        setInternalHasAccess(false);
        setPlaybackPlan(null);
        if (data.requiredTier) setDbTier(data.requiredTier);
        return;
      }

      setInternalHasAccess(data.hasAccess);
      onAccessLoad?.(data.hasAccess);
      if (data.hasAccess) {
        setPlaybackPlan(data);
      }
      if (data.requiredTier) setDbTier(data.requiredTier);
      setFetchError(null);
    } catch (error) {
      logger.error("Error checking video access:", error);
      setInternalHasAccess(false);
      setFetchError("SOURCE_ERROR");
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, userId, isPublic, videoId, onAccessLoad, variant, providedHasAccess]);

  useEffect(() => {
    if (variant !== 'thumbnail' && providedHasAccess === undefined) {
      checkAccess();
    }
  }, [checkAccess, variant, providedHasAccess]);

  useEffect(() => {
    if (!playbackPlan?.source?.expiresAt) return;

    const expiresAt = new Date(playbackPlan.source.expiresAt).getTime();
    const refreshThresholdMs = 120 * 1000; // 2 minutes
    const now = Date.now();
    const msToRefresh = (expiresAt - now) - refreshThresholdMs;

    if (msToRefresh <= 0) {
      checkAccess();
      return;
    }

    const timer = setTimeout(() => {
      checkAccess();
    }, msToRefresh);

    return () => clearTimeout(timer);
  }, [playbackPlan, checkAccess]);

  if (!mounted) {
    return (
      <PlayerStateFrame>
        <PlayerSkeleton />
      </PlayerStateFrame>
    );
  }

  const resolvedHasAccess = providedHasAccess !== undefined
    ? providedHasAccess
    : (isPublic || isUnlockedByAuth || internalHasAccess);

  const contextValue = {
    hasAccess: resolvedHasAccess,
    playbackPlan,
    isLoading,
    effectiveTier,
    refreshPlaybackPlan: checkAccess
  };

  if (isLoading) {
    if (isLoaded && !userId && !isPublic) {
        return <PaywallOverlay requiredTier={effectiveTier} isLoggedIn={false} variant={variant} />;
    }
    return (
      <PlayerStateFrame>
        <PlayerSkeleton />
      </PlayerStateFrame>
    );
  }

  const isAdmin = orgRole === 'admin' || orgRole === 'org:admin';

  if (contextValue.hasAccess) {
    if (fetchError) {
        return (
          <PlayerStateFrame>
            <PlayerErrorOverlay
                errorCode={fetchError}
                onRetry={checkAccess}
                isAdmin={isAdmin}
            />
          </PlayerStateFrame>
        );
    }

    if (!playbackPlan) {
        return (
          <PlayerStateFrame>
            <PlayerErrorOverlay
                errorCode="NO_PLAYBACK_PLAN"
                onRetry={checkAccess}
                isAdmin={isAdmin}
            />
          </PlayerStateFrame>
        );
    }

    return (
      <VideoAccessContext.Provider value={contextValue}>
        <div className="animate-in fade-in duration-500 h-full w-full">
          {children}
        </div>
      </VideoAccessContext.Provider>
    );
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

function PaywallOverlay({ requiredTier, isLoggedIn, variant }: { requiredTier: AccessTierDto, isLoggedIn: boolean, variant: 'default' | 'thumbnail' }) {
  const { t } = useLanguage();
  const isVIPGated = requiredTier === "PATRON";
  const isThumbnail = variant === 'thumbnail';

  return (
    <div className={cn(
        "animate-in fade-in zoom-in-95 duration-700 h-full w-full relative group",
        isThumbnail ? "rounded-lg" : "rounded-lg"
    )}>
      <div className={cn(
          "aspect-video bg-[#0a0a0a] overflow-hidden relative border flex items-center justify-center h-full w-full shadow-2xl transition-all duration-500 [container-type:inline-size]",
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
             "absolute inset-0 z-10 flex flex-col items-center justify-center text-center max-w-none transition-all duration-500 w-full px-[10cqi]"
         )}>
            <div className={cn(
                "transition-all duration-700 group-hover:scale-110 flex items-center justify-center mb-[4cqi]"
            )}>
               {isVIPGated ? (
                 <Gem className="text-amber-500 w-[15cqi] h-[15cqi]" />
               ) : (
                 <CustomAuthTrigger>
                    <button className="hover:opacity-40 transition-opacity cursor-pointer flex items-center justify-center">
                      <Lock className="text-blue-400 w-[15cqi] h-[15cqi]" />
                    </button>
                 </CustomAuthTrigger>
               )}
            </div>

            <div className="flex flex-col items-center font-brand font-black">
              {isVIPGated ? (
                <div className="flex flex-col items-center">
                    <span className="text-[10cqi] uppercase tracking-tighter leading-[0.8] text-amber-500">
                        {(t as any).patronZoneLine1}
                    </span>
                    <div className="h-[0.2cqi] w-[30cqi] bg-white/10 my-[1.5cqi]" />
                    <span className="text-[10cqi] uppercase tracking-tighter leading-[0.8] text-white">
                        {(t as any).patronZoneLine2}
                    </span>

                    {!isThumbnail && (
                      <a href="#donations" className="group flex flex-col items-center gap-[2.5cqi] mt-[6cqi]">
                         <div className="h-[0.1cqi] w-[15cqi] bg-white/10 group-hover:w-[30cqi] transition-all duration-500" />
                         <span className="text-[2.5cqi] font-brand font-black uppercase tracking-[0.4em] text-white/30 group-hover:text-amber-500 transition-colors">
                            {t.paywallUnlock}
                         </span>
                      </a>
                    )}
                </div>
              ) : (
                <div className="flex flex-col items-center">
                    <span className="text-[10cqi] uppercase tracking-tighter leading-[0.8] text-white">
                        {t.paywallText}
                    </span>
                    <div className="h-[0.2cqi] w-[30cqi] bg-white/10 my-[1.5cqi]" />
                    <span className="text-[10cqi] uppercase tracking-tighter leading-[0.8] text-blue-400">
                        {t.paywallAction}
                    </span>

                    {!isThumbnail && (
                      <CustomAuthTrigger>
                        <button className="group flex flex-col items-center gap-[2.5cqi] mt-[6cqi]">
                           <div className="h-[0.1cqi] w-[15cqi] bg-white/10 group-hover:w-[30cqi] transition-all duration-500" />
                           <span className="text-[2.5cqi] font-brand font-black uppercase tracking-[0.4em] text-white/30 group-hover:text-primary transition-colors">
                              {t.loginGatedText}
                           </span>
                        </button>
                      </CustomAuthTrigger>
                    )}
                </div>
              )}
            </div>
         </div>
      </div>
    </div>
  );
}
