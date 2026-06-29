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

interface HeroProps {
  video: PublicVideoDTO;
  initialInteraction?: { liked: boolean; disliked: boolean };
  initialIsSubscribed?: boolean;
}

const NajsThumbsUp = ({ size = 18, filled = false, className }: { size?: number; filled?: boolean; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("najs-pen-icon", className)}
    aria-hidden="true"
  >
    {filled && (
      <path
        d="M9.05 10.1c1.45-.95 2.28-2.23 2.78-4.3.18-.73.67-1.08 1.23-.85.85.36 1.18 1.7.95 3.1-.08.48-.2.95-.33 1.4h3.55c1.38 0 2.15.72 2.05 1.88-.08.87-.42 1.4-.95 1.68.28.37.35.96.16 1.55-.16.52-.5.91-.94 1.12.15.44.05.98-.25 1.42-.36.52-.91.79-1.57.79h-6.7V10.1Z"
        fill="currentColor"
        opacity="0.12"
      />
    )}
    <path
      d="M8.75 10.15c1.47-.98 2.42-2.2 2.9-4.18.18-.76.62-1.22 1.14-1.08.75.2 1.25 1.45 1.05 2.82-.07.54-.22 1.05-.4 1.58-.08.23.08.47.33.47h3.44c1.28 0 2.05.67 1.98 1.66-.05.68-.38 1.15-.92 1.43.4.37.47.98.27 1.54-.17.5-.54.83-1.05 1.01.18.41.1.93-.19 1.33-.34.49-.89.73-1.55.73H8.75"
      stroke="currentColor"
      strokeWidth="1.55"
    />
    <path
      d="M4.62 9.58h3.3c.41 0 .73.32.73.73v7.18c0 .43-.31.76-.72.76H4.69c-.41 0-.69-.32-.69-.73v-7.2c0-.41.25-.7.62-.74Z"
      stroke="currentColor"
      strokeWidth="1.55"
    />
    <path
      d="M6.42 12.2h.05"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

const NajsThumbsDown = ({ size = 18, filled = false, className }: { size?: number; filled?: boolean; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("najs-pen-icon", className)}
    aria-hidden="true"
  >
    {filled && (
      <path
        d="M9.05 13.9c1.45.95 2.28 2.23 2.78 4.3.18.73.67 1.08 1.23.85.85-.36 1.18-1.7.95-3.1-.08-.48-.2-.95-.33-1.4h3.55c1.38 0 2.15-.72 2.05-1.88-.08-.87-.42-1.4-.95-1.68.28-.37.35-.96.16-1.55-.16-.52-.5-.91-.94-1.12.15-.44.05-.98-.25-1.42-.36-.52-.91-.79-1.57-.79h-6.7v7.79Z"
        fill="currentColor"
        opacity="0.12"
      />
    )}
    <path
      d="M8.75 13.85c1.47.98 2.42 2.2 2.9 4.18.18.76.62 1.22 1.14 1.08.75-.2 1.25-1.45 1.05-2.82-.07-.54-.22-1.05-.4-1.58-.08-.23.08-.47.33-.47h3.44c1.28 0 2.05-.67 1.98-1.66-.05-.68-.38-1.15-.92-1.43.4-.37.47-.98.27-1.54-.17-.5-.54-.83-1.05-1.01.18-.41.1-.93-.19-1.33-.34-.49-.89-.73-1.55-.73H8.75"
      stroke="currentColor"
      strokeWidth="1.55"
    />
    <path
      d="M4.62 14.42h3.3c.41 0 .73-.32.73-.73V6.51c0-.43-.31-.76-.72-.76H4.69c-.41 0-.69.32-.69.73v7.2c0 .41.25.7.62.74Z"
      stroke="currentColor"
      strokeWidth="1.55"
    />
    <path
      d="M6.42 11.8h.05"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

const NajsMoreHorizontal = ({ size = 18, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("najs-pen-icon", className)}
    aria-hidden="true"
  >
    <path d="M6.1 12.1h.05" stroke="currentColor" strokeWidth="2.2" />
    <path d="M12 11.9h.05" stroke="currentColor" strokeWidth="2.2" />
    <path d="M17.9 12.05h.05" stroke="currentColor" strokeWidth="2.2" />
  </svg>
);

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
        <div className="relative aspect-video w-full rounded-[14px] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.06)] border border-[#322f2b] mb-[18px] group bg-black">
          <PremiumWrapper videoId={video.id} requiredTier={video.tier} isMainFeatured={video.isMainFeatured}>
            <VideoPlayer video={video} onViewCounted={() => setLocalViewsCount((views) => views + 1)} />
          </PremiumWrapper>
        </div>

        {/* INFO SECTION */}
        <div className="space-y-3">
          <h1 className="font-heading font-bold text-[23px] text-[#0f0f0f] tracking-[-0.01em] leading-[1.25] mb-[14px]">
             {displayTitle}
          </h1>

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
               <div className="najs-action-button flex h-[38px] flex-1 items-center overflow-hidden rounded-full border border-input bg-white lg:flex-none">
                  <button
                    onClick={handleLike}
                    disabled={isPending}
                    className={cn(
                        "flex h-full flex-1 min-w-0 items-center justify-center gap-2 px-4 hover:bg-secondary transition-colors border-r border-[#E4E0D6] relative active:bg-secondary/80 lg:flex-none lg:pl-5 lg:pr-4",
                        interactionState.isLiked ? "text-primary" : "text-[#171717]",
                        isPending && "opacity-50"
                    )}
                    title="Lubię to"
                  >
                     <NajsThumbsUp size={19} filled={interactionState.isLiked} />
                     <span className="text-[14px] font-bold">{interactionState.likesCount.toLocaleString('pl-PL')}</span>
                  </button>
                  <button
                    onClick={handleDislike}
                    disabled={isPending}
                    className={cn(
                        "flex h-full flex-1 min-w-0 items-center justify-center gap-2 px-4 hover:bg-secondary transition-colors active:bg-secondary/80 lg:flex-none",
                        interactionState.isDisliked ? "text-primary" : "text-[#171717]",
                        isPending && "opacity-50"
                    )}
                    title="Nie lubię"
                  >
                     <NajsThumbsDown size={19} filled={interactionState.isDisliked} />
                     <span className="text-[14px] font-bold">{interactionState.dislikesCount.toLocaleString('pl-PL')}</span>
                  </button>
               </div>
                  <ShareButton
                    url={`${typeof window !== 'undefined' ? window.location.origin : ''}/channel/${video.creator?.slug || ''}?v=${video.slug}`}
                    title={displayTitle}
                    text={video.description || undefined}
                  />
               <button
                 type="button"
                 className="najs-action-button w-[38px] h-[38px] flex items-center justify-center bg-white hover:bg-secondary rounded-full transition-colors shrink-0 border border-input active:scale-95"
                 aria-label="Menu"
               >
                  <NajsMoreHorizontal size={19} className="text-[#171717]" />
               </button>
            </div>
          </div>
        </div>

        {/* DESCRIPTION BOX */}
        <div className="mt-[16px] bg-secondary rounded-[14px] p-[14px] pt-[14px] transition-colors cursor-pointer border border-border hover:bg-secondary/80" onClick={() => setIsExpanded(!isExpanded)}>
           <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-[7px] items-baseline">
              <span className="text-[13.5px] font-bold text-[#0f0f0f]">
                 {mounted ? localViewsCount.toLocaleString(language === 'pl' ? 'pl-PL' : 'en-US') : localViewsCount} {t.views}
              </span>
              <span className="text-[13.5px] font-bold text-[#0f0f0f]">
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
    </section>
  );
};

export default Hero;