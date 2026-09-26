"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { PublicVideoDTO } from '../types/video';
import { useAuth } from '@clerk/nextjs';
import { useAuthModal } from './auth/AuthModalProvider';
import { cn, formatCount } from '@/lib/utils';
import PremiumWrapper from './PremiumWrapper';
import Link from 'next/link';
import VideoPlayer from './VideoPlayer';
import { SafeAvatar } from './SafeAvatar';
import { toggleVideoLike, toggleVideoDislike } from '@/lib/actions/interactions';
import { getLocalizedHref } from "@/lib/i18n/routing";
import { useLanguage } from './LanguageContext';
import { useToast } from '@/app/hooks/useToast';
import { logger } from '@/lib/logger';
import { getVideoDisplayTitle } from '@/lib/video-title-overrides';
import SubscribeButton from './SubscribeButton';
import ShareButton from './ShareButton';
import { MAIN_CREATOR_NAME } from '@/lib/constants';
import { ThumbsUp, ThumbsDown, Coins } from 'lucide-react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  const subscribersCount = mounted ? localSubState.subscribersCount : (video.creator?.subscribersCount || 0);
  const subscribersLabel = subscribersCount === 1 ? t.subscribersOne : t.subscribers;

  const [interactionState, setInteractionState] = useState({
    isLiked: (userId ? initialInteraction?.liked : false) || false,
    isDisliked: (userId ? initialInteraction?.disliked : false) || false,
    likesCount: video.likesCount || 0,
    dislikesCount: video.dislikesCount || 0,
  });
  // Brief "pop" on the icon right after a like/dislike click lands, kept separate
  // from interactionState.isLiked/isDisliked so it never replays on mount or on
  // unrelated re-renders — only on the user's own action, and only for the
  // "on" direction (liking, not un-liking).
  const [likePulse, setLikePulse] = useState(false);
  const [dislikePulse, setDislikePulse] = useState(false);

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
    if (nextIsLiked) {
        setLikePulse(true);
        window.setTimeout(() => setLikePulse(false), 320);
    }
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
    if (nextIsDisliked) {
        setDislikePulse(true);
        window.setTimeout(() => setDislikePulse(false), 320);
    }
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
      <div className="w-full lg:rounded-[26px] lg:border lg:border-[var(--cm-line-80)] lg:bg-[var(--cm-card-92-white)] lg:p-3 lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_6px_rgba(23,23,23,0.03),0_30px_60px_-26px_rgba(23,23,23,0.24)]">
        {/* FEATURED MEDIA — full-bleed edge-to-edge on phone/tablet (standard mobile video-platform layout), contained card on desktop */}
        <div className="relative -mx-4 mb-3 aspect-video overflow-hidden bg-black md:-mx-6 md:mb-4 lg:mx-0 lg:rounded-[22px]">
          <PremiumWrapper
            videoId={video.id}
            requiredTier={video.tier}
            showPatronComingSoon
            posterUrl={video.thumbnailUrl}
            revealKey="player"
          >
            <VideoPlayer video={video} revealKey="player" onViewCounted={() => setLocalViewsCount((views) => views + 1)} />
          </PremiumWrapper>
        </div>

        {/* INFO SECTION */}
        <div className="space-y-3 pb-1 lg:px-2">
          <h1 className="font-brand font-bold not-italic text-[22px] md:text-[30px] tracking-[-0.021em] text-[var(--chan-ink)] leading-[1.16] mb-2">
             {displayTitle}
          </h1>

          <div className={cn("flex flex-col justify-between gap-2 lg:flex-row lg:items-center", styles.metaRow)}>
            <div className={cn("flex w-full items-center gap-[13px] min-w-0 lg:w-auto", styles.creatorStrip)}>
               <Link
                 href={video.creator?.slug ? getLocalizedHref(language, "channel", { slug: video.creator.slug }) : "#"}
                 className="shrink-0"
               >
                  <SafeAvatar
                    src={video.creator?.imageUrl}
                    alt={video.creator?.name || 'Creator'}
                    size={46}
                    fallbackSeed={video.creator?.name || MAIN_CREATOR_NAME}
                    className="bg-[var(--chan-avatar-gradient)] transition-[transform,opacity] duration-200 hover:opacity-90 hover:scale-[1.04]"
                  />
               </Link>
               <div className="min-w-0 flex flex-col">
                  <Link
                    href={video.creator?.slug ? getLocalizedHref(language, "channel", { slug: video.creator.slug }) : "#"}
                    className="font-brand font-bold text-[var(--chan-ink)] text-[15px] leading-[1.2] tracking-[-0.01em] truncate block transition-colors hover:text-[var(--chan-blue)]"
                  >
                    {video.creator?.name || MAIN_CREATOR_NAME}
                  </Link>
                  <span className="text-[12.5px] font-medium text-[var(--chan-muted)] mt-[1px] tabular-nums">
                     {mounted ? formatCount(subscribersCount) : subscribersCount} {subscribersLabel}
                  </span>
               </div>
               <div className="ml-auto shrink-0 lg:ml-[6px]">
                  <SubscribeButton
                    creatorId={video.creatorId}
                    creatorSlug={video.creator?.slug}
                    creatorName={video.creator?.name}
                    variant="compact"
                    className={cn("rounded-[12px]", styles.subscribeAction)}
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
               <div className={cn("relative flex h-[36px] shrink-0 items-center rounded-[12px] bg-[var(--chan-surface)]", styles.actionCluster)}>
                  <button
                    onClick={handleLike}
                    disabled={isPending}
                    className={cn(
                        "flex h-full items-center justify-center gap-1.5 px-2.5 font-sans transition-colors active:opacity-70 lg:px-3",
                        styles.actionButton,
                        interactionState.isLiked ? "text-[var(--chan-blue)]" : "text-[var(--chan-ink)]",
                        isPending && "opacity-50"
                    )}
                    title={interactionState.isLiked ? (language === 'pl' ? 'Cofnij polubienie' : 'Remove like') : (language === 'pl' ? 'Lubię to' : 'Like')}
                    aria-label={interactionState.isLiked ? (language === 'pl' ? 'Cofnij polubienie filmu' : 'Remove like from video') : (language === 'pl' ? 'Polub film' : 'Like video')}
                    aria-pressed={interactionState.isLiked}
                  >
                     <ThumbsUp
                       className={cn(
                         "h-4 w-4 shrink-0",
                         likePulse && "motion-safe:animate-[polutek-reaction-pop_320ms_cubic-bezier(0.34,1.56,0.64,1)_both]",
                       )}
                       strokeWidth={1.8}
                       color={interactionState.isLiked ? "var(--chan-blue)" : "var(--chan-ink)"}
                     />
                     <span className="text-[12px] font-bold">{interactionState.likesCount.toLocaleString(language === 'pl' ? 'pl-PL' : 'en-US')}</span>
                  </button>
                  <span className="h-4 w-px bg-[var(--chan-line-soft)]" />
                  <button
                    onClick={handleDislike}
                    disabled={isPending}
                    className={cn(
                        "flex h-full items-center justify-center px-3 transition-colors active:opacity-70",
                        styles.actionButton,
                        interactionState.isDisliked ? "text-[var(--chan-blue)]" : "text-[var(--chan-ink)]",
                        isPending && "opacity-50"
                    )}
                    title={interactionState.isDisliked ? (language === 'pl' ? 'Cofnij reakcję nie lubię' : 'Remove dislike') : (language === 'pl' ? 'Nie lubię' : 'Dislike')}
                    aria-label={interactionState.isDisliked ? (language === 'pl' ? 'Cofnij reakcję nie lubię filmu' : 'Remove dislike from video') : (language === 'pl' ? 'Nie lubię filmu' : 'Dislike video')}
                    aria-pressed={interactionState.isDisliked}
                  >
                     <ThumbsDown
                       className={cn(
                         "h-4 w-4 shrink-0",
                         dislikePulse && "motion-safe:animate-[polutek-reaction-pop_320ms_cubic-bezier(0.34,1.56,0.64,1)_both]",
                       )}
                       strokeWidth={1.8}
                       color={interactionState.isDisliked ? "var(--chan-blue)" : "var(--chan-ink)"}
                     />
                  </button>
               </div>
               <ShareButton
                 url={mounted ? `${window.location.origin}/?v=${encodeURIComponent(video.slug)}` : ''}
                 title={displayTitle}
                 text={video.description || undefined}
                 className={styles.secondaryAction}
               />
               {/* Hero only ever renders inside ChannelHome, so the "polutek:open-support"
                   event dispatched here is always heard by ChannelHome's own listener
                   (the same one AccessLockOverlay's CTA uses) — it switches the mobile
                   "videos" tab (where the donation box lives) and scrolls to it,
                   synchronously and independent of any router/searchParams timing. The
                   ?support=1 merge into the CURRENT path/query (keeping ?v= for the video
                   already open) is a separate, secondary signal purely so DonationBox's
                   own effect can call its existing onSupport() once mounted — never a
                   second payment flow. A bare-URL push (the original implementation) used
                   to drop the open video and reset the mobile tab back to "comments"
                   (ChannelHome resets state when its routed video id changes), which is
                   what produced the jarring instant jump this event-based approach fixes.
                   Signed-out click opens sign-in first, since DonationBox only mounts for
                   signed-in viewers. Now the row's last item, so it takes over Share's old
                   "fill remaining space" role (flex-1 below lg:, fixed above it). */}
               <button
                 type="button"
                 onClick={() => {
                   if (!userId) {
                     openAuthModal("sign-in");
                     return;
                   }
                   window.dispatchEvent(new CustomEvent("polutek:open-support"));
                   const params = new URLSearchParams(searchParams.toString());
                   params.set("support", "1");
                   router.replace(`${pathname}?${params.toString()}#donations`, { scroll: false });
                 }}
                 className={cn(
                   "relative flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-[var(--chan-surface)] px-3 font-sans text-sm font-bold text-[var(--chan-ink)] transition-[transform,background-color,box-shadow] duration-160 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(23,23,23,0.08)] active:scale-95 lg:flex-none",
                   styles.supportAction,
                 )}
                 aria-label={language === "pl" ? "Wspieraj" : "Support"}
                 title={language === "pl" ? "Wspieraj" : "Support"}
               >
                 <Coins aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                 <span className="leading-none">{language === "pl" ? "Wspieraj" : "Support"}</span>
               </button>
            </div>
          </div>
        </div>

        {/* DESCRIPTION PANEL */}
        <div
          className={cn("mt-2 cursor-pointer rounded-[18px] border px-4 pt-[9px] pb-3 transition-[border-color,background-color,box-shadow] duration-200 hover:border-[var(--cm-blue-36-line)] md:px-5", styles.descPanel)}
          onClick={() => setIsExpanded(!isExpanded)}
        >
           <div>
             <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1.5">
                <span className="font-sans text-[12px] font-bold not-italic tabular-nums text-[var(--chan-ink)]">
                   {mounted ? localViewsCount.toLocaleString(language === 'pl' ? 'pl-PL' : 'en-US') : localViewsCount} {t.views}
                </span>
                <span aria-hidden="true" className="h-[3px] w-[3px] rounded-full bg-[var(--chan-line-soft)]" />
                <span className="font-sans text-[12px] font-semibold not-italic text-[var(--chan-muted)]">
                   {video.publishedAt ? new Date(video.publishedAt).toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : t.noDate}
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
                        className="text-[12px] font-bold text-[var(--chan-blue)] ml-1 hover:underline cursor-pointer inline"
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
                 className="text-[12px] font-bold text-[var(--chan-blue)] mt-1 hover:underline inline-block"
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
