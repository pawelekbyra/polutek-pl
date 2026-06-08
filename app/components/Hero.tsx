"use client";

import React, { useOptimistic, useState, useEffect, useTransition } from 'react';
import { PublicVideoDTO } from '../types/video';
import { ThumbsUp, ThumbsDown, Share2, MoreHorizontal, X } from './icons';
import { useAuth, useClerk } from '@clerk/nextjs';
import { cn, formatCount } from '@/lib/utils';
import PremiumWrapper from './PremiumWrapper';
import Link from 'next/link';
import Image from 'next/image';
import VideoPlayer from './VideoPlayer';
import { toggleVideoLike, toggleVideoDislike } from '@/lib/actions/interactions';
import { PlayerSkeleton } from '@/components/skeletons';
import { useLanguage } from './LanguageContext';
import { useToast } from '@/app/hooks/useToast';
import { logger } from '@/lib/logger';
import { getVideoDisplayTitle } from '@/lib/video-title-overrides';
import SubscribeButton from './SubscribeButton';
import ShareButton from './ShareButton';
import { MAIN_CREATOR_NAME } from '@/lib/constants';
import { ThreeCupsGame } from './ThreeCupsGame';

interface HeroProps {
  video: PublicVideoDTO;
  initialInteraction?: { liked: boolean; disliked: boolean };
  initialIsSubscribed?: boolean;
}

const Hero: React.FC<HeroProps> = ({ video, initialInteraction, initialIsSubscribed }) => {
  const { t, language } = useLanguage();
  const toast = useToast();
  const { userId } = useAuth();
  const { openSignIn } = useClerk();
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCupGameOpen, setIsCupGameOpen] = useState(false);
  const [selectedCup, setSelectedCup] = useState<number | null>(null);
  const displayTitle = getVideoDisplayTitle(video, language);
  const displayDescription = (language === 'en' && video.descriptionEn) ? video.descriptionEn : (video.description || t.noDescription);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [localSubState, setLocalSubState] = useState({
      isSubscribed: initialIsSubscribed || false,
      subscribersCount: video.creator?.subscribersCount || 0
  });

  const [optimisticState, addOptimisticAction] = useOptimistic(
    {
        isLiked: (userId ? initialInteraction?.liked : false) || false,
        isDisliked: (userId ? initialInteraction?.disliked : false) || false,
        likesCount: video.likesCount || 0,
        dislikesCount: video.dislikesCount || 0,
        subscribersCount: localSubState.subscribersCount,
        isSubscribed: localSubState.isSubscribed
    },
    (state, action: 'LIKE' | 'DISLIKE' | { type: 'SUBSCRIBE', isSubscribed: boolean }) => {
      if (typeof action === 'string') {
        const wasLiked = state.isLiked;
        const wasDisliked = state.isDisliked;

        if (action === 'LIKE') {
          return {
            ...state,
            isLiked: !wasLiked,
            isDisliked: false,
            likesCount: wasLiked ? state.likesCount - 1 : state.likesCount + 1,
            dislikesCount: wasDisliked ? Math.max(0, state.dislikesCount - 1) : state.dislikesCount
          };
        } else {
          return {
            ...state,
            isLiked: false,
            isDisliked: !wasDisliked,
            likesCount: wasLiked ? Math.max(0, state.likesCount - 1) : state.likesCount,
            dislikesCount: wasDisliked ? state.dislikesCount - 1 : state.dislikesCount + 1
          };
        }
      } else if (action.type === 'SUBSCRIBE') {
        const wasSubscribed = state.isSubscribed;
        const nextSubscribed = action.isSubscribed;
        if (wasSubscribed === nextSubscribed) return state;

        return {
            ...state,
            isSubscribed: nextSubscribed,
            subscribersCount: nextSubscribed ? state.subscribersCount + 1 : Math.max(0, state.subscribersCount - 1)
        };
      }
      return state;
    }
  );

  const handleLike = async () => {
    if (!userId) return openSignIn();
    if (isPending) return;

    startTransition(async () => {
        try {
            logger.debug("[Hero] Toggling LIKE for video:", video.id);
            addOptimisticAction('LIKE');
            const result = await toggleVideoLike(video.id)  as { liked: boolean; disliked: boolean; error?: string; message?: string };

            if (result.error) {
                logger.error("[Hero] LIKE Action failed:", result.error, result.message);
                if (result.error === 'AUTH_REQUIRED') {
                    openSignIn();
                } else if (result.error === 'CLERK_ERROR') {
                    toast(`BŁĄD KONFIGURACJI CLERK: ${result.message}`, 'error');
                } else if (result.error === 'DATABASE_ERROR') {
                    toast(`BŁĄD BAZY DANYCH: ${result.message}`, 'error');
                } else {
                    toast(`BŁĄD: ${result.message || result.error}`, 'error');
                }
            } else {
                logger.debug("[Hero] LIKE Action success:", result);
            }
        } catch (error: unknown) {
            logger.error("[Hero] Transition error during LIKE:", error);
            toast("Błąd serwera podczas polubienia. Sprawdź połączenie.", 'error');
        }
    });
  };

  const handleShare = async () => {
    const shareData = {
      title: displayTitle,
      text: video.description || "",
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast(language === 'pl' ? "Link skopiowany do schowka!" : "Link copied to clipboard!", 'success');
      }
    } catch (err) {
      logger.error("Error sharing:", err);
    }
  };

  const handleDislike = async () => {
    if (!userId) return openSignIn();
    if (isPending) return;

    startTransition(async () => {
        try {
            logger.debug("[Hero] Toggling DISLIKE for video:", video.id);
            addOptimisticAction('DISLIKE');
            const result = await toggleVideoDislike(video.id)  as { liked: boolean; disliked: boolean; error?: string; message?: string };

            if (result.error) {
                logger.error("[Hero] DISLIKE Action failed:", result.error, result.message);
                if (result.error === 'AUTH_REQUIRED') {
                    openSignIn();
                } else if (result.error === 'CLERK_ERROR') {
                    toast(`BŁĄD KONFIGURACJI CLERK: ${result.message}`, 'error');
                } else if (result.error === 'DATABASE_ERROR') {
                    toast(`BŁĄD BAZY DANYCH: ${result.message}`, 'error');
                } else {
                    toast(`BŁĄD: ${result.message || result.error}`, 'error');
                }
            } else {
                logger.debug("[Hero] DISLIKE Action success:", result);
            }
        } catch (error: unknown) {
            logger.error("[Hero] Transition error during DISLIKE:", error);
            toast("Błąd serwera podczas oceny. Sprawdź połączenie.", 'error');
        }
    });
  };


  const openCupGame = () => {
    if (!userId) {
      openSignIn();
      return;
    }
    setIsCupGameOpen(true);
  };

  if (!mounted) return <PlayerSkeleton />;

  return (
    <section className="bg-transparent">
      <div className="w-full">
        {/* FEATURED MEDIA */}
        <div className="relative aspect-video w-full rounded-xl overflow-hidden shadow-sm border border-neutral-400 mb-3 group bg-black">
          <PremiumWrapper videoId={video.id} requiredTier={video.tier} isMainFeatured={video.isMainFeatured}>
            <VideoPlayer video={video} />
          </PremiumWrapper>
        </div>

        {/* INFO SECTION */}
        <div className="space-y-3 pt-3">
          <h2 className="text-[20px] font-bold text-[#0f0f0f] tracking-tight leading-[1.2]">
             {displayTitle}
          </h2>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 w-full lg:w-auto">
               <Link
                 href={video.creator?.slug ? `/channel/${video.creator.slug}` : "#"}
                 className="w-10 h-10 rounded-full bg-white border border-neutral-400 overflow-hidden shrink-0 hover:opacity-80 transition-opacity relative"
               >
                  <Image
                    src={video.creator?.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${video.creator?.name || MAIN_CREATOR_NAME}`}
                    alt={video.creator?.name || 'Creator'}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
               </Link>
               <div className="min-w-0 flex flex-col flex-1 lg:flex-none">
                  <Link
                    href={video.creator?.slug ? `/channel/${video.creator.slug}` : "#"}
                    className="font-bold text-[#0f0f0f] text-[16px] leading-tight truncate block hover:underline"
                  >
                    {video.creator?.name || 'Anonimowy Twórca'}
                  </Link>
                  <span className="text-[12px] text-[#606060] whitespace-nowrap">
                     {mounted ? formatCount(optimisticState.subscribersCount) : (video.creator?.subscribersCount || 0)} {t.subscribers}
                  </span>
               </div>
               <div className="ml-auto lg:ml-2 shrink-0">
                  <SubscribeButton
                    creatorId={video.creatorId}
                    creatorSlug={video.creator?.slug}
                    creatorName={video.creator?.name}
                    variant="compact"
                    initialIsSubscribed={localSubState.isSubscribed}
                    onStatusChange={(isSubscribed) => {
                        startTransition(() => {
                            addOptimisticAction({ type: 'SUBSCRIBE', isSubscribed });
                        });
                        // Also sync local state when the action actually completes
                        setLocalSubState(prev => ({
                            isSubscribed,
                            subscribersCount: isSubscribed ? prev.subscribersCount + 1 : Math.max(0, prev.subscribersCount - 1)
                        }));
                    }}
                  />
               </div>
            </div>

            <div className="flex items-center gap-2 w-full lg:w-auto">
               <div className="flex items-center bg-white rounded-full h-9 flex-[3] lg:flex-none overflow-hidden border border-neutral-400">
                  <button
                    onClick={handleLike}
                    disabled={isPending}
                    className={cn(
                        "flex items-center justify-center gap-2 pl-4 pr-3 h-full flex-1 hover:bg-neutral-100 transition-colors border-r border-neutral-400 relative active:bg-neutral-200",
                        optimisticState.isLiked && "text-blue-600",
                        isPending && "opacity-50"
                    )}
                    title="Lubię to"
                  >
                     <ThumbsUp size={18} className={cn(optimisticState.isLiked && "fill-blue-600")} />
                     <span className="text-[14px] font-bold">{optimisticState.likesCount.toLocaleString('pl-PL')}</span>
                  </button>
                  <button
                    onClick={handleDislike}
                    disabled={isPending}
                    className={cn(
                        "flex h-full w-12 flex-none items-center justify-center px-0 hover:bg-neutral-100 transition-colors active:bg-neutral-200",
                        optimisticState.isDisliked && "text-blue-600",
                        isPending && "opacity-50"
                    )}
                    title="Nie lubię"
                  >
                     <ThumbsDown size={18} className={cn("block", optimisticState.isDisliked && "fill-blue-600")} />
                  </button>
               </div>
                  <ShareButton
                    url={`${typeof window !== 'undefined' ? window.location.origin : ''}/channel/${video.creator?.slug || ''}?v=${video.slug}`}
                    title={displayTitle}
                    text={video.description || undefined}
                    className="flex-[2] lg:flex-none"
                  />
               <button
                 onClick={openCupGame}
                 className="w-9 h-9 flex items-center justify-center bg-white hover:bg-neutral-100 rounded-full transition-colors shrink-0 border border-neutral-400 active:scale-95"
                 aria-label={language === 'pl' ? 'Otwórz grę w trzy kubki' : 'Open shell game'}
               >
                  <MoreHorizontal size={16} />
               </button>
            </div>
          </div>
        </div>

        {/* DESCRIPTION BOX */}
        <div className="mt-2 bg-[#ebebeb] rounded-xl p-3 pt-1 transition-colors cursor-pointer border border-transparent hover:bg-[#e2e2e2]" onClick={() => setIsExpanded(!isExpanded)}>
           <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-1 items-baseline">
              <span className="text-[14px] font-semibold text-[#0f0f0f]">
                 {mounted ? video.views.toLocaleString(language === 'pl' ? 'pl-PL' : 'en-US') : video.views} {t.views}
              </span>
              <span className="text-[14px] font-semibold text-[#0f0f0f]">
                 {video.publishedAt ? new Date(video.publishedAt).toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : t.noDate}
              </span>
           </div>

           <div className="text-[14px] text-[#0f0f0f] leading-relaxed whitespace-pre-wrap">
              {isExpanded ? (
                displayDescription
              ) : (
                <>
                  {displayDescription.slice(0, 160).trim()}
                  {displayDescription.length > 160 && (
                    <span
                      className="text-[14px] font-semibold text-[#0f0f0f] ml-1 hover:underline cursor-pointer inline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(true);
                      }}
                    >
                      {t.showMore}
                    </span>
                  )}
                </>
              )}
           </div>

           {isExpanded && (
             <button
               className="text-[14px] font-semibold text-[#0f0f0f] mt-1 hover:underline inline-block"
               onClick={(e) => {
                 e.stopPropagation();
                 setIsExpanded(false);
               }}
             >
                {t.showLess}
             </button>
           )}
        </div>
      </div>

      {isCupGameOpen && (
        <ThreeCupsGame
          language={language}
          onClose={() => setIsCupGameOpen(false)}
        />
      )}
    </section>
  );
};

export default Hero;
