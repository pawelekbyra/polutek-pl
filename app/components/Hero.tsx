"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { PublicVideoDTO } from '../types/video';
import { useAuth } from '@clerk/nextjs';
import { useAuthModal } from './auth/AuthModalProvider';
import { cn, formatCount } from '@/lib/utils';
import PremiumWrapper from './PremiumWrapper';
import Link from 'next/link';
import Image from 'next/image';
import VideoPlayer from './VideoPlayer';
import { toggleVideoLike, toggleVideoDislike } from '@/lib/actions/interactions';
import { getLocalizedHref } from "@/lib/i18n/routing";
import { useLanguage } from './LanguageContext';
import { useToast } from '@/app/hooks/useToast';
import { logger } from '@/lib/logger';
import { getVideoDisplayTitle } from '@/lib/video-title-overrides';
import SubscribeButton from './SubscribeButton';
import ShareButton from './ShareButton';
import InstallAppMenu from './InstallAppMenu';
import { MAIN_CREATOR_NAME } from '@/lib/constants';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import styles from './watch-actions.module.css';

interface HeroProps {
  video: PublicVideoDTO;
  initialInteraction?: { liked: boolean; disliked: boolean };
  initialIsSubscribed?: boolean;
}

const Hero: React.FC<HeroProps> = ({ video, initialInteraction, initialIsSubscribed }) => {
  const { t, language } = useLanguage();
  const toast = useToast();
  const { userId } = useAuth();
  const { open: openAuthModal } = useAuthModal();
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
    if (!userId) return openAuthModal("sign-in");
    if (isPending) return;

    const previousState = interactionState;
    const nextIsLiked = !previousState.isLiked;
    // Optimistic update: reflect the click immediately, reconcile with the server after.
    setInteractionState({
        isLiked: nextIsLiked,
        isDisliked: nextIsLiked ? false : previousState.isDisliked,
        likesCount: Math.max(0, previousState.likesCount + (nextIsLiked ? 1 : -1)),
        dislikesCount: nextIsLiked && previousState.isDisliked ? Math.max(0, previousState.dislikesCount - 1) : previousState.dislikesCount,
    });

    startTransition(async () => {
        try {
            logger.debug("[Hero] Toggling LIKE for video:", video.id);
            const result = await toggleVideoLike(video.id) as { liked: boolean; disliked: boolean; likesCount: number; dislikesCount: number; error?: string; message?: string };

            if (result.error) {
                logger.error("[Hero] LIKE Action failed:", result.error, result.message);
                setInteractionState(previousState);
                if (result.error === 'AUTH_REQUIRED') {
                    openAuthModal("sign-in");
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
            setInteractionState(previousState);
            toast("Błąd serwera podczas polubienia. Sprawdź połączenie.", 'error');
        }
    });
  };

  const handleDislike = async () => {
    if (!userId) return openAuthModal("sign-in");
    if (isPending) return;

    const previousState = interactionState;
    const nextIsDisliked = !previousState.isDisliked;
    // Optimistic update: reflect the click immediately, reconcile with the server after.
    setInteractionState({
        isDisliked: nextIsDisliked,
        isLiked: nextIsDisliked ? false : previousState.isLiked,
        dislikesCount: Math.max(0, previousState.dislikesCount + (nextIsDisliked ? 1 : -1)),
        likesCount: nextIsDisliked && previousState.isLiked ? Math.max(0, previousState.likesCount - 1) : previousState.likesCount,
    });

    startTransition(async () => {
        try {
            logger.debug("[Hero] Toggling DISLIKE for video:", video.id);
            const result = await toggleVideoDislike(video.id) as { liked: boolean; disliked: boolean; likesCount: number; dislikesCount: number; error?: string; message?: string };

            if (result.error) {
                logger.error("[Hero] DISLIKE Action failed:", result.error, result.message);
                setInteractionState(previousState);
                if (result.error === 'AUTH_REQUIRED') {
                    openAuthModal("sign-in");
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
            setInteractionState(previousState);
            toast("Błąd serwera podczas oceny. Sprawdź połączenie.", 'error');
        }
    });
  };

  return (
    <section className="bg-transparent">
      <div className="w-full rounded-xl border border-[var(--chan-line)] bg-white p-2.5 shadow-sm md:p-3">
        {/* FEATURED MEDIA */}
        <div className="relative mb-4 aspect-video w-full overflow-hidden rounded-lg bg-black">
          <PremiumWrapper videoId={video.id} requiredTier={video.tier} isMainFeatured={video.isMainFeatured}>
            <VideoPlayer video={video} onViewCounted={() => setLocalViewsCount((views) => views + 1)} />
          </PremiumWrapper>
        </div>

        {/* INFO SECTION */}
        <div className="space-y-3 px-1 pb-1 md:px-2">
          <h1 className="font-brand font-bold not-italic text-[22px] md:text-[28px] text-[var(--chan-ink)] leading-[1.25] mb-2">
             {displayTitle}
          </h1>

          <div className={cn("flex flex-col justify-between gap-2 lg:flex-row lg:items-center", styles.metaRow)}>
            <div className={cn("flex w-full items-center gap-[13px] min-w-0 lg:w-auto", styles.creatorStrip)}>
               <Link
                 href={video.creator?.slug ? getLocalizedHref(language, "channel", { slug: video.creator.slug }) : "#"}
                 className="w-[46px] h-[46px] rounded-full bg-[var(--chan-avatar-gradient)] overflow-hidden shrink-0 hover:opacity-85 transition-opacity relative"
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
                    href={video.creator?.slug ? getLocalizedHref(language, "channel", { slug: video.creator.slug }) : "#"}
                    className="font-brand font-bold text-[var(--chan-ink)] text-[15px] leading-[1.2] truncate block"
                  >
                    {video.creator?.name || MAIN_CREATOR_NAME}
                  </Link>
                  <span className="text-[12.5px] text-[var(--chan-muted)] mt-[1px]">
                     {mounted ? formatCount(localSubState.subscribersCount) : (video.creator?.subscribersCount || 0)} {t.subscribers}
                  </span>
               </div>
               <div className="ml-auto shrink-0 lg:ml-[6px]">
                  <SubscribeButton
                    creatorId={video.creatorId}
                    creatorSlug={video.creator?.slug}
                    creatorName={video.creator?.name}
                    variant="compact"
                    className={styles.subscribeAction}
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

            <div className={cn("flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap", styles.actionRail)}>
               <div className={cn("relative flex h-[42px] shrink-0 items-center rounded-[12px] bg-[var(--chan-surface)]", styles.actionCluster)}>
                  <button
                    onClick={handleLike}
                    disabled={isPending}
                    className={cn(
                        "flex h-full items-center justify-center gap-1.5 px-3 font-sans transition-colors active:opacity-70 lg:px-4",
                        styles.actionButton,
                        interactionState.isLiked ? "text-[#2563eb]" : "text-[var(--chan-ink)]",
                        isPending && "opacity-50"
                    )}
                    title="Lubię to"
                    aria-label="Lubię to"
                  >
                     <ThumbsUp className="h-5 w-5 shrink-0" strokeWidth={1.8} color={interactionState.isLiked ? "#2563eb" : "var(--chan-ink)"} />
                     <span className="text-[12px] font-bold">{interactionState.likesCount.toLocaleString(language === 'pl' ? 'pl-PL' : 'en-US')}</span>
                  </button>
                  <span className="h-5 w-px bg-[var(--chan-line-soft)]" />
                  <button
                    onClick={handleDislike}
                    disabled={isPending}
                    className={cn(
                        "flex h-full items-center justify-center px-4 transition-colors active:opacity-70",
                        styles.actionButton,
                        interactionState.isDisliked ? "text-[#2563eb]" : "text-[var(--chan-ink)]",
                        isPending && "opacity-50"
                    )}
                    title="Nie lubię"
                    aria-label="Nie lubię"
                  >
                     <ThumbsDown className="h-5 w-5 shrink-0" strokeWidth={1.8} color={interactionState.isDisliked ? "#2563eb" : "var(--chan-ink)"} />
                  </button>
               </div>
               <ShareButton
                 url={typeof window !== 'undefined' ? `${window.location.origin}/?v=${encodeURIComponent(video.slug)}` : ''}
                 title={displayTitle}
                 text={video.description || undefined}
                 className={styles.secondaryAction}
                 fill
               />
               <InstallAppMenu className={styles.installAction} />
            </div>
          </div>
        </div>

        {/* DESCRIPTION PANEL */}
        <div
          className={cn("mt-2 cursor-pointer rounded-lg border px-4 pt-[9px] pb-3 transition-colors hover:border-[#2563eb]/40 md:px-5", styles.descPanel)}
          onClick={() => setIsExpanded(!isExpanded)}
        >
           <div>
             <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-1.5 items-baseline">
                <span className="font-sans text-[12px] font-bold not-italic text-[var(--chan-ink)]">
                   {mounted ? localViewsCount.toLocaleString(language === 'pl' ? 'pl-PL' : 'en-US') : localViewsCount} {t.views}
                </span>
                <span className="font-sans text-[12px] font-bold not-italic text-[var(--chan-ink)]">
                   · {video.publishedAt ? new Date(video.publishedAt).toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : t.noDate}
                </span>
             </div>

             <div className="text-[12px] text-[var(--chan-body)] leading-[1.5] whitespace-pre-wrap">
                {isExpanded ? (
                  displayDescription
                ) : (
                  <>
                    {displayDescription.slice(0, 160).trim()}
                    {displayDescription.length > 160 && (
                      <span
                        className="text-[12px] font-bold text-[var(--chan-ink)] ml-1 hover:underline cursor-pointer inline"
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
                 className="text-[12px] font-bold text-[var(--chan-ink)] mt-1 hover:underline inline-block"
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
