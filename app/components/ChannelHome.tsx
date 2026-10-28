"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { openedWithCommentDeepLink, pendingCommentDeepLink, requestCommentDeepLink } from "./comments/deep-link";
import { VIDEO_HISTORY_STATE_KEY, readHistoryVideoId, scrollToMediaOnMobile, type ChannelViewState } from "./channel/home-history";
import { useNotificationVideoNavigation, NOTIFICATION_COMMENT_HISTORY_KEY } from "./notifications/useNotificationVideoNavigation";
import type { InitialCommentsPage } from "./comments/initial-comments";
import { pickHomeVideo } from "@/lib/home-video-selection";
import { ViewerShelves } from "./channel/ViewerShelves";
import type { ContinueWatchingItem } from "@/lib/modules/watch-progress/domain/continue-watching";
import type { PlaylistQueueDto } from "@/lib/modules/playlists/domain/playlist.dto";
import { PlaylistQueueLayer } from "./playlists/PlaylistQueuePanel";
import { planSidebarSwitch } from "./playlists/queue-navigation";
import { TIP_GATE_ENABLED } from "./channel/tip-gate";
import { getVideoDisplayTitle } from "@/lib/video-title-overrides";
import { useVideoDescription } from "./video/useVideoDescription";

// Hidden since 2026-10-21, kept on purpose (see tip-gate.ts).
const SupportModal = dynamic(() => import("./channel/SupportModal"), { ssr: false });

interface ChannelHomeProps {
  mainVideo: PublicVideoDTO | null;
  allVideos: PublicVideoDTO[];
  /**
   * The selected video when `?v=` points outside `allVideos` (another channel or not in the sidebar), already
   * checked for public visibility by the server. It is playable and selectable but is not added to the sidebar.
   */
  extraVideo?: PublicVideoDTO | null;
  currentVideoId?: string;
  userProfile?: {
    id: string;
    email: string;
    imageUrl?: string | null;
    totalPaid: number;
    initialInteraction?: { liked: boolean; disliked: boolean; favorited?: boolean };
    initialIsSubscribed?: boolean;
    initialNotify?: boolean;
    /** The viewer's saved position in the server-selected video (resume watching). */
    initialProgressSeconds?: number | null;
    role?: string;
  } | null;
  /** The signed-in viewer's unfinished videos ("Continue watching"), computed on the server. */
  continueWatching?: ContinueWatchingItem[] | null;
  /** Server-rendered sidebar layout, so the playlist is in the first HTML (see HomeExperience). */
  initialSidebarLayout?: SidebarLayout | null;
  /** Viewer the server-rendered layout was built for (`sidebarLayoutViewerKey`). */
  initialSidebarViewerKey?: string;
  /** The playlist the page was opened in (`?list=<slug>`), already filtered for this viewer (docs/architecture/playlists.md). */
  playlistQueue?: PlaylistQueueDto | null;
  /** First page of the selected video's comments, rendered on the server. */
  initialComments?: InitialCommentsPage | null;
  /** The selected video's playback plan, made on the server for this viewer. */
  initialPlayback?: InitialPlaybackPlan | null;
  /** Server render time (ISO): the clock for relative dates in the first render. */
  renderedAt?: string;
}




export default function ChannelHome({
  mainVideo,
  allVideos = [],
  extraVideo = null,
  currentVideoId,
  userProfile,
  initialSidebarLayout,
  initialSidebarViewerKey,
  initialComments,
  initialPlayback,
  renderedAt,
  continueWatching,
  playlistQueue,
}: ChannelHomeProps) {
  const selectedVideo = pickHomeVideo(currentVideoId, { allVideos: allVideos || [], mainVideo, extraVideo });
  // The preloader looks videos up by id, so it also knows the extra one (the sidebar does not).
  const preloadVideos = extraVideo && !(allVideos || []).some((v) => v.id === extraVideo.id) ? [...(allVideos || []), extraVideo] : allVideos;

  return (
    <RenderClockProvider renderedAt={renderedAt}>
    <AppPreloadProvider selectedVideo={selectedVideo} allVideos={preloadVideos} initialPlayback={initialPlayback}>
      <ChannelHomeContent
        mainVideo={mainVideo}
        allVideos={allVideos}
        extraVideo={extraVideo}
        currentVideoId={currentVideoId}
        userProfile={userProfile}
        initialSidebarLayout={initialSidebarLayout}
        initialSidebarViewerKey={initialSidebarViewerKey}
        initialComments={initialComments}
        continueWatching={continueWatching}
        playlistQueue={playlistQueue}
      />
    </AppPreloadProvider>
    </RenderClockProvider>
  );
}


function ChannelHomeContent({
  mainVideo,
  allVideos = [],
  extraVideo = null,
  currentVideoId,
  userProfile,
  initialSidebarLayout,
  initialSidebarViewerKey,
  initialComments,
  continueWatching,
  playlistQueue,
}: ChannelHomeProps) {
  const { t, language, tx } = useLanguage();
  // Playlist context stays until the viewer picks a video outside the playlist.
  const [closedQueueSlug, setClosedQueueSlug] = useState<string | null>(null);
  const queue = playlistQueue && playlistQueue.slug !== closedQueueSlug ? playlistQueue : null;
  const [selectionState, setSelectionState] = useState<ChannelViewState>(() => ({
    routeVideoId: currentVideoId,
    selectedVideoId: currentVideoId,
    activeTab: "comments",
    startWithSound: false,
  }));
  const resolveVideoId = (idOrSlug: string | undefined) =>
    pickHomeVideo(idOrSlug, { allVideos: allVideos || [], mainVideo, extraVideo })?.id;
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
  // The list has no descriptions (W03): the open video's one comes from the server or is fetched here.
  const selectedVideo = useVideoDescription(pickHomeVideo(clientSelectedVideoId, { allVideos: allVideos || [], mainVideo, extraVideo }));
  // The server computed the viewer's like/dislike only for the video it rendered;
  // after a shallow switch Hero fetches it for the newly selected video itself.
  const serverInteractionVideoId = resolveVideoId(currentVideoId);
  const activeTab = selectionState.activeTab;
  const preloader = useAppPreload();
  useNotificationVideoNavigation({ videos: [mainVideo, extraVideo, ...allVideos], language, onSelect: (id, comment) => {
    focusTitleRef.current = !comment;
    if (queue) setClosedQueueSlug(queue.slug);
    preloader?.selectVideo(id);
    void preloader?.warmVideo(id, { includeComments: true, priority: "critical" });
    setSelectionState({ routeVideoId: currentVideoId, selectedVideoId: id, activeTab: "comments", startWithSound: !comment });
  } });


  const setActiveTab = (activeTab: "comments" | "videos") => {
    setSelectionState((current) => ({ ...current, activeTab }));
  };

  // Comment targets own the scroll; ordinary mobile selections scroll to the player.
  const firstMediaScroll = useRef(true);
  useEffect(() => {
    const first = firstMediaScroll.current;
    firstMediaScroll.current = false;
    if ((first && openedWithCommentDeepLink()) || pendingCommentDeepLink()) return;
    if (selectedVideo?.id) {
      scrollToMediaOnMobile();
    }
  }, [selectedVideo?.id]);

  // Restore shallow video selections on Back/Forward; tag the initial entry too.
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
      const target = event.state?.[NOTIFICATION_COMMENT_HISTORY_KEY];
      if (typeof target === "string") requestCommentDeepLink(target);
      // Back/Forward is not a gesture on the player: the video starts muted (unmute hint shown).
      setSelectionState((current) => ({ ...current, selectedVideoId: videoId, activeTab: "comments", startWithSound: false }));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // Tagging the initial entry must happen once, for the video the page opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The logo restores the hero locally and the plain home URL.
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

  // Announce local selections and focus their title after deliberate picks (§4.13).
  const focusTitleRef = useRef(false);
  const announcedVideoRef = useRef<string | undefined>(selectedId);
  const [announcement, setAnnouncement] = useState("");
  const selectedTitle = selectedVideo ? getVideoDisplayTitle(selectedVideo, language) : "";
  useEffect(() => {
    if (!selectedId || announcedVideoRef.current === selectedId) return;
    announcedVideoRef.current = selectedId;
    setAnnouncement(tx("Wybrano film: {0}", "Now showing: {0}", selectedTitle));
    if (focusTitleRef.current) {
      focusTitleRef.current = false;
      document.getElementById("video-title")?.focus({ preventScroll: true });
    }
    // The announcement text is built once per switch; a language change alone must not repeat it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Hidden since 2026-10-21, kept on purpose: the tip gate (SupportModal) is switched off by TIP_GATE_ENABLED, so
  // nothing opens it (the "polutek:open-support" event has no dispatcher, the URL triggers below are inert). It is
  // mounted only while open, so Stripe.js would be loaded only by viewers who actually open it.
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const openSupport = useCallback(() => setIsSupportModalOpen(true), []);

  useEffect(() => {
    if (!TIP_GATE_ENABLED) return;
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
    if (!TIP_GATE_ENABLED || !userProfile || !(wantsSupport || isStripeReturn)) return;
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

  // Sidebar intent warms playback and comments. A deliberate pick starts with sound.
  // `query` carries the slug and optional playlist context, without the leading "?".
  const switchVideo = (clickedId: string, query: string, auto = false) => {
    // A deliberate pick moves the keyboard focus to the new video's title (the sidebar item it came from is
    // re-rendered); an automatic hand-over (the playlist's next video) never takes the focus.
    focusTitleRef.current = !auto;
    preloader?.selectVideo(clickedId);
    void preloader?.warmVideo(clickedId, { includeComments: true, priority: "critical" });
    setSelectionState({
      routeVideoId: currentVideoId,
      selectedVideoId: clickedId,
      activeTab: "comments",
      startWithSound: true,
    });
    // Shallow switch: address and history without a server round trip (a router navigation re-rendered the whole
    // page and showed the loading screen on every click; Next.js syncs its router with history.pushState).
    try {
      window.history.pushState({ [VIDEO_HISTORY_STATE_KEY]: clickedId }, "", `${getLocalizedHref(language, "home")}?${query}`);
    } catch {
      // Selection already switched locally; a failed URL update is only cosmetic.
    }
  };

  const handleVideoSelect = (clickedId?: string) => {
    if (clickedId && clickedId !== selectedVideo.id) {
      const plan = planSidebarSwitch(queue, clickedId, (allVideos || []).find((v) => v.id === clickedId)?.slug);
      if (plan.leaveQueue && queue) setClosedQueueSlug(queue.slug);
      switchVideo(clickedId, plan.query);
      return;
    }
    setActiveTab("comments");
  };

  // A shelf item opens its video in place when it is one of the home list's, else by address.
  const handleContinueWatchingSelect = (item: Pick<ContinueWatchingItem, "videoId" | "slug">) => {
    const known = [...(allVideos || []), ...(extraVideo ? [extraVideo] : [])].find((v) => v.id === item.videoId);
    if (known) {
      handleVideoSelect(known.id);
      return;
    }
    window.location.assign(`${getLocalizedHref(language, "home")}?v=${encodeURIComponent(item.slug)}`);
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

  const queueLayer = (autoAdvance: boolean) =>
    queue ? (
      <PlaylistQueueLayer
        queue={queue}
        currentVideoId={selectedVideo.id}
        knownVideoIds={[...(allVideos || []), ...(extraVideo ? [extraVideo] : [])].map((v) => v.id)}
        language={language}
        onSwitch={(videoId, query, auto) => switchVideo(videoId, query, auto)}
        autoAdvance={autoAdvance}
      />
    ) : null;

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
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
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
                // The server resolved the subscription for the video it selected; another video may belong
                // to another channel, so the button asks the API for that one.
                initialIsSubscribed={selectedVideo.id === serverInteractionVideoId ? userProfile?.initialIsSubscribed : undefined}
                initialNotify={selectedVideo.id === serverInteractionVideoId ? userProfile?.initialNotify : undefined}
                startWithSound={selectionState.startWithSound}
                initialProgressSeconds={
                  selectedVideo.id === serverInteractionVideoId ? userProfile?.initialProgressSeconds : undefined
                }
              />
            </div>

            {queue && <div className="mb-1 lg:hidden">{queueLayer(true)}</div>}

            {userProfile && <ViewerShelves continueWatching={continueWatching ?? []} currentVideoId={selectedVideo.id} onSelect={handleContinueWatchingSelect} />}

            <div id="watch-tabs" className="-mx-4 mt-5 flex border-b border-[var(--cm-line-80)] font-sans md:-mx-6 lg:hidden">
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
            {queueLayer(false)}
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
