"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Hero from "./Hero";
import { PublicVideoDTO } from "../types/video";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useLanguage } from "./LanguageContext";
import { SidebarPlaylist } from "./channel/SidebarPlaylist";
import { AlertCircle } from "./icons";
import { compareSidebarItems } from "@/lib/modules/video/domain/sidebar-order";
import { Frame, INK } from "./najs/primitives";
import { useIrisTransition } from "./channel/IrisTransition";
import { AppPreloadProvider, useAppPreload } from "./preload/AppPreloadProvider";

const EmbeddedComments = dynamic(() => import("./comments/EmbeddedComments"), {
  ssr: false,
  loading: () => <CommentsShellSkeleton />,
});

function CommentsShellSkeleton() {
  return (
    <div className="py-10 space-y-4" role="status" aria-live="polite" aria-label="Loading comments">
      <div className="flex items-center justify-between gap-3">
        <div className="h-4 w-32 rounded-full bg-[#d8d0bd]/70 motion-reduce:animate-none animate-pulse" />
        <div className="h-4 w-24 rounded-full bg-[#d8d0bd]/60 motion-reduce:animate-none animate-pulse" />
      </div>
      <div className="rounded-2xl border border-dashed border-[#d8d0bd] bg-[#f8f3e7]/55 p-4 space-y-3">
        <div className="h-3 w-2/3 rounded-full bg-[#d8d0bd]/65 motion-reduce:animate-none animate-pulse" />
        <div className="h-3 w-full rounded-full bg-[#d8d0bd]/55 motion-reduce:animate-none animate-pulse" />
        <div className="h-3 w-5/6 rounded-full bg-[#d8d0bd]/55 motion-reduce:animate-none animate-pulse" />
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

function ChannelHomeContent({
  mainVideo,
  allVideos = [],
  currentVideoId,
  userProfile,
}: ChannelHomeProps) {
  const { t, language } = useLanguage();
  const selectedVideo =
    (allVideos || []).find(
      (v) => v.id === currentVideoId || v.slug === currentVideoId,
    ) || mainVideo;
  const viewerIsPatron = userProfile?.role === 'ADMIN' || userProfile?.isPatronDecorative === true;
  const [activeTab, setActiveTab] = useState<"comments" | "videos">("comments");
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const iris = useIrisTransition();
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
      window.scrollTo({ top: 0, behavior: "smooth" });
      // The newly selected video is committed to the screen — open the iris over it.
      iris.contentReady();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideo?.id]);

  if (!selectedVideo)
    return (
      <main className="bg-transparent min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full relative p-10 text-center animate-in fade-in zoom-in duration-500">
          <Frame radius={16} seed={9} stroke={INK} strokeWidth={1.3} fill="rgba(248,243,231,.97)" />
          <div className="relative z-10">
            <div className="w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={40} className="text-[#71717a]" />
            </div>
            <h1 className="text-2xl font-bold mb-4 text-[#171717]" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
              {language === "pl" ? "Brak zeznań" : "No evidence found"}
            </h1>
            <p className="text-[#71717a] leading-relaxed mb-8" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
              {language === "pl"
                ? "Nie znaleziono wybranego filmu. Materiał mógł zostać zarchiwizowany lub przeniesiony."
                : "The selected video could not be found. It might have been archived or moved."}
            </p>
            <Link
              href="/"
              className="relative inline-flex items-center justify-center h-[44px] px-10 text-white font-bold text-[14px] transition-all active:scale-95 overflow-hidden rounded-[22px] bg-[#171717]"
              style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}
            >
              {language === "pl" ? "Wróć do bazy" : "Back to database"}
            </Link>
          </div>
        </div>
      </main>
    );

  const sortedVideos = [...(allVideos || [])].sort(compareSidebarItems);

  const prefetchVideoIntent = (vidId: string) => {
    void preloader?.warmVideo(vidId, { includeComments: false, includePoster: true, priority: "intent" });
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
    onVideoSelect: (clickedId?: string) => {
      // Cinematic iris wipe: close over the current scene, reveal the next once it's in place.
      // Skipped when re-clicking the already-active video — there is no scene change to reveal.
      if (clickedId && clickedId !== selectedVideo.id) {
        void preloader?.warmVideo(clickedId, { includeComments: false, includePoster: true, priority: "intent" });
        iris.trigger();
      }
      setActiveTab("comments");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  };

  const comments = (
    <EmbeddedComments
      videoId={selectedVideo.id}
      userProfile={userProfile}
      videoTier={selectedVideo.tier}
    />
  );

  return (
    <main className="bg-transparent min-h-screen">
      {iris.element}
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-6 py-6">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8">
            <Hero
              video={selectedVideo}
              initialInteraction={userProfile?.initialInteraction}
              initialIsSubscribed={userProfile?.initialIsSubscribed}
            />

            {!mounted ? (
              <div className="comments-paper-shell mt-4">
                <CommentsShellSkeleton />
              </div>
            ) : isDesktop ? (
              <div className="comments-paper-shell hidden lg:block mt-4">
                {comments}
              </div>
            ) : (
              <>
                <div className="lg:hidden mt-4">
                  <div className="relative flex overflow-hidden rounded-2xl border border-[#e4dcc8] bg-[#f1ebdd]/80 p-1 font-sans shadow-[0_2px_8px_rgba(23,23,23,0.05)]">
                    {(["comments", "videos"] as const).map((tab) => {
                      const isActive = activeTab === tab;
                      return (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          aria-pressed={isActive}
                          className={cn(
                            "relative flex-1 rounded-xl py-2.5 text-[13px] font-bold not-italic uppercase tracking-widest transition-all duration-200",
                            isActive
                              ? "bg-[#171717] text-[#f8f3e7] shadow-[0_6px_20px_rgba(0,0,0,0.18)]"
                              : "text-[#171717]/55 hover:bg-[#fffaf0]/70 hover:text-[#171717]/80",
                          )}
                        >
                          {tab === "comments" ? t.comments : t.videosTab}
                          {isActive && (
                            <span
                              aria-hidden="true"
                              className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[#2563eb] shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="comments-paper-shell lg:hidden mt-2">
                  {activeTab === "comments" ? comments : (
                    <div className="space-y-2">
                      <SidebarPlaylist {...commonSidebarProps} />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <aside className="hidden lg:block lg:col-span-4 space-y-2">
            <SidebarPlaylist {...commonSidebarProps} />
          </aside>
        </div>
      </div>
    </main>
  );
}
