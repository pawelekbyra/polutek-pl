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
import { NajsIcon, INK, BLUE, YELLOW, ScribbleFrame } from './najs/primitives';

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

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setLocalViewsCount(video.views || 0); }, [video.id, video.views]);

  const [localSubState, setLocalSubState] = useState({
    isSubscribed: initialIsSubscribed || false,
    subscribersCount: video.creator?.subscribersCount || 0,
  });

  useEffect(() => {
    setLocalSubState({
      isSubscribed: initialIsSubscribed || false,
      subscribersCount: video.creator?.subscribersCount || 0,
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
        const result = await toggleVideoLike(video.id) as { liked: boolean; disliked: boolean; likesCount: number; dislikesCount: number; error?: string; message?: string };
        if (result.error) {
          if (result.error === 'AUTH_REQUIRED') openSignIn();
          else toast(`BŁĄD: ${result.message || result.error}`, 'error');
        } else {
          setInteractionState({ isLiked: result.liked, isDisliked: result.disliked, likesCount: result.likesCount, dislikesCount: result.dislikesCount });
        }
      } catch (error: unknown) {
        logger.error("[Hero] Transition error during LIKE:", error);
        toast("Błąd serwera podczas polubienia.", 'error');
      }
    });
  };

  const handleDislike = async () => {
    if (!userId) return openSignIn();
    if (isPending) return;
    startTransition(async () => {
      try {
        const result = await toggleVideoDislike(video.id) as { liked: boolean; disliked: boolean; likesCount: number; dislikesCount: number; error?: string; message?: string };
        if (result.error) {
          if (result.error === 'AUTH_REQUIRED') openSignIn();
          else toast(`BŁĄD: ${result.message || result.error}`, 'error');
        } else {
          setInteractionState({ isLiked: result.liked, isDisliked: result.disliked, likesCount: result.likesCount, dislikesCount: result.dislikesCount });
        }
      } catch (error: unknown) {
        logger.error("[Hero] Transition error during DISLIKE:", error);
        toast("Błąd serwera podczas oceny.", 'error');
      }
    });
  };

  return (
    <section className="bg-transparent">
      <div className="w-full">
        {/* FEATURED MEDIA */}
        <div className="relative aspect-video w-full mb-[18px] group">
          <div
            className="absolute inset-0 translate-x-[4px] translate-y-[4px] rounded-[14px] opacity-20"
            style={{ border: `2.5px solid ${INK}` }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 overflow-hidden rounded-[12px] bg-black"
            style={{ border: `3px solid ${INK}`, boxShadow: "10px 12px 0 rgba(0,0,0,.16)" }}
          >
            <PremiumWrapper videoId={video.id} requiredTier={video.tier} isMainFeatured={video.isMainFeatured}>
              <VideoPlayer video={video} onViewCounted={() => setLocalViewsCount((views) => views + 1)} />
            </PremiumWrapper>
          </div>
          <div
            className="absolute -top-[9px] -right-[5px] z-20 text-[8px] font-black uppercase tracking-[0.14em] px-[7px] py-[2px] leading-none"
            style={{ background: YELLOW, color: INK, transform: "rotate(3deg)", border: `1.5px solid ${INK}`, boxShadow: `2px 2px 0 ${INK}`, fontFamily: "var(--font-najs, Kalam, cursive)" }}
            aria-hidden="true"
          >
            video
          </div>
        </div>

        {/* TITLE */}
        <div className="space-y-3">
          <h1
            className="font-black text-[24px] text-[#0f0f0f] leading-[1.2] mb-[14px] tracking-[-0.01em]"
            style={{
              fontFamily: "var(--font-najs, Kalam, cursive)",
              textDecoration: "underline",
              textDecorationColor: YELLOW,
              textDecorationThickness: "5px",
              textUnderlineOffset: "4px",
            }}
          >
            {displayTitle}
          </h1>

          {/* CREATOR + INTERACTIONS */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-[14px]">
            <div className="flex w-full items-center gap-[13px] min-w-0 lg:w-auto">
              <Link
                href={video.creator?.slug ? `/channel/${video.creator.slug}` : "#"}
                className="w-[46px] h-[46px] rounded-full overflow-hidden shrink-0 hover:opacity-80 transition-opacity relative"
                style={{ border: `3px solid ${INK}`, boxShadow: "3px 3px 0 rgba(0,0,0,.15)" }}
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
                  className="font-black text-[#0f0f0f] text-[15.5px] leading-[1.2] truncate block"
                  style={{ textDecoration: "underline", textDecorationColor: BLUE, textDecorationThickness: "2px", textUnderlineOffset: "2px" }}
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
                      subscribersCount: subscribersCount ?? (isSubscribed ? prev.subscribersCount + 1 : Math.max(0, prev.subscribersCount - 1)),
                    }));
                  }}
                />
              </div>
            </div>

            <div className="flex w-full items-center gap-[9px] lg:w-auto">
              <div
                className="flex h-[38px] flex-1 items-center rounded-full overflow-hidden lg:flex-none"
                style={{ border: `2.5px solid ${INK}`, boxShadow: "3px 3px 0 rgba(0,0,0,.12)", background: "rgba(248,243,231,.9)" }}
              >
                <button
                  onClick={handleLike}
                  disabled={isPending}
                  className={cn(
                    "relative flex h-full flex-1 min-w-0 items-center justify-center gap-2 px-4 transition-all active:opacity-70 lg:flex-none lg:pl-5 lg:pr-4",
                    interactionState.isLiked ? "text-white" : "text-[#171717]",
                    isPending && "opacity-50",
                  )}
                  style={interactionState.isLiked ? { background: BLUE } : {}}
                  title="Lubię to"
                >
                  <NajsIcon name="like" className="h-[18px] w-[18px]" stroke={interactionState.isLiked ? "#fff" : INK} />
                  <span className="text-[14px] font-black" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
                    {interactionState.likesCount.toLocaleString('pl-PL')}
                  </span>
                </button>
                <span className="h-5 w-px" style={{ background: INK, opacity: 0.2 }} />
                <button
                  onClick={handleDislike}
                  disabled={isPending}
                  className={cn(
                    "relative flex h-full flex-1 min-w-0 items-center justify-center gap-2 px-4 transition-all active:opacity-70 lg:flex-none",
                    interactionState.isDisliked ? "text-white" : "text-[#171717]",
                    isPending && "opacity-50",
                  )}
                  style={interactionState.isDisliked ? { background: INK } : {}}
                  title="Nie lubię"
                >
                  <NajsIcon name="dislike" className="h-[18px] w-[18px]" stroke={interactionState.isDisliked ? "#fff" : INK} />
                  <span className="text-[14px] font-black" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
                    {interactionState.dislikesCount.toLocaleString('pl-PL')}
                  </span>
                </button>
              </div>
              <ShareButton
                url={`${typeof window !== 'undefined' ? window.location.origin : ''}/channel/${video.creator?.slug || ''}?v=${video.slug}`}
                title={displayTitle}
                text={video.description || undefined}
              />
              <button
                type="button"
                className="w-[38px] h-[38px] flex items-center justify-center shrink-0 active:scale-95 rounded-full"
                style={{ border: `2.5px solid ${INK}`, boxShadow: "3px 3px 0 rgba(0,0,0,.12)", background: "rgba(248,243,231,.9)" }}
                aria-label="Menu"
              >
                <NajsIcon name="more" className="h-[18px] w-[18px]" stroke={INK} />
              </button>
            </div>
          </div>
        </div>

        {/* DESCRIPTION BOX */}
        <ScribbleFrame className="mt-[16px]" fill="rgba(248,243,231,.97)">
          <div className="p-[14px] cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-[7px] items-baseline">
              <span className="text-[13.5px] font-black text-[#0f0f0f]" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
                {mounted ? localViewsCount.toLocaleString(language === 'pl' ? 'pl-PL' : 'en-US') : localViewsCount} {t.views}
              </span>
              <span className="text-[13.5px] font-black text-[#0f0f0f]" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
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
                      className="text-[13.5px] font-black text-[#0f0f0f] ml-1 hover:underline cursor-pointer inline"
                      onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
                    >
                      {t.showMore}
                    </span>
                  )}
                </>
              )}
            </div>
            {isExpanded && (
              <button
                className="text-[13.5px] font-black text-[#0f0f0f] mt-1 hover:underline inline-block"
                onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
              >
                {t.showLess}
              </button>
            )}
          </div>
        </ScribbleFrame>
      </div>
    </section>
  );
};

export default Hero;
