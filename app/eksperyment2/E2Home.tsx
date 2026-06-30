"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicVideoDTO } from "../types/video";
import Hero from "../components/Hero";
import EmbeddedComments from "../components/comments/EmbeddedComments";
import SubscribeButton from "../components/SubscribeButton";
import { Frame, HachureFill, NajsIcon, INK, BLUE } from "../components/najs/primitives";
import { useLanguage } from "../components/LanguageContext";
import { compareSidebarItems } from "@/lib/services/content/sidebar-order";
import { getVideoDisplayTitle } from "@/lib/video-title-overrides";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

const HAND = "var(--font-patrick, 'Patrick Hand', cursive)";
const SANS = "var(--font-system, system-ui, -apple-system, sans-serif)";

interface E2HomeProps {
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

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <svg className="flex-1 h-[2px]" viewBox="0 0 100 2" preserveAspectRatio="none">
        <path d="M0 1 Q25 0.2 50 1 Q75 1.8 100 1" fill="none" stroke={INK} strokeWidth="1.2" opacity=".55" />
      </svg>
      <span
        className="text-[11px] font-black uppercase tracking-[0.22em] text-[#171717] shrink-0 px-1"
        style={{ fontFamily: SANS }}
      >
        {label}
      </span>
      <svg className="flex-1 h-[2px]" viewBox="0 0 100 2" preserveAspectRatio="none">
        <path d="M0 1 Q25 1.8 50 1 Q75 0.2 100 1" fill="none" stroke={INK} strokeWidth="1.2" opacity=".55" />
      </svg>
    </div>
  );
}

function DashedLine() {
  return (
    <div className="w-full h-px my-4" style={{
      backgroundImage: `repeating-linear-gradient(90deg, ${INK} 0, ${INK} 6px, transparent 6px, transparent 14px)`,
      opacity: 0.18,
    }} />
  );
}

function TierChip({ tier, language }: { tier: string; language: string }) {
  const isPl = language === "pl";
  if (!tier || tier === "PUBLIC") {
    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full text-[#171717] relative"
        style={{ fontFamily: SANS }}
      >
        <span className="absolute inset-0 rounded-full border border-[#171717] opacity-40" />
        <span className="relative">{isPl ? "Publiczne" : "Public"}</span>
      </span>
    );
  }
  if (tier === "PATRON") {
    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full text-white bg-[#171717] relative"
        style={{ fontFamily: SANS }}
      >
        {isPl ? "Patron" : "Patron"}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full text-white bg-[#2563EB] relative"
      style={{ fontFamily: SANS }}
    >
      <NajsIcon name="lock" className="h-3 w-3" stroke="white" />
      {isPl ? "Odblokowane" : "Unlocked"}
    </span>
  );
}

function VideoCard({
  video,
  isSelected,
  language,
  onClick,
}: {
  video: PublicVideoDTO;
  isSelected: boolean;
  language: string;
  onClick: () => void;
}) {
  const title = getVideoDisplayTitle(video, language);
  const isLocked = video.tier === "PATRON";
  const timeAgo = video.publishedAt
    ? formatDistanceToNow(new Date(video.publishedAt), {
        addSuffix: true,
        locale: language === "pl" ? pl : undefined,
      })
    : null;

  return (
    <button
      onClick={onClick}
      className="text-left w-full group"
    >
      <div className={`relative rounded-[9px] overflow-hidden aspect-video mb-2 transition-all duration-200 ${isSelected ? "ring-2 ring-[#2563EB]" : ""}`}>
        {video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 bg-[#1a1a1a]" />
        )}
        {isLocked && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <NajsIcon name="lock" className="h-8 w-8" stroke="white" />
          </div>
        )}
        {video.duration && (
          <span
            className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono"
          >
            {video.duration}
          </span>
        )}
        {isSelected && (
          <div className="absolute top-1.5 left-1.5">
            <span className="bg-[#2563EB] text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ fontFamily: SANS }}>
              Teraz
            </span>
          </div>
        )}
        <Frame radius={9} seed={video.id.charCodeAt(0) % 99 + 1} stroke={INK} strokeWidth={1.1} showShadow={false} />
      </div>
      <p
        className={`text-[13px] leading-snug mb-1 transition-colors line-clamp-2 ${isSelected ? "text-[#2563EB]" : "text-[#171717] group-hover:text-[#2563EB]"}`}
        style={{ fontFamily: HAND }}
      >
        {title}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <TierChip tier={video.tier} language={language} />
        {timeAgo && (
          <span className="text-[10px] text-[#71717A]" style={{ fontFamily: SANS }}>{timeAgo}</span>
        )}
      </div>
    </button>
  );
}

export default function E2Home({
  mainVideo,
  allVideos = [],
  currentVideoId,
  userProfile,
}: E2HomeProps) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"archiwum" | "komentarze">("komentarze");

  useEffect(() => { setMounted(true); }, []);

  const selectedVideo =
    allVideos.find(v => v.id === currentVideoId || v.slug === currentVideoId) || mainVideo;

  const sortedVideos = [...allVideos].sort(compareSidebarItems);
  const publicVideos = sortedVideos.filter(v => v.tier === "PUBLIC" || v.tier === "LOGGED_IN");
  const patronVideos = sortedVideos.filter(v => v.tier === "PATRON");

  const handleVideoSelect = (video: PublicVideoDTO) => {
    router.push(`/eksperyment2?v=${video.slug || video.id}`);
  };

  if (!selectedVideo) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-20 text-center">
        <NajsIcon name="alert" className="h-12 w-12 mx-auto mb-4 text-[#71717A]" />
        <p style={{ fontFamily: HAND }} className="text-lg text-[#71717A]">Brak materiałów</p>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen"
      style={{ fontFamily: HAND, "--font-najs": HAND } as React.CSSProperties}
    >
      {/* === HERO + PLAYER === */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-4 pb-2">
        <div className="grid grid-cols-12 gap-5">
          {/* Player column */}
          <div className="col-span-12 lg:col-span-8">
            <Hero
              video={selectedVideo}
              initialInteraction={userProfile?.initialInteraction}
              initialIsSubscribed={userProfile?.initialIsSubscribed}
            />

            {/* Mobile tabs */}
            <div className="lg:hidden mt-4">
              <div className="flex gap-1">
                {(["komentarze", "archiwum"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="relative flex-1 py-2.5 text-[12px] font-black uppercase tracking-widest transition-all"
                    style={{ fontFamily: SANS, color: activeTab === tab ? "#171717" : "rgba(23,23,23,0.3)" }}
                  >
                    {activeTab === tab && (
                      <span className="absolute bottom-0 left-4 right-4 h-[1.5px] bg-[#171717]" />
                    )}
                    {tab === "komentarze" ? t.comments : "Archiwum"}
                  </button>
                ))}
              </div>
              <DashedLine />
            </div>

            {/* Mobile: comments or archive */}
            <div className="lg:hidden mt-4">
              {activeTab === "komentarze" ? (
                <EmbeddedComments
                  videoId={selectedVideo.id}
                  userProfile={userProfile}
                  videoTier={selectedVideo.tier}
                />
              ) : (
                <VideoGrid
                  videos={sortedVideos}
                  selectedId={selectedVideo.id}
                  language={language}
                  onSelect={handleVideoSelect}
                  publicVideos={publicVideos}
                  patronVideos={patronVideos}
                />
              )}
            </div>

            {/* Desktop: comments */}
            <div className="hidden lg:block mt-8">
              <SectionHeader label={language === "pl" ? "Komentarze" : "Comments"} />
              <EmbeddedComments
                videoId={selectedVideo.id}
                userProfile={userProfile}
                videoTier={selectedVideo.tier}
              />
            </div>
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block lg:col-span-4">
            <VideoGrid
              videos={sortedVideos}
              selectedId={selectedVideo.id}
              language={language}
              onSelect={handleVideoSelect}
              publicVideos={publicVideos}
              patronVideos={patronVideos}
            />

            {/* Wesprzyj CTA */}
            <DashedLine />
            <div className="relative h-[54px] mt-4">
              <HachureFill fill={BLUE} seed={42} />
              <button
                className="absolute inset-0 flex items-center justify-center gap-2 text-white font-black text-[15px] tracking-wide"
                style={{ fontFamily: HAND }}
                onClick={() => window.open("https://patronite.pl", "_blank")}
              >
                Wesprzyj POLUTEK.PL
              </button>
            </div>

            {/* Subscribe pill */}
            <div className="mt-3 flex justify-center">
              <SubscribeButton
                creatorId={selectedVideo.creatorId}
                creatorSlug={selectedVideo.creator?.slug}
                creatorName={selectedVideo.creator?.name}
                initialIsSubscribed={userProfile?.initialIsSubscribed}
                colorScheme="v2"
              />
            </div>
          </aside>
        </div>
      </div>

      {/* === MOBILE CTA === */}
      <div className="lg:hidden px-4 mt-6 mb-2">
        <div className="relative h-[54px]">
          <HachureFill fill={BLUE} seed={42} />
          <button
            className="absolute inset-0 flex items-center justify-center gap-2 text-white font-black text-[15px]"
            style={{ fontFamily: HAND }}
          >
            Wesprzyj POLUTEK.PL
          </button>
        </div>
      </div>
    </main>
  );
}

function VideoGrid({
  videos,
  selectedId,
  language,
  onSelect,
  publicVideos,
  patronVideos,
}: {
  videos: PublicVideoDTO[];
  selectedId: string;
  language: string;
  onSelect: (v: PublicVideoDTO) => void;
  publicVideos: PublicVideoDTO[];
  patronVideos: PublicVideoDTO[];
}) {
  const isPl = language === "pl";

  return (
    <div>
      {publicVideos.length > 0 && (
        <>
          <SectionHeader label={isPl ? "Dostępne filmy" : "Available"} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            {publicVideos.map(v => (
              <VideoCard
                key={v.id}
                video={v}
                isSelected={v.id === selectedId}
                language={language}
                onClick={() => onSelect(v)}
              />
            ))}
          </div>
        </>
      )}
      {patronVideos.length > 0 && (
        <>
          <SectionHeader label={isPl ? "Strefa Fenkju" : "Patron Zone"} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            {patronVideos.map(v => (
              <VideoCard
                key={v.id}
                video={v}
                isSelected={v.id === selectedId}
                language={language}
                onClick={() => onSelect(v)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
