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

const EmbeddedComments = dynamic(() => import("./comments/EmbeddedComments"), {
  ssr: false,
});

function CommentsShellSkeleton() {
  return (
    <div className="py-10 space-y-4" role="status" aria-live="polite" aria-label="Loading comments">
      <div className="flex items-center justify-between gap-3">
        <div className="h-4 w-32 rounded-full bg-[var(--chan-line)] motion-reduce:animate-none animate-pulse" />
        <div className="h-4 w-24 rounded-full bg-[var(--chan-line)] motion-reduce:animate-none animate-pulse" />
      </div>
      <div className="rounded-2xl border border-dashed border-[var(--chan-line-soft)] bg-[var(--chan-surface)] p-4 space-y-3">
        <div className="h-3 w-2/3 rounded-full bg-[var(--chan-line)] motion-reduce:animate-none animate-pulse" />
        <div className="h-3 w-full rounded-full bg-[var(--chan-line)] motion-reduce:animate-none animate-pulse" />
        <div className="h-3 w-5/6 rounded-full bg-[var(--chan-line)] motion-reduce:animate-none animate-pulse" />
      </div>
    </div>
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
  const [clientSelectedVideoId, setClientSelectedVideoId] = useState(currentVideoId);
  const selectedVideo =
    (allVideos || []).find(
      (v) => v.id === clientSelectedVideoId || v.slug === clientSelectedVideoId,
    ) || mainVideo;
  const viewerIsPatron = userProfile?.role === 'ADMIN' || userProfile?.isPatronDecorative === true;
  const [activeTab, setActiveTab] = useState<"comments" | "videos">("comments");
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const preloader = useAppPreload();

  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateViewport = () => setIsDesktop(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (selectedVideo?.id) {
      setActiveTab("comments");
      scrollToMediaOnMobile();
    }
  }, [selectedVideo?.id]);

  if (!selectedVideo)
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--chan-nav)]">
        <div className="max-w-md w-full rounded-[22px] border border-[var(--chan-line)] bg-white p-10 text-center animate-in fade-in zoom-in duration-500">
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
            className="inline-flex items-center justify-center h-[44px] px-10 rounded-[14px] bg-[#2563EB] text-white font-brand font-bold text-[14px] transition-all active:scale-95 hover:-translate-y-px"
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
      setClientSelectedVideoId(clickedId);
    }
    setActiveTab("comments");
  };

  const commonSidebarProps = {
    sortedVideos,
    selectedVideoId: selectedVideo.id,
    userProfile,
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
    <main className="min-h-screen bg-[var(--chan-nav)] bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--chan-blue)_9%,transparent),transparent_34%),linear-gradient(180deg,color-mix(in_srgb,var(--chan-card)_72%,transparent),transparent_42%)]">
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

            {isDesktop ? (
              <div className="mt-5 hidden rounded-[24px] border border-[var(--chan-line)] bg-[color-mix(in_srgb,var(--chan-card)_84%,white)] px-5 py-2 shadow-[0_12px_30px_rgba(23,23,23,0.045)] lg:block">
                {mounted ? comments : <CommentsShellSkeleton />}
              </div>
            ) : mounted ? (
              <>
                <div className="mt-5 lg:hidden">
                  <div className="relative flex overflow-hidden rounded-2xl border border-[var(--chan-line)] bg-[color-mix(in_srgb,var(--chan-card)_86%,white)] p-1 font-sans shadow-[0_8px_20px_rgba(23,23,23,0.045)]">
                    {(["comments", "videos"] as const).map((tab) => {
                      const isActive = activeTab === tab;
                      return (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          aria-pressed={isActive}
                          className={cn(
                            "relative flex-1 rounded-xl py-2.5 text-[12px] font-bold not-italic uppercase tracking-widest transition-all duration-200",
                            isActive
                              ? "bg-white text-[#2563EB] shadow-sm"
                              : "text-[var(--chan-muted)] hover:text-[var(--chan-ink)]",
                          )}
                        >
                          {tab === "comments" ? t.comments : t.videosTab}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3 lg:hidden">
                  {activeTab === "comments" ? (
                    <div className="rounded-[22px] border border-[var(--chan-line)] bg-[color-mix(in_srgb,var(--chan-card)_86%,white)] px-4 py-2 shadow-[0_10px_26px_rgba(23,23,23,0.045)]">{comments}</div>
                  ) : (
                    <div className="rounded-[22px] border border-[var(--chan-line)] bg-[color-mix(in_srgb,var(--chan-card)_84%,white)] p-3 shadow-[0_10px_26px_rgba(23,23,23,0.045)]">
                      <SidebarPlaylist {...commonSidebarProps} />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-2">
                <CommentsShellSkeleton />
              </div>
            )}
          </div>
          <div className="hidden lg:col-span-4 lg:flex lg:flex-col lg:gap-4">
            <aside className="lg:flex lg:flex-col lg:gap-0 lg:overflow-y-auto rounded-[24px] border border-[var(--chan-line)] bg-[color-mix(in_srgb,var(--chan-card)_82%,white)] p-3 shadow-[0_16px_38px_rgba(23,23,23,0.055)]">
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
