"use client";

import React, { useOptimistic, useState, useEffect, useTransition } from 'react';
import { PublicVideoDTO } from '../types/video';
import { ThumbsUp, ThumbsDown, Share2, MoreHorizontal } from './icons';
import { useAuth, useClerk } from '@clerk/nextjs';
import { cn, formatCount } from '@/lib/utils';
import PremiumWrapper from './PremiumWrapper';
import Link from 'next/link';
import Image from 'next/image';
import SubscribeButton from './SubscribeButton';
import VideoPlayer from './VideoPlayer';
import { toggleVideoLike, toggleVideoDislike } from '@/lib/actions/interactions';
import { useLanguage } from './LanguageContext';
import { logger } from '@/lib/logger';
import { getVideoDisplayTitle } from '@/lib/video-title-overrides';

interface HeroProps {
  video: PublicVideoDTO;
  initialInteraction?: { liked: boolean; disliked: boolean };
  initialIsSubscribed?: boolean;
}

const Hero: React.FC<HeroProps> = ({ video, initialInteraction, initialIsSubscribed }) => {
  const { t, language } = useLanguage();
  const { userId } = useAuth();
  const { openSignIn } = useClerk();
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(false);
  const displayTitle = getVideoDisplayTitle(video, language);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [optimisticState, addOptimisticAction] = useOptimistic(
    {
        isLiked: (userId ? initialInteraction?.liked : false) || false,
        isDisliked: (userId ? initialInteraction?.disliked : false) || false,
        likesCount: video.likesCount || 0,
        dislikesCount: video.dislikesCount || 0
    },
    (state, action: 'LIKE' | 'DISLIKE') => {
      if (action === 'LIKE') {
        const wasLiked = state.isLiked;
        const wasDisliked = state.isDisliked;
        return {
          isLiked: !wasLiked,
          isDisliked: false,
          likesCount: wasLiked ? state.likesCount - 1 : state.likesCount + 1,
          dislikesCount: wasDisliked ? state.dislikesCount - 1 : state.dislikesCount
        };
      } else {
        const wasLiked = state.isLiked;
        const wasDisliked = state.isDisliked;
        return {
          isLiked: false,
          isDisliked: !wasDisliked,
          likesCount: wasLiked ? state.likesCount - 1 : state.likesCount,
          dislikesCount: wasDisliked ? state.dislikesCount - 1 : state.dislikesCount + 1
        };
      }
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
                console.error("[Hero] LIKE Action failed:", result.error, result.message);
                if (result.error === 'AUTH_REQUIRED') {
                    openSignIn();
                } else if (result.error === 'CLERK_ERROR') {
                    alert(`BŁĄD KONFIGURACJI CLERK:\n\n${result.message}\n\nSprawdź klucze API w Vercel.`);
                } else if (result.error === 'DATABASE_ERROR') {
                    alert(`BŁĄD BAZY DANYCH:\n\n${result.message}\n\nJeśli problem nadal występuje, spróbuj uruchomić:\n'npx prisma db push --force'`);
                } else {
                    alert(`BŁĄD: ${result.message || result.error}\n\nSprawdź logi Vercela lub konsolę przeglądarki.`);
                }
            } else {
                logger.debug("[Hero] LIKE Action success:", result);
            }
        } catch (error: unknown) {
            console.error("[Hero] Transition error during LIKE:", error);
            alert("Błąd serwera podczas polubienia. Sprawdź połączenie.");
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
        alert(language === 'pl' ? "Link skopiowany do schowka!" : "Link copied to clipboard!");
      }
    } catch (err) {
      console.error("Error sharing:", err);
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
                console.error("[Hero] DISLIKE Action failed:", result.error, result.message);
                if (result.error === 'AUTH_REQUIRED') {
                    openSignIn();
                } else if (result.error === 'CLERK_ERROR') {
                    alert(`BŁĄD KONFIGURACJI CLERK:\n\n${result.message}\n\nSprawdź klucze API w Vercel.`);
                } else if (result.error === 'DATABASE_ERROR') {
                    alert(`BŁĄD BAZY DANYCH:\n\n${result.message}\n\nJeśli problem nadal występuje, spróbuj uruchomić:\n'npx prisma db push --force'`);
                } else {
                    alert(`BŁĄD: ${result.message || result.error}\n\nSprawdź logi Vercela lub konsolę przeglądarki.`);
                }
            } else {
                logger.debug("[Hero] DISLIKE Action success:", result);
            }
        } catch (error: unknown) {
            console.error("[Hero] Transition error during DISLIKE:", error);
            alert("Błąd serwera podczas oceny. Sprawdź połączenie.");
        }
    });
  };

  if (!mounted) return (
      <div className="w-full aspect-video bg-black rounded-xl animate-pulse" />
  );

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
                    src={video.creator?.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${video.creator?.name || 'PAWEŁ PERFECT'}`}
                    alt={video.creator?.name || 'Creator'}
                    fill
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
                     {mounted ? formatCount(video.creator?.subscribersCount || 0) : (video.creator?.subscribersCount || 0)} {t.subscribers}
                  </span>
               </div>
               <SubscribeButton
                 creatorId={video.creatorId}
                 initialSubscribersCount={video.creator?.subscribersCount || 0}
                 initialIsSubscribed={initialIsSubscribed}
                 className="flex-1 lg:flex-none"
               />
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
                        optimisticState.isDisliked && "text-red-600",
                        isPending && "opacity-50"
                    )}
                    title="Nie lubię"
                  >
                     <ThumbsDown size={18} className={cn("block", optimisticState.isDisliked && "fill-red-600")} />
                  </button>
               </div>
               <button
                 onClick={handleShare}
                 className="flex items-center justify-center gap-2 px-4 h-9 bg-white hover:bg-neutral-100 rounded-full transition-colors flex-[2] lg:flex-none border border-neutral-400 active:scale-95"
               >
                  <Share2 size={16} />
                  <span className="text-[13px] font-bold">{t.share}</span>
               </button>
               <button className="w-9 h-9 flex items-center justify-center bg-white hover:bg-neutral-100 rounded-full transition-colors shrink-0 border border-neutral-400 active:scale-95">
                  <MoreHorizontal size={16} />
               </button>
            </div>
          </div>
        </div>

        {/* DESCRIPTION BOX */}
        <div className="mt-3 bg-[#ebebeb] rounded-xl p-4 transition-colors cursor-pointer border border-transparent hover:bg-[#e2e2e2]" onClick={() => setIsExpanded(!isExpanded)}>
           <div className="flex flex-wrap gap-x-2 gap-y-1 mb-1">
              <span className="text-[14px] font-semibold text-[#0f0f0f]">
                 {mounted ? video.views.toLocaleString(language === 'pl' ? 'pl-PL' : 'en-US') : video.views} {t.views}
              </span>
              <span className="text-[14px] font-semibold text-[#0f0f0f]">
                 {video.publishedAt ? new Date(video.publishedAt).toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : t.noDate}
              </span>
           </div>

           <div className="text-[14px] text-[#0f0f0f] leading-relaxed whitespace-pre-wrap">
              {isExpanded ? (
                (video.description || t.noDescription)
              ) : (
                <>
                  {(video.description || t.noDescription).slice(0, 160).trim()}
                  {(video.description || t.noDescription).length > 160 && (
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
    </section>
  );
};

export default Hero;
