"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { PublicVideoDTO } from '../types/video';
import { useAuth } from "@/lib/auth/react";
import { useAuthModal } from './auth/AuthModalProvider';
import { cn, formatCount } from '@/lib/utils';
import PremiumWrapper from './PremiumWrapper';
import Link from 'next/link';
import VideoPlayer from './VideoPlayer';
import { SafeAvatar } from './SafeAvatar';
import { setVideoReaction } from '@/lib/actions/interactions';
import { getLocalizedHref } from "@/lib/i18n/routing";
import { useLanguage } from './LanguageContext';
import { useToast } from '@/app/hooks/useToast';
import { logger } from '@/lib/logger';
import { getVideoDisplayTitle } from '@/lib/video-title-overrides';
import SubscribeButton from './SubscribeButton';
import ShareButton from './ShareButton';
import { FundraisingProgressBar } from './FundraisingProgressBar';
import { MAIN_CREATOR_NAME } from '@/lib/constants';
import { ThumbsUp, ThumbsDown, Coins } from 'lucide-react';
import styles from './watch-actions.module.css';

interface HeroProps {
  video: PublicVideoDTO;
  initialInteraction?: { liked: boolean; disliked: boolean };
  initialIsSubscribed?: boolean;
}

// Fixed locale and time zone: the server and the browser format these the same way, so the first
// HTML already has the final text (no "1234" -> "1,2K" swap after hydration).
const NUMBER_LOCALE = { pl: 'pl-PL', en: 'en-US' } as const;
function formatPublishedDate(value: string | Date, language: 'pl' | 'en'): string {
  return new Date(value).toLocaleDateString(NUMBER_LOCALE[language], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Warsaw',
  });
}

function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  let i = max;
  while (i > 0 && !/\s/.test(text[i])) i--;
  return (i > 0 ? text.slice(0, i) : text.slice(0, max)).trimEnd();
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

  const subscribersCount = localSubState.subscribersCount;
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

  // No server-rendered like/dislike for this video (it was selected with a shallow
  // switch): fetch the viewer's own state, unless they already clicked meanwhile.
  const userActedRef = React.useRef(false);
  const hasInitialInteraction = initialInteraction !== undefined;
  useEffect(() => {
    userActedRef.current = false;
    if (!userId || hasInitialInteraction) return;
    const controller = new AbortController();
    fetch(`/api/videos/${encodeURIComponent(video.id)}/viewer-state`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { liked?: boolean; disliked?: boolean } | null) => {
        if (!data || userActedRef.current) return;
        setInteractionState((current) => ({ ...current, isLiked: !!data.liked, isDisliked: !!data.disliked }));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [video.id, userId, hasInitialInteraction]);

  // Sends the target state (not a toggle), so a repeated or retried request can never flip the
  // reaction back; the server action does not re-render the page, the state below is the source.
  const applyReaction = (target: "LIKE" | "DISLIKE" | null) => {
    const previousState = interactionState;
    const nextIsLiked = target === "LIKE";
    const nextIsDisliked = target === "DISLIKE";
    if (nextIsLiked) {
        setLikePulse(true);
        window.setTimeout(() => setLikePulse(false), 320);
    }
    if (nextIsDisliked) {
        setDislikePulse(true);
        window.setTimeout(() => setDislikePulse(false), 320);
    }
    // Optimistic update: reflect the click immediately, reconcile with the server after.
    setInteractionState({
        isLiked: nextIsLiked,
        isDisliked: nextIsDisliked,
        likesCount: Math.max(0, previousState.likesCount + Number(nextIsLiked) - Number(previousState.isLiked)),
        dislikesCount: Math.max(0, previousState.dislikesCount + Number(nextIsDisliked) - Number(previousState.isDisliked)),
    });

    startTransition(async () => {
        const failMessage = language === 'pl'
            ? 'Nie udało się zapisać oceny. Spróbuj ponownie.'
            : 'Could not save your rating. Try again.';
        try {
            const result = await setVideoReaction(video.id, target);
            if (result.error !== undefined) {
                logger.error("[Hero] Reaction failed:", result.error);
                setInteractionState(previousState);
                if (result.error === 'UNAUTHORIZED') openAuthModal("sign-in");
                else toast(failMessage, 'error');
                return;
            }
            setInteractionState({
                isLiked: result.liked,
                isDisliked: result.disliked,
                likesCount: result.likesCount,
                dislikesCount: result.dislikesCount,
            });
        } catch (error: unknown) {
            logger.error("[Hero] Reaction request failed:", error);
            setInteractionState(previousState);
            toast(failMessage, 'error');
        }
    });
  };

  const handleLike = () => {
    if (!userId) return openAuthModal("sign-in");
    userActedRef.current = true;
    if (isPending) return;
    applyReaction(interactionState.isLiked ? null : "LIKE");
  };

  const handleDislike = () => {
    if (!userId) return openAuthModal("sign-in");
    userActedRef.current = true;
    if (isPending) return;
    applyReaction(interactionState.isDisliked ? null : "DISLIKE");
  };

  return (
    <section className="bg-transparent">
      <div className="w-full lg:rounded-[26px] lg:border lg:border-[var(--cm-line-80)] lg:bg-[var(--cm-card-92-white)] lg:p-3 lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_6px_rgba(23,23,23,0.03),0_30px_60px_-26px_rgba(23,23,23,0.24)]">
        {/* FEATURED MEDIA — full-bleed edge-to-edge on phone/tablet (standard mobile video-platform layout), contained card on desktop */}
        <div className="relative -mx-4 mb-3 aspect-video overflow-hidden bg-black md:-mx-6 md:mb-4 lg:mx-0 lg:rounded-[22px]">
          <PremiumWrapper
            videoId={video.id}
            requiredTier={video.tier}
            premiereAt={video.premiereAt}
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
          {typeof video.fundraisingProgress === 'number' && (
            <FundraisingProgressBar key={video.id} progress={video.fundraisingProgress} isPl={language === 'pl'} />
          )}

          <div className={cn("flex flex-col justify-between gap-2 lg:flex-row lg:items-center", styles.metaRow)}>
            <div className={cn("flex w-full items-center gap-[13px] min-w-0 lg:w-auto", styles.creatorStrip)}>
               <Link
                 href={video.creator?.slug ? getLocalizedHref(language, "channel", { slug: video.creator.slug }) : "#"}
                 className="shrink-0"
                 // The channel page is rendered per request; prefetching it on sight would cost a
                 // server render on every visit for a link few people follow.
                 prefetch={false}
               >
                  <SafeAvatar
                    src={video.creator?.imageUrl}
                    alt={video.creator?.name || 'Creator'}
                    size={46}
                    className="bg-[var(--chan-avatar-gradient)] transition-[transform,opacity] duration-200 hover:opacity-90 hover:scale-[1.04]"
                  />
               </Link>
               <div className="min-w-0 flex flex-col">
                  <Link
                    href={video.creator?.slug ? getLocalizedHref(language, "channel", { slug: video.creator.slug }) : "#"}
                    prefetch={false}
                    className="font-brand font-bold text-[var(--chan-ink)] text-[15px] leading-[1.2] tracking-[-0.01em] truncate block transition-colors hover:text-[var(--chan-blue)]"
                  >
                    {video.creator?.name || MAIN_CREATOR_NAME}
                  </Link>
                  <span className="text-[12.5px] font-medium text-[var(--chan-muted)] mt-[1px] tabular-nums">
                     {formatCount(subscribersCount)} {subscribersLabel}
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
                     <span className="text-[12px] font-bold">{interactionState.likesCount.toLocaleString(NUMBER_LOCALE[language])}</span>
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
               {/* Hero only ever renders inside ChannelHome, whose listener for the
                   "polutek:open-support" event (also used by AccessLockOverlay) opens the
                   tip gate (SupportModal). It deliberately does not touch the URL: a router
                   navigation re-renders the whole page on the server. Signed-out click opens
                   sign-in first, since tipping needs an account. The row's last item, so it
                   fills the remaining space (flex-1 below lg:, fixed above it). */}
               <button
                 type="button"
                 onClick={() => {
                   if (!userId) {
                     openAuthModal("sign-in");
                     return;
                   }
                   window.dispatchEvent(new CustomEvent("polutek:open-support"));
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
          className={cn("mt-2 cursor-pointer rounded-[18px] border px-4 pt-[9px] pb-[9px] transition-[border-color,background-color,box-shadow] duration-200 hover:border-[var(--cm-blue-36-line)] md:px-5", styles.descPanel)}
          onClick={() => setIsExpanded(!isExpanded)}
        >
           <div>
             <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1.5">
                <span className="font-sans text-[12px] font-bold not-italic tabular-nums text-[var(--chan-ink)]">
                   {localViewsCount.toLocaleString(NUMBER_LOCALE[language])} {t.views}
                </span>
                <span aria-hidden="true" className="h-[3px] w-[3px] rounded-full bg-[var(--chan-line-soft)]" />
                <span className="font-sans text-[12px] font-semibold not-italic text-[var(--chan-muted)]">
                   {video.publishedAt ? formatPublishedDate(video.publishedAt, language) : t.noDate}
                </span>
             </div>

             <div className="text-[12px] text-[var(--chan-body)] leading-[1.5] whitespace-pre-wrap">
                {isExpanded ? (
                  <>
                    {displayDescription.trimEnd()}
                    {" "}
                    <span
                      className="text-[12px] font-bold text-[var(--chan-blue)] hover:underline cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(false);
                      }}
                    >
                      {t.showLess}
                    </span>
                  </>
                ) : (
                  <>
                    {truncateAtWord(displayDescription, 160)}
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
           </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
