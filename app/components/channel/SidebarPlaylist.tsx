"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDistance } from "date-fns";
import Image from "next/image";
import { AlertCircle } from "../icons";
import { PublicVideoDTO } from "@/app/types/video";
import { useAuth } from "@/lib/auth/react";
import { useEffect, useRef, useState } from "react";
import AccessLockOverlay from "../AccessLockOverlay";
import { getVideoDisplayTitle } from "@/lib/video-title-overrides";
import { NajsIcon } from "../najs/primitives";
import { useAppPreload } from "../preload/AppPreloadProvider";
import type { WarmupInput } from "../preload/media-warmup";
import { getLocalizedHref, type Locale } from "@/lib/i18n/routing";
import { dateFnsLocale } from "@/lib/i18n/date-locale";
import { countedNoun } from "@/lib/i18n/plurals";
import { intlLocale } from "@/lib/i18n/ui";
import { useOptionalTx } from "@/lib/i18n/language-context";
import { Skeleton } from "@/components/ui/skeleton";
import { isUpcomingPremiere } from "@/lib/premiere";
import { usePremiereClock } from "@/lib/hooks/usePremiereClock";
import { useRenderClock } from "../RenderClock";
import {
  acquireSidebarLayout,
  releaseSidebarLayout,
  sidebarLayoutViewerKey,
  type SidebarLayout,
  type SidebarLayoutItem,
} from "./sidebar-layout-request";

type Translations = { views: string };

interface SidebarPlaylistProps {
  sortedVideos: PublicVideoDTO[];
  selectedVideoId?: string;
  t: Translations;
  language: Locale;
  onVideoSelect?: (videoId?: string) => void;
  /** Server-built layout (HomeExperience) + the viewer it was built for; skips the first fetch. */
  initialLayout?: SidebarLayout | null;
  initialLayoutViewerKey?: string;
}

export function SidebarPlaylist({
  sortedVideos,
  selectedVideoId,
  t,
  language,
  onVideoSelect,
  initialLayout,
  initialLayoutViewerKey,
}: SidebarPlaylistProps) {
  const {
    isLoaded: authLoaded,
    isSignedIn,
    userId: authUserId,
  } = useAuth();
  const tx = useOptionalTx(language);
  const preloader = useAppPreload();
  // Relative dates render from the server's clock during hydration (RenderClock), so the first
  // HTML already has them; views use a fixed locale, which formats the same on server and client.
  const now = useRenderClock();

  const getViewsLabel = (count: number) => countedNoun(language, "views", count);

  const [layout, setLayout] = useState<SidebarLayout | null>(initialLayout ?? null);
  const [error, setError] = useState<boolean>(false);
  // Nothing to show yet (no server layout and the first fetch is still running). A refetch (sign-in,
  // premiere reached) keeps the current layout on screen until the new one replaces it.
  const loading = !layout && !error;
  // Viewer the layout in state was built for; seeded from the server so the first pass doesn't refetch.
  const layoutViewerKeyRef = useRef<string | null>(initialLayout ? initialLayoutViewerKey ?? null : null);

  // Changes only when one of the listed premieres is reached; the layout is then
  // refetched so that video moves from "Coming soon" into its normal section.
  const premiereNow = usePremiereClock(
    (layout?.sections.flatMap((section) => section.items) ?? sortedVideos).map((item) => item.premiereAt),
  );
  const premiereNowMs = premiereNow.getTime();
  const lastPremiereRefreshRef = useRef(premiereNowMs);
  useEffect(() => {
    if (lastPremiereRefreshRef.current === premiereNowMs) return;
    lastPremiereRefreshRef.current = premiereNowMs;
    layoutViewerKeyRef.current = null;
  }, [premiereNowMs]);

  useEffect(() => {
    if (!authLoaded) return;

    // Keyed by viewer identity so the two simultaneously mounted instances share
    // one request, while any auth-state change starts a fresh one.
    const viewerKey = sidebarLayoutViewerKey(authUserId, isSignedIn);
    if (layoutViewerKeyRef.current === viewerKey) return;

    const request = acquireSidebarLayout(viewerKey);
    let cancelled = false;

    async function applyLayout() {
      layoutViewerKeyRef.current = null;

      const result = await request.promise;
      if (cancelled || result.status === "aborted") return;
      if (result.status === "ok") {
        layoutViewerKeyRef.current = viewerKey;
        setLayout(result.layout);
        setError(false);
      } else {
        // The layout on screen was built for another viewer: fall back to the plain list,
        // locked by this viewer's own sign-in state.
        setLayout(null);
        setError(true);
      }
    }
    void applyLayout();

    return () => {
      cancelled = true;
      releaseSidebarLayout(viewerKey, request);
    };
  }, [authLoaded, authUserId, isSignedIn, premiereNowMs]);

  const renderVideoItem = (
    video: SidebarLayoutItem,
    isPublicSection = false,
    inUpcomingSection = false,
    index = 0,
  ) => {
    const displayTitle = getVideoDisplayTitle(video, language);
    const isCurrent = video.id === selectedVideoId;
    const hasAccess = !video.isLocked;
    // Scheduled premiere not reached yet (CLAUDE.md "Premieres"): signed-in viewers see
    // the premiere tile with this video's date, guests the sign-in wall. The server's
    // UPCOMING section wins over our clock until the layout is refetched.
    const isUpcoming = inUpcomingSection || isUpcomingPremiere(video, premiereNow);
    // Otherwise signing in is the only gate (CLAUDE.md §4.4).
    const lockState = isUpcoming
      ? isSignedIn ? "COMING_SOON" : "LOGIN_REQUIRED"
      : !hasAccess ? "LOGIN_REQUIRED" : null;
    // Intent (pointer over the tile, touch on it, keyboard focus) warms what a click will need:
    // the playback plan, the first seconds of the stream and the first page of comments.
    const warmVideoOnIntent = (input: WarmupInput) => {
      void preloader?.warmVideo(video.id, {
        includeComments: true,
        priority: "intent",
        input,
      });
    };
    const releaseIntent = () => preloader?.releaseVideoIntent(video.id);
    const feedVideoHref = `${getLocalizedHref(language, "home")}?v=${encodeURIComponent(video.slug || video.id)}`;

    return (
      <div
        key={video.id || video.slug}
        onPointerEnter={(event) => warmVideoOnIntent(event.pointerType === "touch" ? "touch" : "mouse")}
        onPointerLeave={releaseIntent}
        onPointerCancel={releaseIntent}
        onFocus={() => warmVideoOnIntent("keyboard")}
        onBlur={releaseIntent}
        className="relative group/item lg:flex-1 lg:h-full motion-safe:animate-[polutek-surface-enter_360ms_cubic-bezier(0.16,1,0.3,1)_both]"
        style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      >
        <Link
          href={feedVideoHref}
          scroll={false}
          // A plain click switches in place (no navigation), so a router prefetch of the
          // dynamic home page would only cost a server render per visible link.
          prefetch={false}
          onClick={(event) => {
            // Plain clicks switch in place (ChannelHome does a shallow URL update);
            // modified/middle clicks keep the real link for new tabs. Upcoming
            // premieres are selectable too: the player shows their countdown.
            if (!onVideoSelect || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onVideoSelect(video.id);
          }}
          aria-current={isCurrent ? "page" : undefined}
          className={cn(
            "group relative mb-0.5 flex items-start gap-3 overflow-hidden rounded-[14px] p-2 transition-[background-color,box-shadow] duration-160 motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:mb-0 lg:h-full lg:min-h-[88px] lg:gap-3 lg:p-2",
            isCurrent
              ? "bg-[var(--chan-blue)]/20"
              : isPublicSection
                ? "bg-gradient-to-br from-[var(--cm-blue-10-card)] to-[var(--cm-blue-18-card)] transition-[background-color,transform] duration-160 hover:brightness-[1.03]"
                : "transition-[background-color,box-shadow] duration-160 hover:bg-[var(--chan-surface)] hover:shadow-[0_2px_8px_rgba(23,23,23,0.06)]",
          )}
        >
          {isCurrent && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-0 top-1/2 h-12 w-1 -translate-y-1/2 rounded-r-lg transition-all duration-160 motion-reduce:transition-none",
                "bg-[var(--chan-blue)] shadow-[0_0_12px_var(--cm-blue-40)]",
              )}
            />
          )}
          <div className="w-[130px] h-[73px] shrink-0 rounded-[12px] bg-black relative overflow-hidden group/thumb lg:w-[135px] lg:h-[76px] xl:w-[145px] xl:h-[82px]">
              {video.thumbnailUrl ? (
                <Image
                  src={video.thumbnailUrl}
                  alt={displayTitle}
                  fill
                  sizes="(min-width: 1280px) 158px, (min-width: 1024px) 150px, 130px"
                  className="object-cover transition-transform duration-200 group-hover/thumb:scale-[1.025] motion-reduce:transform-none motion-reduce:transition-none"
                />
              ) : (
                <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                  <NajsIcon name="video" className="text-white/20 w-8 h-8" stroke="rgba(255,255,255,0.2)" />
                </div>
              )}

              {lockState && (
                <div className="pointer-events-none">
                  <div className="absolute inset-0 z-20">
                    <AccessLockOverlay state={lockState} variant="thumbnailCompact" premiereAt={video.premiereAt} />
                  </div>
                </div>
              )}

              {video.duration && !lockState && (
                <div className="absolute bottom-[5px] right-[5px] bg-black/80 text-white text-[10px] font-bold px-[5px] py-0.5 rounded-[4px] z-30 pointer-events-none font-mono">
                  {video.duration}
                </div>
              )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-start mt-[1px] gap-0.5 z-10 relative">
            <h4 className="font-sans text-[13px] font-bold text-[var(--chan-ink)] line-clamp-2 leading-[1.2] group-hover:opacity-80 transition-opacity lg:text-[12px]">
              {displayTitle}
            </h4>
            <div className="text-[12px] text-[var(--chan-muted)] flex flex-col mt-0">
              <div className="transition-colors w-fit relative z-20 leading-[1.4]">
                {video.creator?.name || "PawelPerfect"}
              </div>
              <div className="flex flex-col leading-[1.4]">
                <span>
                  {(video.views ?? 0).toLocaleString(intlLocale(language))}{" "}
                  {getViewsLabel(video.views ?? 0)}
                </span>
                {video.publishedAt && now && (
                  <span>
                    {formatDistance(new Date(video.publishedAt), now, {
                      addSuffix: true,
                      locale: dateFnsLocale(language),
                    }).replace("około", "ok.")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>
      </div>
    );
  };

  const renderSectionHeader = (title: string, icon?: React.ReactNode) => (
    <div className="mb-1.5 flex shrink-0 items-center gap-2 border-b border-[var(--cm-line-76-2)] pb-1.5">
      {icon ?? (
        <span
          aria-hidden="true"
          className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--chan-blue)] shadow-[0_0_0_3px_var(--cm-blue-16)]"
        />
      )}
      <h3 className="font-brand text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--chan-muted-2)]">
        {title}
      </h3>
    </div>
  );

  // Section titles follow the viewer's language (the server layout only carries Polish ones).
  const publicSectionTitle = tx("Publiczne", "Public");
  const loggedInSectionTitle = tx("Dla zalogowanych", "For signed-in users");
  const upcomingSectionTitle = tx("Już wkrótce", "Coming soon");
  const amberDot = (
    <span
      aria-hidden="true"
      className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--chan-amber)] shadow-[0_0_0_3px_var(--cm-amber-20)]"
    />
  );

  if (loading) {
    const renderSkeletonSection = (title: string) => (
      <div className="mb-0.5 last:mb-0 lg:mb-0 lg:flex lg:flex-1 lg:flex-col">
        {renderSectionHeader(title)}
        <div className="mb-0.5 flex gap-3 rounded-[14px] p-2">
          <Skeleton className="h-[73px] w-[130px] shrink-0 rounded-[12px] lg:h-[76px] lg:w-[135px] xl:h-[82px] xl:w-[145px]" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
            <Skeleton className="h-[13px] w-3/4" />
            <Skeleton className="h-[12px] w-1/2" />
            <Skeleton className="h-[11px] w-2/3" />
          </div>
        </div>
      </div>
    );

    return (
      <div className="flex flex-col gap-1 lg:h-full lg:gap-1.5" aria-busy="true">
        {renderSkeletonSection(publicSectionTitle)}
        {renderSkeletonSection(loggedInSectionTitle)}
        {renderSkeletonSection(upcomingSectionTitle)}
      </div>
    );
  }

  if (error || !layout) {
    const fallbackItems = sortedVideos || [];

    if (fallbackItems.length === 0) {
      return (
        <div className="rounded-2xl border-2 border-dashed border-[var(--chan-line)] p-8 text-center">
          <p className="text-sm text-[var(--chan-muted)]">
            {tx("Brak filmów do wyświetlenia.", "No videos to show.")}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-1.5 lg:h-full lg:min-h-0">
        {renderSectionHeader(
          tx("Dostępne filmy", "Available videos"),
          <AlertCircle size={14} className="text-[var(--chan-amber-strong)]" />,
        )}
        {fallbackItems.map((v, i) =>
          renderVideoItem(
            {
              ...v,
              // Anything not PUBLIC needs sign-in (CLAUDE.md §4.4); upcoming
              // premieres are locked by renderVideoItem from their premiereAt.
              isLocked: v.tier !== "PUBLIC" && !isSignedIn,
            },
            false,
            false,
            i,
          ),
        )}
      </div>
    );
  }

  const publicSection = layout.sections.find((s) => s.type === "FREE");
  const loggedInSection = layout.sections.find((s) => s.type === "LOGGED_IN");
  const upcomingSection = layout.sections.find((s) => s.type === "UPCOMING");

  return (
    <div className="flex flex-col gap-1 lg:h-full lg:gap-0.5">
      {publicSection && (
        <div className="mb-0.5 last:mb-0 lg:mb-0 lg:flex lg:flex-1 lg:flex-col">
          {renderSectionHeader(publicSectionTitle)}
          {publicSection.items.map((v, i) => renderVideoItem(v, true, false, i))}
        </div>
      )}
      {loggedInSection && (
        <div className="mb-0.5 last:mb-0 lg:mb-0 lg:flex lg:flex-1 lg:flex-col">
          {renderSectionHeader(loggedInSectionTitle)}
          {loggedInSection.items.map((v, i) => renderVideoItem(v, false, false, i))}
        </div>
      )}

      {upcomingSection && upcomingSection.items.length > 0 && (
        <div className="mb-0.5 last:mb-0 lg:mb-0 lg:flex lg:flex-1 lg:flex-col" data-testid="sidebar-upcoming-section">
          {renderSectionHeader(upcomingSectionTitle, amberDot)}
          {upcomingSection.items.map((v, i) => renderVideoItem(v, false, true, i))}
        </div>
      )}

    </div>
  );
}
