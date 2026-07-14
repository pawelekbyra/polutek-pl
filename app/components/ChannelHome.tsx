"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Hero from "./Hero";
import { PublicVideoDTO } from "../types/video";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getLocalizedHref } from "@/lib/i18n/routing";
import { useLanguage } from "./LanguageContext";
import { SidebarPlaylist, SidebarSupportBox } from "./channel/SidebarPlaylist";
import { AlertCircle } from "./icons";
import { compareSidebarItems } from "@/lib/modules/video/domain/sidebar-order";
import { AppPreloadProvider, useAppPreload } from "./preload/AppPreloadProvider";
import {
  useClientReady,
} from "@/app/hooks/useClientEnvironment";

const EmbeddedComments = dynamic(() => import("./comments/EmbeddedComments"), {
  ssr: false,
});

function CommentsMountPlaceholder() {
  return (
    <div className="min-h-[180px]" aria-hidden="true" />
  );
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

function ChannelHomeContent({
  mainVideo,
  allVideos = [],
  currentVideoId,
  userProfile,
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

  useEffect(() => {
    const openSupport = () => {
      if (!window.matchMedia("(min-width: 1024px)").matches) {
        setActiveTab("videos");
      }
      window.setTimeout(() => {
        const prefersReducedMotion = window.matchMedia?.(
          "(prefers-reduced-motion: reduce)",
        ).matches ?? false;
        document.getElementById("donations")?.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "center",
        });
      }, 0);
    };

    window.addEventListener("polutek:open-support", openSupport);
    return () => window.removeEventListener("polutek:open-support", openSupport);
  }, []);

  if (!selectedVideo)
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--chan-nav)]">
        <div className="max-w-md w-full rounded-[24px] border border-[color-mix(in_srgb,var(--chan-line)_80%,transparent)] bg-[color-mix(in_srgb,var(--chan-card)_92%,white)] p-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_28px_60px_-28px_rgba(23,23,23,0.24)] animate-in fade-in zoom-in duration-500">
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

  const prefetchVideoIntent = (vidId: string) => {
    void preloader?.warmVideo(vidId, { includeComments: false, includePoster: true, priority: "intent" });
  };

  const handleVideoSelect = (clickedId?: string) => {
    if (clickedId && clickedId !== selectedVideo.id) {
      void preloader?.warmVideo(clickedId, { includeComments: false, includePoster: true, priority: "intent" });
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
  };

  const comments = (
    <EmbeddedComments
      videoId={selectedVideo.id}
      userProfile={userProfile}
      videoTier={selectedVideo.tier}
    />
  );

  return (
    <main className="min-h-screen bg-[var(--chan-nav)] bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--chan-blue)_9%,transparent),transparent_34%),radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--chan-amber)_8%,transparent),transparent_30%),linear-gradient(180deg,color-mix(in_srgb,var(--chan-card)_72%,transparent),transparent_42%)]">
      <div className="mx-auto max-w-[1180px] px-4 pb-8 pt-4 md:px-6 lg:px-8 lg:pb-10 lg:pt-5">
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

            <div className="mt-5 lg:hidden">
              <div className="relative flex overflow-hidden rounded-full border border-[color-mix(in_srgb,var(--chan-line)_80%,transparent)] bg-[color-mix(in_srgb,var(--chan-card)_88%,white)] p-1 font-sans shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_20px_-8px_rgba(23,23,23,0.12)]">
                {(["comments", "videos"] as const).map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      aria-pressed={isActive}
                      className={cn(
                        "relative flex-1 rounded-full py-2.5 text-[12px] font-bold not-italic uppercase tracking-[0.14em] transition-all duration-200 motion-reduce:transition-none",
                        isActive
                          ? tab === "videos"
                            ? "bg-[var(--chan-amber-soft)] text-[var(--chan-amber-strong)] shadow-[0_1px_2px_rgba(23,23,23,0.06),0_4px_10px_-4px_rgba(23,23,23,0.14)]"
                            : "bg-[var(--chan-card)] text-[var(--chan-blue)] shadow-[0_1px_2px_rgba(23,23,23,0.06),0_4px_10px_-4px_rgba(23,23,23,0.14)]"
                          : "text-[var(--chan-muted)] hover:text-[var(--chan-ink)]",
                      )}
                    >
                      {tab === "comments" ? t.comments : t.videosTab}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className={cn(
                "mt-3 rounded-[22px] border border-[color-mix(in_srgb,var(--chan-line)_80%,transparent)] bg-[color-mix(in_srgb,var(--chan-card)_88%,white)] px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_18px_40px_-22px_rgba(23,23,23,0.18)] lg:mt-5 lg:block lg:rounded-[24px] lg:px-5 lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(23,23,23,0.03),0_22px_48px_-24px_rgba(23,23,23,0.18)]",
                activeTab === "videos" && "hidden",
              )}
            >
              {mounted ? comments : <CommentsMountPlaceholder />}
            </div>
            {activeTab === "videos" && (
              <div className="mt-3 rounded-[22px] border border-[color-mix(in_srgb,var(--chan-line)_80%,transparent)] bg-[color-mix(in_srgb,var(--chan-card)_88%,white)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_18px_40px_-22px_rgba(23,23,23,0.18)] lg:hidden">
                <SidebarPlaylist {...commonSidebarProps} />
              </div>
            )}
          </div>
          <div className="hidden lg:col-span-4 lg:flex lg:flex-col lg:gap-4">
            <aside className="lg:flex lg:flex-col lg:gap-0 lg:overflow-y-auto rounded-[24px] border border-[color-mix(in_srgb,var(--chan-line)_80%,transparent)] bg-[color-mix(in_srgb,var(--chan-card)_88%,white)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(23,23,23,0.03),0_24px_50px_-26px_rgba(23,23,23,0.2)]">
              <SidebarPlaylist {...commonSidebarProps} showSupportBox={false} />
            </aside>
            <div className="lg:shrink-0">
              <SidebarSupportBox sortedVideos={sortedVideos} viewerIsPatron={viewerIsPatron} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
