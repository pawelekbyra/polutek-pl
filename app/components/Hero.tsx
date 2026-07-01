"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { PublicVideoDTO } from '../types/video';
import { useAuth, useClerk } from '@clerk/nextjs';
import { cn, formatCount } from '@/lib/utils';
import PremiumWrapper from './PremiumWrapper';
import Link from 'next/link';
import Image from 'next/image';
import VideoPlayer from './VideoPlayer';
import { toggleVideoLike, toggleVideoDislike } from '@/lib/actions/interactions';
import { useLanguage } from './LanguageContext';
import { useToast } from '@/app/hooks/useToast';
import { logger } from '@/lib/logger';
import { getVideoDisplayTitle } from '@/lib/video-title-overrides';
import SubscribeButton from './SubscribeButton';
import ShareButton from './ShareButton';
import { MAIN_CREATOR_NAME } from '@/lib/constants';
import { Frame, NajsIcon, INK, BLUE, YELLOW, MarkerLine } from './najs/primitives';

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
  const displayTitle = getVideoDisplayTitle(video, language);
  const [localViewsCount, setLocalViewsCount] = useState(video.views || 0);
  const displayDescription = (language === 'en' && video.descriptionEn) ? video.descriptionEn : (video.description || t.noDescription);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setLocalViewsCount(video.views || 0);
  }, [video.id, video.views]);

  const [localSubState, setLocalSubState] = useState({
      isSubscribed: initialIsSubscribed || false,
      subscribersCount: video.creator?.subscribersCount || 0
  });

  useEffect(() => {
      setLocalSubState({
          isSubscribed: initialIsSubscribed || false,
          subscribersCount: video.creator?.subscribersCount || 0
      });
  }, [video.id, initialIsSubscribed, video.creator?.subscribersCount]);

  const [interactionState, setInteractionState] = useState({
    isLiked: (userId ? initialInteraction?.liked : false) || false,
    isDisliked: (userId ? initialInteraction?.disliked : false) || false,
    likesCount: video.likesCount || 0,
    dislikesCount: video.dislikesCount || 0,
  });

  useEffect(() => {
    setInteractionState({
      isLiked: (userId ? initialInteraction?.liked : false) || false,
      isDisliked: (userId ? initialInteraction?.disliked : false) || false,
      likesCount: video.likesCount || 0,
      dislikesCount: video.dislikesCount || 0,
    });
  }, [video.id, userId, initialInteraction?.liked, initialInteraction?.disliked, video.likesCount, video.dislikesCount]);

  const handleLike = async () => {
    if (!userId) return openSignIn();
    if (isPending) return;

    startTransition(async () => {
        try {
            logger.debug("[Hero] Toggling LIKE for video:", video.id);
            const result = await toggleVideoLike(video.id) as { liked: boolean; disliked: boolean; likesCount: number; dislikesCount: number; error?: string; message?: string };

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
                setInteractionState({
                    isLiked: result.liked,
                    isDisliked: result.disliked,
                    likesCount: result.likesCount,
                    dislikesCount: result.dislikesCount,
                });
                logger.debug("[Hero] LIKE Action success:", result);
            }
        } catch (error: unknown) {
            logger.error("[Hero] Transition error during LIKE:", error);
            toast("Błąd serwera podczas polubienia. Sprawdź połączenie.", 'error');
        }
    });
  };

  const handleDislike = async () => {
    if (!userId) return openSignIn();
    if (isPending) return;

    startTransition(async () => {
        try {
            logger.debug("[Hero] Toggling DISLIKE for video:", video.id);
            const result = await toggleVideoDislike(video.id) as { liked: boolean; disliked: boolean; likesCount: number; dislikesCount: number; error?: string; message?: string };

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
                setInteractionState({
                    isLiked: result.liked,
                    isDisliked: result.disliked,
                    likesCount: result.likesCount,
                    dislikesCount: result.dislikesCount,
                });
                logger.debug("[Hero] DISLIKE Action success:", result);
            }
        } catch (error: unknown) {
            logger.error("[Hero] Transition error during DISLIKE:", error);
            toast("Błąd serwera podczas oceny. Sprawdź połączenie.", 'error');
        }
    });
  };

  return (
    <section className="bg-transparent">
      <div className="w-full">
        {/* FEATURED MEDIA */}
        <div className="relative aspect-video w-full mb-[18px] group">
          <Frame radius={14} seed={7} stroke={INK} strokeWidth={1.5} />
          <div
            className="absolute -top-[8px] -right-[4px] z-20 text-[8px] font-black uppercase tracking-[0.12em] px-[7px] py-[2px] leading-none"
            style={{ background: YELLOW, color: INK, transform: "rotate(3deg)", boxShadow: `1.5px 1.5px 0 ${INK}`, fontFamily: "var(--font-najs, Kalam, cursive)" }}
            aria-hidden="true"
          >
            video
          </div>
          <div className="absolute inset-0 overflow-hidden rounded-[12px] bg-black">
            <PremiumWrapper videoId={video.id} requiredTier={video.tier} isMainFeatured={video.isMainFeatured}>
              <VideoPlayer video={video} onViewCounted={() => setLocalViewsCount((views) => views + 1)} />
            </PremiumWrapper>
          </div>
        </div>

        {/* INFO SECTION */}
        <div className="space-y-3">
          <div className="mb-[14px]">
            <h1 className="font-bold text-[23px] text-[#0f0f0f] leading-[1.25]" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
              {displayTitle}
            </h1>
            <MarkerLine color={BLUE} className="mt-[3px] max-w-[60%]" />
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-[14px]">
            <div className="flex w-full items-center gap-[13px] min-w-0 lg:w-auto">
               <Link
                 href={video.creator?.slug ? `/channel/${video.creator.slug}` : "#"}
                 className="w-[46px] h-[46px] rounded-full bg-gradient-to-br from-[#2f2c27] to-[#4a463f] border border-input overflow-hidden shrink-0 hover:opacity-80 transition-opacity relative"
               >
                  <Image
                    src={video.creator?.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${video.creator?.name || MAIN_CREATOR_NAME}`}
                    alt={video.creator?.name || 'Creator'}
                    fill
                    sizes="46px"
                    className="object-cover"
                  />
               </Link>
               <div className="min-w-0 flex flex-col">
                  <Link
                    href={video.creator?.slug ? `/channel/${video.creator.slug}` : "#"}
                    className="font-bold text-[#0f0f0f] text-[15.5px] leading-[1.2] truncate block"
                  >
                    {video.creator?.name || MAIN_CREATOR_NAME}
                  </Link>
                  <span className="text-[12.5px] text-muted-foreground mt-[1px]">
                     {mounted ? formatCount(localSubState.subscribersCount) : (video.creator?.subscribersCount || 0)} {t.subscribers}
                  </span>
               </div>
               <div className="ml-auto shrink-0 lg:ml-[6px]">
                  <SubscribeButton
                    creatorId={video.creatorId}
                    creatorSlug={video.creator?.slug}
                    creatorName={video.creator?.name}
                    variant="compact"
                    gold
                    initialIsSubscribed={localSubState.isSubscribed}
                    onStatusChange={(isSubscribed: boolean, subscribersCount?: number) => {
                        setLocalSubState(prev => ({
                            isSubscribed,
                            subscribersCount: subscribersCount ?? (isSubscribed ? prev.subscribersCount + 1 : Math.max(0, prev.subscribersCount - 1))
                        }));
                    }}
                  />
               </div>
            </div>

            <div className="flex w-full items-center gap-[9px] lg:w-auto">
               <div className="relative flex h-[38px] flex-1 items-center lg:flex-none">
                  <Frame radius={20} seed={23} stroke={INK} strokeWidth={1.2} fill="rgba(248,243,231,.88)" />
                  <button
                    onClick={handleLike}
                    disabled={isPending}
                    className={cn(
                        "relative flex h-full flex-1 min-w-0 items-center justify-center gap-2 px-4 transition-colors active:opacity-70 lg:flex-none lg:pl-5 lg:pr-4",
                        interactionState.isLiked ? "text-primary" : "text-[#171717]",
                        isPending && "opacity-50"
                    )}
                    title="Lubię to"
                  >
                     <NajsIcon name="like" className="h-[18px] w-[18px]" stroke={interactionState.isLiked ? "#2563eb" : INK} />
                     <span className="text-[14px] font-bold" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>{interactionState.likesCount.toLocaleString('pl-PL')}</span>
                  </button>
                  <span className="relative h-5 w-px bg-neutral-900/20" />
                  <button
                    onClick={handleDislike}
                    disabled={isPending}
                    className={cn(
                        "relative flex h-full flex-1 min-w-0 items-center justify-center gap-2 px-4 transition-colors active:opacity-70 lg:flex-none",
                        interactionState.isDisliked ? "text-primary" : "text-[#171717]",
                        isPending && "opacity-50"
                    )}
                    title="Nie lubię"
                  >
                     <NajsIcon name="dislike" className="h-[18px] w-[18px]" stroke={interactionState.isDisliked ? "#2563eb" : INK} />
                     <span className="text-[14px] font-bold" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>{interactionState.dislikesCount.toLocaleString('pl-PL')}</span>
                  </button>
               </div>
                  <ShareButton
                    url={`${typeof window !== 'undefined' ? window.location.origin : ''}/channel/${video.creator?.slug || ''}?v=${video.slug}`}
                    title={displayTitle}
                    text={video.description || undefined}
                  />
               <button
                 type="button"
                 className="relative w-[38px] h-[38px] flex items-center justify-center shrink-0 active:scale-95"
                 aria-label="Menu"
               >
                  <Frame radius={20} seed={31} stroke={INK} strokeWidth={1.2} fill="rgba(248,243,231,.88)" />
                  <NajsIcon name="more" className="relative h-[18px] w-[18px]" stroke={INK} />
               </button>
            </div>
          </div>
        </div>

        {/* DESCRIPTION BOX */}
        <div className="relative mt-[16px] p-[14px] cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
           <Frame radius={14} seed={11} stroke={INK} strokeWidth={1.2} fill="rgba(248,243,231,.95)" />
           <div className="absolute top-[6px] left-[6px] bottom-[6px] w-[3px] rounded-full overflow-hidden" aria-hidden="true">
             <div className="h-full w-full" style={{ background: `linear-gradient(to bottom, ${YELLOW}, ${BLUE})`, opacity: 0.55 }} />
           </div>
           <div className="relative z-10">
             <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-[7px] items-baseline">
                <span className="text-[13.5px] font-bold text-[#0f0f0f]" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
                   {mounted ? localViewsCount.toLocaleString(language === 'pl' ? 'pl-PL' : 'en-US') : localViewsCount} {t.views}
                </span>
                <span className="text-[13.5px] font-bold text-[#0f0f0f]" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
                   · {video.publishedAt ? new Date(video.publishedAt).toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : t.noDate}
                </span>
             </div>

             <div className="text-[13.5px] text-[#0f0f0f] leading-[1.6] whitespace-pre-wrap">
                {isExpanded ? (
                  displayDescription
                ) : (
                  <>
                    {displayDescription.slice(0, 160).trim()}
                    {displayDescription.length > 160 && (
                      <span
                        className="text-[13.5px] font-bold text-[#0f0f0f] ml-1 hover:underline cursor-pointer inline"
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
                 className="text-[13.5px] font-bold text-[#0f0f0f] mt-1 hover:underline inline-block"
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
      </div>
    </section>
  );
};

export default Hero;