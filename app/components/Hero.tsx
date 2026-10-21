"use client";

import React, { useState, useEffect } from 'react';
import { PublicVideoDTO } from '../types/video';
import { useAuth } from "@/lib/auth/react";
import { useAuthModal } from './auth/AuthModalProvider';
import { cn, formatCount } from '@/lib/utils';
import PremiumWrapper from './PremiumWrapper';
import Link from 'next/link';
import VideoPlayer from './VideoPlayer';
import { SafeAvatar } from './SafeAvatar';
import { getLocalizedHref, type Locale } from "@/lib/i18n/routing";
import { intlLocale } from "@/lib/i18n/ui";
import { useLanguage } from './LanguageContext';
import { useToast } from '@/app/hooks/useToast';
import { logger } from '@/lib/logger';
import { getVideoDisplayTitle } from '@/lib/video-title-overrides';
import SubscribeButton from './SubscribeButton';
import ShareButton from './ShareButton';
import { getPlaybackPosition } from './player/playback-position';
import { FundraisingProgressBar } from './FundraisingProgressBar';
import VideoTaxonomyChips from './search/VideoTaxonomyChips';
import { LinkedDescription } from './video/LinkedDescription';
import { DescriptionChapters } from './video/DescriptionChapters';
import { MAIN_CREATOR_NAME } from '@/lib/constants';
import { ThumbsUp, ThumbsDown, Trophy } from 'lucide-react';
import styles from './watch-actions.module.css';

interface HeroProps {
  video: PublicVideoDTO;
  initialInteraction?: { liked: boolean; disliked: boolean };
  initialIsSubscribed?: boolean;
  /** The bell of the viewer's subscription to this video's channel (only with `initialIsSubscribed`). */
  initialNotify?: boolean;
  /** The viewer picked this video with a click or tap: start it with sound (see VideoPlayer). */
  startWithSound?: boolean;
  /** The signed-in viewer's saved position in this video (server-rendered; resume watching). */
  initialProgressSeconds?: number | null;
}

// Fixed locale and time zone: the server and the browser format these the same way, so the first
// HTML already has the final text (no "1234" -> "1,2K" swap after hydration).
function formatPublishedDate(value: string | Date, language: Locale): string {
  return new Date(value).toLocaleDateString(intlLocale(language), {
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

type ReactionTarget = "LIKE" | "DISLIKE" | null;
type InteractionState = { isLiked: boolean; isDisliked: boolean; likesCount: number; dislikesCount: number };
type ReactionOutcome = { kind: 'ok'; state: InteractionState } | { kind: 'unauthorized' } | { kind: 'failed'; status: number | 'network' };

/** Sets the viewer's reaction on the server; retries once on a network error or a 5xx. */
async function sendVideoReaction(videoId: string, target: ReactionTarget): Promise<ReactionOutcome> {
  let last: ReactionOutcome = { kind: 'failed', status: 'network' };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => window.setTimeout(resolve, 400));
    try {
      const response = await fetch(`/api/videos/${encodeURIComponent(videoId)}/reaction`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: target }),
        cache: 'no-store',
      });
      if (response.status === 401) return { kind: 'unauthorized' };
      if (response.ok) {
        const data = (await response.json()) as { liked: boolean; disliked: boolean; likesCount: number; dislikesCount: number };
        return { kind: 'ok', state: { isLiked: data.liked, isDisliked: data.disliked, likesCount: data.likesCount, dislikesCount: data.dislikesCount } };
      }
      last = { kind: 'failed', status: response.status };
      if (response.status < 500) return last;
    } catch {
      last = { kind: 'failed', status: 'network' };
    }
  }
  return last;
}

const Hero: React.FC<HeroProps> = ({ video, initialInteraction, initialIsSubscribed, initialNotify, startWithSound = false, initialProgressSeconds }) => {
  const { t, language, tx } = useLanguage();
  const toast = useToast();
  const { userId } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const [mounted, setMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const displayTitle = getVideoDisplayTitle(video, language);
  const [localViewsCount, setLocalViewsCount] = useState(video.views || 0);
  const displayDescription = (language !== 'pl' && video.descriptionEn) ? video.descriptionEn : (video.description || t.noDescription);

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
  // The saved position (resume watching) arrives with the same request after a shallow switch.
  const [fetchedProgress, setFetchedProgress] = useState<{ videoId: string; seconds: number | null } | null>(null);
  const resumeSeconds: number | null | undefined = !userId
    ? null
    : hasInitialInteraction
      ? (initialProgressSeconds ?? null)
      : fetchedProgress?.videoId === video.id
        ? fetchedProgress.seconds
        : undefined;
  useEffect(() => {
    userActedRef.current = false;
    if (!userId || hasInitialInteraction) return;
    const controller = new AbortController();
    fetch(`/api/videos/${encodeURIComponent(video.id)}/viewer-state`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { liked?: boolean; disliked?: boolean; progressSeconds?: number | null } | null) => {
        setFetchedProgress({
          videoId: video.id,
          seconds: data && typeof data.progressSeconds === 'number' ? data.progressSeconds : null,
        });
        if (!data || userActedRef.current) return;
        setInteractionState((current) => ({ ...current, isLiked: !!data.liked, isDisliked: !!data.disliked }));
      })
      .catch((error: unknown) => {
        if ((error as { name?: string } | null)?.name === 'AbortError') return;
        setFetchedProgress({ videoId: video.id, seconds: null });
      });
    return () => controller.abort();
  }, [video.id, userId, hasInitialInteraction]);

  // The reaction the viewer ended up wanting is what counts, not every click: clicks are never
  // dropped or refused while a request is in flight. Each request carries the target state (not a
  // toggle), requests run one after another, only the newest result is shown, and a request
  // superseded by a newer click never raises an error.
  const currentVideoIdRef = React.useRef(video.id);
  useEffect(() => {
    currentVideoIdRef.current = video.id;
  }, [video.id]);
  const reactionSync = React.useRef<{ running: boolean; desired: ReactionTarget | undefined; confirmed: InteractionState | null }>({
    running: false,
    desired: undefined,
    confirmed: null,
  });

  const flushReactions = async (videoId: string) => {
    const sync = reactionSync.current;
    sync.running = true;
    try {
      while (sync.desired !== undefined) {
        const target = sync.desired;
        sync.desired = undefined;
        const outcome = await sendVideoReaction(videoId, target);
        const showable = currentVideoIdRef.current === videoId;
        if (outcome.kind === 'ok') {
          sync.confirmed = outcome.state;
          if (showable && sync.desired === undefined) setInteractionState(outcome.state);
        } else if (outcome.kind === 'unauthorized') {
          sync.desired = undefined;
          if (showable && sync.confirmed) setInteractionState(sync.confirmed);
          openAuthModal("sign-in");
        } else if (sync.desired === undefined) {
          logger.error("[Hero] Reaction failed:", outcome.status);
          if (showable && sync.confirmed) setInteractionState(sync.confirmed);
          toast(
            tx("Nie udało się zapisać oceny. Spróbuj ponownie.", "Could not save your rating. Try again."),
            'error',
          );
        }
      }
    } finally {
      sync.running = false;
      sync.confirmed = null;
    }
  };

  const applyReaction = (target: ReactionTarget) => {
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

    const sync = reactionSync.current;
    if (!sync.running) sync.confirmed = previousState;
    sync.desired = target;
    if (!sync.running) void flushReactions(video.id);
  };

  const handleLike = () => {
    if (!userId) return openAuthModal("sign-in");
    userActedRef.current = true;
    applyReaction(interactionState.isLiked ? null : "LIKE");
  };

  const handleDislike = () => {
    if (!userId) return openAuthModal("sign-in");
    userActedRef.current = true;
    applyReaction(interactionState.isDisliked ? null : "DISLIKE");
  };

  return (
    <section className="bg-transparent">
      <div className="w-full lg:rounded-[26px] lg:border lg:border-[var(--cm-line-80)] lg:bg-[var(--cm-card-92-white)] lg:p-3 lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_6px_rgba(23,23,23,0.03),0_30px_60px_-26px_rgba(23,23,23,0.24)]">
        {/* FEATURED MEDIA — full-bleed edge-to-edge on phone/tablet (standard mobile video-platform layout), contained card on desktop */}
        <div data-player-slot="" className="relative -mx-4 mb-3 aspect-video overflow-hidden bg-black md:-mx-6 md:mb-4 lg:mx-0 lg:rounded-[22px]">
          <PremiumWrapper
            videoId={video.id}
            requiredTier={video.tier}
            premiereAt={video.premiereAt}
            revealKey="player"
            premiumPass={video.premiumPass} // experiment: premium-pass (docs/experiments/premium-pass.md)
          >
            <VideoPlayer
              video={video}
              revealKey="player"
              startWithSound={startWithSound}
              signedIn={Boolean(userId)}
              resumeSeconds={resumeSeconds}
              onViewCounted={() => setLocalViewsCount((views) => views + 1)}
            />
          </PremiumWrapper>
        </div>

        {/* INFO SECTION */}
        <div className="space-y-3 pb-1 lg:px-2">
          <h1 className="font-brand font-bold not-italic uppercase text-[22px] md:text-[30px] tracking-[0.005em] text-[var(--chan-ink)] leading-[1.16] mb-2">
             {displayTitle}
          </h1>
          {typeof video.fundraisingProgress === 'number' && (
            <FundraisingProgressBar key={video.id} progress={video.fundraisingProgress} tx={tx} />
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
                    // Unknown for this video's channel (the viewer picked a video of another channel):
                    // the button asks the API for the status of exactly this channel.
                    initialIsSubscribed={initialIsSubscribed === undefined ? undefined : localSubState.isSubscribed}
                    initialNotify={initialNotify}
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
                    className={cn(
                        "flex h-full items-center justify-center gap-1.5 px-2.5 font-sans transition-colors active:opacity-70 lg:px-3",
                        styles.actionButton,
                        interactionState.isLiked ? "text-[var(--chan-blue)]" : "text-[var(--chan-ink)]"
                    )}
                    title={interactionState.isLiked ? (tx("Cofnij polubienie", "Remove like")) : (tx("Lubię to", "Like"))}
                    aria-label={interactionState.isLiked ? (tx("Cofnij polubienie filmu", "Remove like from video")) : (tx("Polub film", "Like video"))}
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
                     <span className="text-[12px] font-bold">{interactionState.likesCount.toLocaleString(intlLocale(language))}</span>
                  </button>
                  <span className="h-4 w-px bg-[var(--chan-line-soft)]" />
                  <button
                    onClick={handleDislike}
                    className={cn(
                        "flex h-full items-center justify-center px-3 transition-colors active:opacity-70",
                        styles.actionButton,
                        interactionState.isDisliked ? "text-[var(--chan-blue)]" : "text-[var(--chan-ink)]"
                    )}
                    title={interactionState.isDisliked ? (tx("Cofnij reakcję nie lubię", "Remove dislike")) : (tx("Nie lubię", "Dislike"))}
                    aria-label={interactionState.isDisliked ? (tx("Cofnij reakcję nie lubię filmu", "Remove dislike from video")) : (tx("Nie lubię filmu", "Dislike video"))}
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
                 getStartSeconds={() => getPlaybackPosition(video.id)}
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
                 aria-label={tx("Kup Premium", "Get Premium")}
                 title={tx("Kup Premium", "Get Premium")}
               >
                 <Trophy aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                 <span className="leading-none">{tx("Kup Premium", "Get Premium")}</span>
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
                   {localViewsCount.toLocaleString(intlLocale(language))} {t.views}
                </span>
                <span aria-hidden="true" className="h-[3px] w-[3px] rounded-full bg-[var(--chan-line-soft)]" />
                <span className="font-sans text-[12px] font-semibold not-italic text-[var(--chan-muted)]">
                   {video.publishedAt ? formatPublishedDate(video.publishedAt, language) : t.noDate}
                </span>
             </div>

             <div className="text-[12px] text-[var(--chan-body)] leading-[1.5] whitespace-pre-wrap">
                {isExpanded ? (
                  <>
                    <LinkedDescription text={displayDescription.trimEnd()} videoId={video.id} />
                    {" "}
                    <button
                      type="button"
                      aria-expanded="true"
                      className="text-[12px] font-bold text-[var(--chan-blue)] hover:underline cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(false);
                      }}
                    >
                      {t.showLess}
                    </button>
                  </>
                ) : (
                  <>
                    <LinkedDescription text={truncateAtWord(displayDescription, 160)} videoId={video.id} />
                    {displayDescription.length > 160 && (
                      <button
                        type="button"
                        aria-expanded="false"
                        className="text-[12px] font-bold text-[var(--chan-blue)] ml-1 hover:underline cursor-pointer inline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsExpanded(true);
                        }}
                      >
                        {t.showMore}
                      </button>
                    )}
                  </>
                )}
             </div>
             <DescriptionChapters videoId={video.id} />
           </div>
        </div>
        <VideoTaxonomyChips category={video.category} tags={video.tags} locale={language} tx={tx} className="mt-2 px-1" />
      </div>
    </section>
  );
};

export default Hero;
