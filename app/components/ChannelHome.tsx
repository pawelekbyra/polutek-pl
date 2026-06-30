"use client";

import React, { useEffect, useState } from "react";
import Hero from "./Hero";
import EmbeddedComments from "./comments/EmbeddedComments";
import { PublicVideoDTO } from "../types/video";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useLanguage } from "./LanguageContext";
import { SidebarPlaylist } from "./channel/SidebarPlaylist";
import { AlertCircle } from "./icons";
import { compareSidebarItems } from "@/lib/services/content/sidebar-order";
import { Frame, NajsSeparator, INK } from "./najs/primitives";

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

const PATRON_PREMIERE_DATE = new Date("2026-10-13T00:00:00+02:00");

const formatPremiereCountdown = (targetDate: Date, language: string) => {
  const remainingMs = targetDate.getTime() - Date.now();
  if (remainingMs <= 0)
    return language === "pl"
      ? "Premiera już dostępna"
      : "Premiere available now";
  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const pad = (v: number) => v.toString().padStart(2, "0");
  return language === "pl"
    ? `${days} dni ${pad(Math.floor((totalSeconds % 86400) / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}`
    : `${days} days ${pad(Math.floor((totalSeconds % 86400) / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}`;
};

export default function ChannelHome({
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
  const [premiereCountdown, setPremiereCountdown] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    setMounted(true);
    if (selectedVideo?.id) window.scrollTo({ top: 0, behavior: "auto" });
  }, [selectedVideo?.id]);

  useEffect(() => {
    const update = () =>
      setPremiereCountdown(
        formatPremiereCountdown(PATRON_PREMIERE_DATE, language),
      );
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [language]);

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

  const prefetchComments = (vidId: string) => {
    queryClient.prefetchInfiniteQuery({
      queryKey: ["comments", vidId],
      queryFn: async () => {
        const url = new URL("/api/comments", window.location.origin);
        url.searchParams.append("videoId", vidId);
        const res = await fetch(url.toString());
        return res.json();
      },
      initialPageParam: "",
    });
  };

  const commonSidebarProps = {
    sortedVideos,
    selectedVideoId: selectedVideo.id,
    userProfile,
    viewerIsPatron,
    t,
    language,
    mounted,
    premiereCountdown,
    onVideoMouseEnter: prefetchComments,
  };

  return (
    <main className="bg-transparent min-h-screen">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-6 py-6">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8">
            <Hero
              video={selectedVideo}
              initialInteraction={userProfile?.initialInteraction}
              initialIsSubscribed={userProfile?.initialIsSubscribed}
            />
            <div className="lg:hidden mt-4">
              <div className="flex" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
                {(["comments", "videos"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex-1 py-3 text-[13px] font-bold uppercase tracking-widest transition-all",
                      activeTab === tab
                        ? "text-[#171717]"
                        : "text-[#171717]/35",
                    )}
                  >
                    {tab === "comments" ? t.comments : t.videosTab}
                  </button>
                ))}
              </div>
              <NajsSeparator className="px-0" />
            </div>
            <div className="lg:hidden mt-10">
              {activeTab === "comments" ? (
                <EmbeddedComments
                  videoId={selectedVideo.id}
                  userProfile={userProfile}
                  videoTier={selectedVideo.tier}
                />
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-end border-b border-neutral-100 pb-1 mb-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a1a1a]">
                      {t.materials}
                    </h3>
                  </div>
                  <SidebarPlaylist {...commonSidebarProps} />
                </div>
              )}
            </div>
            <div className="hidden lg:block mt-10">
              <EmbeddedComments
                videoId={selectedVideo.id}
                userProfile={userProfile}
                videoTier={selectedVideo.tier}
              />
            </div>
          </div>
          <aside className="hidden lg:block lg:col-span-4 space-y-2">
            <SidebarPlaylist {...commonSidebarProps} />
          </aside>
        </div>
      </div>
    </main>
  );
}
