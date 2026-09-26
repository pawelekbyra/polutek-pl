"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Hero from "./Hero";
import { PublicVideoDTO } from "../types/video";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { useLanguage } from "./LanguageContext";
import { SidebarPlaylist, SidebarSupportBox } from "./channel/SidebarPlaylist";
import type { SidebarLayout } from "./channel/sidebar-layout-request";
import { AlertCircle } from "./icons";
import { compareSidebarItems } from "@/lib/modules/video/domain/sidebar-order";
import { AppPreloadProvider, useAppPreload } from "./preload/AppPreloadProvider";
import { PreloadProgressBar } from "./preload/PreloadProgressBar";
import { CommentLoadingSkeleton } from "@/components/skeletons";
import {
  useClientReady,
} from "@/app/hooks/useClientEnvironment";

const EmbeddedComments = dynamic(() => import("./comments/EmbeddedComments"), {
  ssr: false,
});

function CommentsMountPlaceholder() {
  return <CommentLoadingSkeleton />;
}

interface ChannelHomeProps {
  mainVideo: PublicVideoDTO | null;
  allVideos: PublicVideoDTO[];
  currentVideoId?: string;
  userProfile?: {
    id: string;
    email: string;
    imageUrl?: string | null;
    totalPaid: number;
    initialInteraction?: { liked: boolean; disliked: boolean };
    initialIsSubscribed?: boolean;
    isPatronDecorative?: boolean;
    role?: string;
  } | null;
  /** Server-rendered sidebar layout, so the playlist is in the first HTML (see HomeExperience). */
  initialSidebarLayout?: SidebarLayout | null;
  /** Viewer the server-rendered layout was built for (`sidebarLayoutViewerKey`). */
  initialSidebarViewerKey?: string;
}

type ChannelViewState = {
  routeVideoId: string | undefined;
  selectedVideoId: string | undefined;
  activeTab: "comments" | "videos";
};


export default function ChannelHome({
  mainVideo,
  allVideos = [],
  currentVideoId,
  userProfile,
  initialSidebarLayout,
  initialSidebarViewerKey,
}: ChannelHomeProps) {
  const selectedVideo =
    (allVideos || []).find(
      (v) => v.id === currentVideoId || v.slug === currentVideoId,
    ) || mainVideo;

  return (
    <AppPreloadProvider selectedVideo={selectedVideo} allVideos={allVideos}>
      <ChannelHomeContent
        mainVideo={mainVideo}
        allVideos={allVideos}
        currentVideoId={currentVideoId}
        userProfile={userProfile}
        initialSidebarLayout={initialSidebarLayout}
        initialSidebarViewerKey={initialSidebarViewerKey}
      />
    </AppPreloadProvider>
  );
}

function scrollToMediaOnMobile() {
  if (typeof window === "undefined") return;

  const isMobileLayout = window.matchMedia?.("(max-width: 1023px)").matches ?? true;
  if (!isMobileLayout) return;

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
}

// Two elements can share id="donations" at once: the always-mounted mobile "videos" tab
// panel's own DonationBox (hidden via CSS at lg: and up, but still in the DOM) and the
// desktop aside's separate SidebarSupportBox/DonationBox. document.getElementById always
// returns the FIRST one in DOM order — the (CSS-hidden) mobile copy — so on desktop a
// scroll targeting it silently did nothing. Query all matches and pick the one that's
// actually laid out (offsetParent is null for display:none elements and their descendants).
function getVisibleDonationsElement(): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>('[id="donations"]');
  for (const el of candidates) {
    if (el.offsetParent !== null) return el;
  }
  return candidates[0] ?? null;
}

function ChannelHomeContent({
  mainVideo,
  allVideos = [],
  currentVideoId,
  userProfile,
  initialSidebarLayout,
  initialSidebarViewerKey,
}: ChannelHomeProps) {
  const { t, language } = useLanguage();
  const [selectionState, setSelectionState] = useState<ChannelViewState>(() => ({
    routeVideoId: currentVideoId,
    selectedVideoId: currentVideoId,
    activeTab: "comments",
  }));
  if (selectionState.routeVideoId !== currentVideoId) {
    setSelectionState({
      routeVideoId: currentVideoId,
      selectedVideoId: currentVideoId,
      activeTab: "comments",
    });
  }
  const clientSelectedVideoId =
    selectionState.routeVideoId === currentVideoId
      ? selectionState.selectedVideoId
      : currentVideoId;
  const selectedVideo =
    (allVideos || []).find(
      (v) => v.id === clientSelectedVideoId || v.slug === clientSelectedVideoId,
    ) || mainVideo;
  const viewerIsPatron = userProfile?.role === 'ADMIN' || userProfile?.isPatronDecorative === true;
  const activeTab = selectionState.activeTab;
  const mounted = useClientReady();
  const preloader = useAppPreload();

  const setActiveTab = (activeTab: "comments" | "videos") => {
    setSelectionState((current) => ({ ...current, activeTab }));
  };

  useEffect(() => {
    if (selectedVideo?.id) {
      scrollToMediaOnMobile();
    }
  }, [selectedVideo?.id]);

  // Shared by the "polutek:open-support" event, dispatched by both AccessLockOverlay's
  // CTA and Hero's "Wspieraj" button. The mobile "videos" tab panel (see its render
  // below) is now ALWAYS mounted — only hidden via a CSS class when not active, the
  // same technique the "comments" panel already used — so #donations always exists in
  // the DOM once signed in, regardless of which tab is showing. That removes the need
  // to wait for anything to mount: switching tabs is just a class toggle, so a single
  // scroll shortly after is enough.
  const revealDonations = useCallback(() => {
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      setActiveTab("videos");
    }
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches ?? false;
    window.setTimeout(() => {
      getVisibleDonationsElement()?.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
      });
    }, 0);
  }, []);

  useEffect(() => {
    window.addEventListener("polutek:open-support", revealDonations);
    return () => window.removeEventListener("polutek:open-support", revealDonations);
  }, [revealDonations]);

  if (!selectedVideo)
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--chan-nav)]">
        <div className="max-w-md w-full rounded-[24px] border border-[var(--cm-line-80)] bg-[var(--cm-card-92-white)] p-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_28px_60px_-28px_rgba(23,23,23,0.24)] animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 flex items-center justify-center mx-auto mb-6 rounded-full bg-[var(--chan-surface)]">
            <AlertCircle size={36} className="text-[var(--chan-muted)]" />
          </div>
          <h1 className="font-brand text-2xl font-bold mb-4 text-[var(--chan-ink)]">
            {language === "pl" ? "Brak zeznań" : "No evidence found"}
          </h1>
          <p className="font-sans text-[var(--chan-muted)] leading-relaxed mb-8">
            {language === "pl"
              ? "Nie znaleziono wybranego filmu. Materiał mógł zostać zarchiwizowany lub przeniesiony."
              : "The selected video could not be found. It might have been archived or moved."}
          </p>
          <Link
            href={getLocalizedHref(language, "home")}
            className="inline-flex items-center justify-center h-[44px] px-10 rounded-[14px] bg-[var(--chan-blue)] text-white font-brand font-bold text-[14px] transition-all active:scale-95 hover:-translate-y-px"
          >
            {language === "pl" ? "Wróć do bazy" : "Back to database"}
          </Link>
        </div>
      </main>
    );

  const sortedVideos = [...(allVideos || [])].sort(compareSidebarItems);

  // Intent (hover/focus/touch-start) warms everything the switch will need —
  // playback plan, poster AND the first page of comments — so a click lands on a
  // ready player and ready comments instead of a spinner and a skeleton.
  const prefetchVideoIntent = (vidId: string) => {
    void preloader?.warmVideo(vidId, { includeComments: true, includePoster: true, priority: "intent" });
  };

  const handleVideoSelect = (clickedId?: string) => {
    if (clickedId && clickedId !== selectedVideo.id) {
      void preloader?.warmVideo(clickedId, { includeComments: true, includePoster: true, priority: "intent" });
      setSelectionState({
        routeVideoId: currentVideoId,
        selectedVideoId: clickedId,
        activeTab: "comments",
      });
      return;
    }
    setActiveTab("comments");
  };

  const commonSidebarProps = {
    sortedVideos,
    selectedVideoId: selectedVideo.id,
    viewerIsPatron,
    t,
    language,
    mounted,
    onVideoMouseEnter: prefetchVideoIntent,
    onVideoSelect: handleVideoSelect,
    initialLayout: initialSidebarLayout,
    initialLayoutViewerKey: initialSidebarViewerKey,
  };

  const comments = (
    <EmbeddedComments
      videoId={selectedVideo.id}
      userProfile={userProfile}
      videoTier={selectedVideo.tier}
    />
  );

  return (
    <>
      <PreloadProgressBar />
      <main className="min-h-screen bg-[var(--chan-nav)] bg-[radial-gradient(circle_at_top_left,var(--cm-blue-9),transparent_34%),radial-gradient(circle_at_top_right,var(--cm-amber-8),transparent_30%),linear-gradient(180deg,var(--cm-card-72),transparent_42%)]">
      <div className="mx-auto max-w-[1180px] px-4 pb-8 md:px-6 lg:px-8 lg:pb-10 lg:pt-5">
        <div className="grid grid-cols-12 gap-5 lg:items-start xl:gap-6">
          <div className="col-span-12 flex flex-col lg:col-span-8">
            <div
              key={selectedVideo.id}
              className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200"
            >
              <Hero
                video={selectedVideo}
                initialInteraction={userProfile?.initialInteraction}
                initialIsSubscribed={userProfile?.initialIsSubscribed}
              />
            </div>

            <div className="-mx-4 mt-5 flex border-b border-[var(--cm-line-80)] font-sans md:-mx-6 lg:hidden">
              {(["comments", "videos"] as const).map((tab) => {
                const isActive = activeTab === tab;
                const accent = tab === "videos" ? "var(--chan-amber)" : "var(--chan-blue)";
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    aria-pressed={isActive}
                    className={cn(
                      "relative flex-1 py-3.5 text-[12px] font-bold not-italic uppercase tracking-[0.14em] transition-colors duration-200 motion-reduce:transition-none",
                      isActive
                        ? tab === "videos"
                          ? "text-[var(--chan-amber-strong)]"
                          : "text-[var(--chan-blue)]"
                        : "text-[var(--chan-muted)] hover:text-[var(--chan-ink)]",
                    )}
                  >
                    {tab === "comments" ? t.comments : t.videosTab}
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-4 -bottom-px h-[2.5px] rounded-full transition-opacity duration-200 motion-reduce:transition-none"
                      style={{ background: accent, opacity: isActive ? 1 : 0 }}
                    />
                  </button>
                );
              })}
            </div>

            <div
              className={cn(
                "mt-3 py-3 border-[var(--cm-line-80)] lg:mt-5 lg:block lg:rounded-[24px] lg:border lg:bg-[var(--cm-card-88-white)] lg:px-5 lg:py-2 lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(23,23,23,0.03),0_22px_48px_-24px_rgba(23,23,23,0.18)]",
                activeTab === "videos" && "hidden",
              )}
            >
              {mounted ? comments : <CommentsMountPlaceholder />}
            </div>
            <div
              data-testid="mobile-videos-panel"
              className={cn("mt-3 py-3 lg:hidden", activeTab !== "videos" && "hidden")}
            >
              <SidebarPlaylist {...commonSidebarProps} />
            </div>
          </div>
          <div className="hidden lg:col-span-4 lg:flex lg:flex-col lg:gap-4">
            <aside className="lg:flex lg:flex-col lg:gap-0 lg:overflow-y-auto rounded-[24px] border border-[var(--cm-line-80)] bg-[var(--cm-card-88-white)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(23,23,23,0.03),0_24px_50px_-26px_rgba(23,23,23,0.2)]">
              <SidebarPlaylist {...commonSidebarProps} showSupportBox={false} />
            </aside>
            <div className="lg:shrink-0">
              <SidebarSupportBox sortedVideos={sortedVideos} viewerIsPatron={viewerIsPatron} />
            </div>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}
