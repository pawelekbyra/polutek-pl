"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Hero from "./Hero";
import { PublicVideoDTO } from "../types/video";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { useLanguage } from "./LanguageContext";
import { GO_HOME_EVENT } from "./BrandHomeLink";
import { SidebarPlaylist } from "./channel/SidebarPlaylist";
import type { SidebarLayout } from "./channel/sidebar-layout-request";
import { AlertCircle } from "./icons";
import { compareSidebarItems } from "@/lib/modules/video/domain/sidebar-order";
import { AppPreloadProvider, useAppPreload } from "./preload/AppPreloadProvider";
import type { InitialPlaybackPlan } from "./preload/initial-playback-plan";
import { PreloadProgressBar } from "./preload/PreloadProgressBar";
import { RenderClockProvider } from "./RenderClock";
import { useSearchParams } from "next/navigation";
// Rendered on the server with its first page (HomeExperience), so the list is in the first HTML.
import EmbeddedComments from "./comments/EmbeddedComments";
import type { InitialCommentsPage } from "./comments/initial-comments";

const SupportModal = dynamic(() => import("./channel/SupportModal"), { ssr: false });

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
    role?: string;
  } | null;
  /** Server-rendered sidebar layout, so the playlist is in the first HTML (see HomeExperience). */
  initialSidebarLayout?: SidebarLayout | null;
  /** Viewer the server-rendered layout was built for (`sidebarLayoutViewerKey`). */
  initialSidebarViewerKey?: string;
  /** First page of the selected video's comments, rendered on the server. */
  initialComments?: InitialCommentsPage | null;
  /** The selected video's playback plan, made on the server for this viewer. */
  initialPlayback?: InitialPlaybackPlan | null;
  /** Server render time (ISO): the clock for relative dates in the first render. */
  renderedAt?: string;
}

type ChannelViewState = {
  routeVideoId: string | undefined;
  selectedVideoId: string | undefined;
  activeTab: "comments" | "videos";
  /**
   * The selected video was picked with a click or tap (a user gesture, so the browser lets it
   * start with sound). Never set for the first video, a route change or Back/Forward.
   */
  startWithSound: boolean;
};


export default function ChannelHome({
  mainVideo,
  allVideos = [],
  currentVideoId,
  userProfile,
  initialSidebarLayout,
  initialSidebarViewerKey,
  initialComments,
  initialPlayback,
  renderedAt,
}: ChannelHomeProps) {
  const selectedVideo =
    (allVideos || []).find(
      (v) => v.id === currentVideoId || v.slug === currentVideoId,
    ) || mainVideo;

  return (
    <RenderClockProvider renderedAt={renderedAt}>
    <AppPreloadProvider selectedVideo={selectedVideo} allVideos={allVideos} initialPlayback={initialPlayback}>
      <ChannelHomeContent
        mainVideo={mainVideo}
        allVideos={allVideos}
        currentVideoId={currentVideoId}
        userProfile={userProfile}
        initialSidebarLayout={initialSidebarLayout}
        initialSidebarViewerKey={initialSidebarViewerKey}
        initialComments={initialComments}
      />
    </AppPreloadProvider>
    </RenderClockProvider>
  );
}

function scrollToMediaOnMobile() {
  if (typeof window === "undefined") return;

  const isMobileLayout = window.matchMedia?.("(max-width: 1023px)").matches ?? true;
  if (!isMobileLayout) return;

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
}

// Key under which a shallow video switch stores the selected video in the history
// entry's state, so Back/Forward can restore it without a server round trip.
const VIDEO_HISTORY_STATE_KEY = "polutekVideoId";

function readHistoryVideoId(state: unknown): string | undefined {
  if (!state || typeof state !== "object") return undefined;
  const value = (state as Record<string, unknown>)[VIDEO_HISTORY_STATE_KEY];
  return typeof value === "string" ? value : undefined;
}

function ChannelHomeContent({
  mainVideo,
  allVideos = [],
  currentVideoId,
  userProfile,
  initialSidebarLayout,
  initialSidebarViewerKey,
  initialComments,
}: ChannelHomeProps) {
  const { t, language, tx } = useLanguage();
  const [selectionState, setSelectionState] = useState<ChannelViewState>(() => ({
    routeVideoId: currentVideoId,
    selectedVideoId: currentVideoId,
    activeTab: "comments",
    startWithSound: false,
  }));
  const resolveVideoId = (idOrSlug: string | undefined) =>
    ((allVideos || []).find((v) => v.id === idOrSlug || v.slug === idOrSlug) || mainVideo)?.id;
  if (selectionState.routeVideoId !== currentVideoId) {
    // The server route changed (a real navigation, or a refresh of the URL a shallow
    // switch already pushed). Keep the open tab when it's still the same video.
    const sameVideo = resolveVideoId(currentVideoId) === resolveVideoId(selectionState.selectedVideoId);
    setSelectionState({
      routeVideoId: currentVideoId,
      selectedVideoId: currentVideoId,
      activeTab: sameVideo ? selectionState.activeTab : "comments",
      startWithSound: sameVideo && selectionState.startWithSound,
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
  // The server computed the viewer's like/dislike only for the video it rendered;
  // after a shallow switch Hero fetches it for the newly selected video itself.
  const serverInteractionVideoId = resolveVideoId(currentVideoId);
  const activeTab = selectionState.activeTab;
  const preloader = useAppPreload();

  const setActiveTab = (activeTab: "comments" | "videos") => {
    setSelectionState((current) => ({ ...current, activeTab }));
  };

  useEffect(() => {
    if (selectedVideo?.id) {
      scrollToMediaOnMobile();
    }
  }, [selectedVideo?.id]);

  // Back/Forward across shallow video switches: restore the video recorded in the
  // history entry. The first entry is tagged on mount so Back can return to it.
  useEffect(() => {
    try {
      if (!readHistoryVideoId(window.history.state) && selectedVideo?.id) {
        window.history.replaceState(
          { ...(window.history.state ?? {}), [VIDEO_HISTORY_STATE_KEY]: selectedVideo.id },
          "",
        );
      }
    } catch {
      // History state is a convenience; never let it break the page.
    }
    const onPopState = (event: PopStateEvent) => {
      const videoId = readHistoryVideoId(event.state);
      if (!videoId) return;
      // Back/Forward is not a gesture on the player: the video starts muted (unmute hint shown).
      setSelectionState((current) => ({ ...current, selectedVideoId: videoId, activeTab: "comments", startWithSound: false }));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // Tagging the initial entry must happen once, for the video the page opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The logo ("polutek:go-home"): back to the hero video. A shallow switch like picking a video in the
  // sidebar (no server round trip, no loading screen); the address goes back to the plain home URL.
  const heroId = mainVideo?.id;
  const selectedId = selectedVideo?.id;
  const goToHero = useCallback(() => {
    if (!heroId || selectedId === heroId) return;
    preloader?.selectVideo(heroId);
    void preloader?.warmVideo(heroId, { includeComments: true, priority: "critical" });
    // A click is a user gesture, so the hero starts with sound.
    setSelectionState({ routeVideoId: currentVideoId, selectedVideoId: heroId, activeTab: "comments", startWithSound: true });
    try {
      window.history.pushState({ [VIDEO_HISTORY_STATE_KEY]: heroId }, "", getLocalizedHref(language, "home"));
    } catch {
      // Selection already switched locally; a failed URL update is only cosmetic.
    }
  }, [heroId, selectedId, preloader, currentVideoId, language]);

  useEffect(() => {
    window.addEventListener(GO_HOME_EVENT, goToHero);
    return () => window.removeEventListener(GO_HOME_EVENT, goToHero);
  }, [goToHero]);

  // The tip gate (SupportModal) opens on the "polutek:open-support" event, dispatched by Hero's
  // "Wspieraj" button and AccessLockOverlay. It is mounted only while open, so Stripe.js is loaded
  // only by viewers who actually open it.
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const openSupport = useCallback(() => setIsSupportModalOpen(true), []);

  useEffect(() => {
    window.addEventListener("polutek:open-support", openSupport);
    return () => window.removeEventListener("polutek:open-support", openSupport);
  }, [openSupport]);

  // It also opens for signed-in viewers from a URL: an external `?support=1` deep link (stripped
  // at once, so a refresh doesn't reopen it) and a Stripe redirect return
  // (`?success=true&payment_id=…`), which lands on the thank-you step.
  const searchParams = useSearchParams();
  const wantsSupport = searchParams.get("support") === "1";
  const isStripeReturn = searchParams.get("success") === "true" && Boolean(searchParams.get("payment_id"));
  useEffect(() => {
    if (!userProfile || !(wantsSupport || isStripeReturn)) return;
    setIsSupportModalOpen(true);
    if (wantsSupport) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("support");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      } catch {
        // Cosmetic only.
      }
    }
  }, [wantsSupport, isStripeReturn, userProfile]);

  if (!selectedVideo)
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--chan-nav)]">
        <div className="max-w-md w-full rounded-[24px] border border-[var(--cm-line-80)] bg-[var(--cm-card-92-white)] p-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_28px_60px_-28px_rgba(23,23,23,0.24)] animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 flex items-center justify-center mx-auto mb-6 rounded-full bg-[var(--chan-surface)]">
            <AlertCircle size={36} className="text-[var(--chan-muted)]" />
          </div>
          <h1 className="font-brand text-2xl font-bold mb-4 text-[var(--chan-ink)]">
            {tx("Brak zeznań", "No evidence found")}
          </h1>
          <p className="font-sans text-[var(--chan-muted)] leading-relaxed mb-8">
            {tx("Nie znaleziono wybranego filmu. Materiał mógł zostać zarchiwizowany lub przeniesiony.", "The selected video could not be found. It might have been archived or moved.")}
          </p>
          <Link
            href={getLocalizedHref(language, "home")}
            className="inline-flex items-center justify-center h-[44px] px-10 rounded-[14px] bg-[var(--chan-blue)] text-white font-brand font-bold text-[14px] transition-all active:scale-95 hover:-translate-y-px"
          >
            {tx("Wróć do bazy", "Back to database")}
          </Link>
        </div>
      </div>
    );

  const sortedVideos = [...(allVideos || [])].sort(compareSidebarItems);

  // Intent (hover/focus/touch) is handled by SidebarPlaylist: it warms the playback plan, the
  // first seconds of the stream and the first page of comments, so a click lands on a ready
  // player and ready comments instead of a spinner and a skeleton.
  // Called from a click/tap (a user gesture), so the picked video starts with sound.
  const handleVideoSelect = (clickedId?: string) => {
    if (clickedId && clickedId !== selectedVideo.id) {
      preloader?.selectVideo(clickedId);
      void preloader?.warmVideo(clickedId, { includeComments: true, priority: "critical" });
      setSelectionState({
        routeVideoId: currentVideoId,
        selectedVideoId: clickedId,
        activeTab: "comments",
        startWithSound: true,
      });
      // Shallow switch: update the address and history without a server round trip.
      // A router navigation here re-rendered the whole page on the server and showed
      // the route's loading screen on every click. Next.js syncs its router with
      // history.pushState, so useSearchParams, refreshes and deep links stay correct.
      const clicked = (allVideos || []).find((v) => v.id === clickedId);
      try {
        window.history.pushState(
          { [VIDEO_HISTORY_STATE_KEY]: clickedId },
          "",
          `${getLocalizedHref(language, "home")}?v=${encodeURIComponent(clicked?.slug || clickedId)}`,
        );
      } catch {
        // Selection already switched locally; a failed URL update is only cosmetic.
      }
      return;
    }
    setActiveTab("comments");
  };

  const commonSidebarProps = {
    sortedVideos,
    selectedVideoId: selectedVideo.id,
    t,
    language,
    onVideoSelect: handleVideoSelect,
    initialLayout: initialSidebarLayout,
    initialLayoutViewerKey: initialSidebarViewerKey,
  };

  const comments = (
    <EmbeddedComments
      videoId={selectedVideo.id}
      userProfile={userProfile}
      initialComments={initialComments}
    />
  );

  return (
    <>
      <PreloadProgressBar />
      <div className="min-h-screen bg-[var(--chan-nav)] bg-[radial-gradient(circle_at_top_left,var(--cm-blue-9),transparent_34%),radial-gradient(circle_at_top_right,var(--cm-amber-8),transparent_30%),linear-gradient(180deg,var(--cm-card-72),transparent_42%)]">
      <div className="mx-auto max-w-[1180px] px-4 pb-8 md:px-6 lg:px-8 lg:pb-10 lg:pt-5">
        <div className="grid grid-cols-12 gap-5 lg:items-start xl:gap-6">
          <div className="col-span-12 flex flex-col lg:col-span-8">
            <div
              key={selectedVideo.id}
              className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200"
            >
              <Hero
                video={selectedVideo}
                initialInteraction={
                  selectedVideo.id === serverInteractionVideoId ? userProfile?.initialInteraction : undefined
                }
                initialIsSubscribed={userProfile?.initialIsSubscribed}
                startWithSound={selectionState.startWithSound}
              />
            </div>

            <div className="-mx-4 mt-5 flex border-b border-[var(--cm-line-80)] font-sans md:-mx-6 lg:hidden">
              {(["comments", "videos"] as const).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    aria-pressed={isActive}
                    className={cn(
                      "relative flex-1 py-3.5 text-[12px] font-bold not-italic uppercase tracking-[0.14em] transition-colors duration-200 motion-reduce:transition-none",
                      isActive ? "text-[var(--chan-blue)]" : "text-[var(--chan-muted)] hover:text-[var(--chan-ink)]",
                    )}
                  >
                    {tab === "comments" ? t.comments : t.videosTab}
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-4 -bottom-px h-[2.5px] rounded-full transition-opacity duration-200 motion-reduce:transition-none"
                      style={{ background: "var(--chan-blue)", opacity: isActive ? 1 : 0 }}
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
              {comments}
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
              <SidebarPlaylist {...commonSidebarProps} />
            </aside>
          </div>
        </div>
      </div>
      {isSupportModalOpen && (
        <SupportModal onClose={() => setIsSupportModalOpen(false)} />
      )}
    </div>
    </>
  );
}
