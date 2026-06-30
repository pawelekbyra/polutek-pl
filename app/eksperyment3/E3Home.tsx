"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { PublicVideoDTO } from "../types/video";
import Hero from "../components/Hero";
import EmbeddedComments from "../components/comments/EmbeddedComments";
import SubscribeButton from "../components/SubscribeButton";
import { Frame, HachureFill, NajsIcon, NajsSeparator, INK, BLUE } from "../components/najs/primitives";
import { useLanguage } from "../components/LanguageContext";
import BrandName from "../components/BrandName";
import { compareSidebarItems } from "@/lib/services/content/sidebar-order";
import { getVideoDisplayTitle } from "@/lib/video-title-overrides";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

// V3 tokens
const PAPER = "#FAF6EC";
const MARKER = "#FBE08A";
const HAND = "var(--font-patrick, 'Patrick Hand', cursive)";
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

// Notatnik background: red margin + blue horizontal + blue vertical grid, fixed
const NOTEBOOK_BG = `
  linear-gradient(90deg, transparent 47px, rgba(196,82,60,.28) 47px, rgba(196,82,60,.28) 48px, transparent 48px),
  repeating-linear-gradient(to bottom, rgba(40,70,130,.10) 0, rgba(40,70,130,.10) 1px, transparent 1px, transparent 42px),
  repeating-linear-gradient(to right, rgba(40,70,130,.07) 0, rgba(40,70,130,.07) 1px, transparent 1px, transparent 42px)
`.trim();

interface E3HomeProps {
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

// Yellow marker highlight on section heading text
function Marked({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        background: `linear-gradient(180deg, transparent 52%, ${MARKER} 52%, ${MARKER} 92%, transparent 92%)`,
        padding: "0 3px",
        WebkitBoxDecorationBreak: "clone",
        boxDecorationBreak: "clone",
      } as React.CSSProperties}
    >
      {children}
    </span>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <h3
      className="text-[11px] font-black uppercase tracking-[0.2em] mb-3 whitespace-nowrap"
      style={{ fontFamily: SANS }}
    >
      <Marked>{label}</Marked>
    </h3>
  );
}

// Single-contur Frame (V3: no shadow)
function CleanFrame({ radius = 14, seed = 1, fill = "transparent" }: { radius?: number; seed?: number; fill?: string }) {
  return <Frame radius={radius} seed={seed} stroke={INK} strokeWidth={1.4} fill={fill} showShadow={false} />;
}

function VideoRow({
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
  const isPatron = video.tier === "PATRON";
  const timeAgo = video.publishedAt
    ? formatDistanceToNow(new Date(video.publishedAt), {
        addSuffix: true,
        locale: language === "pl" ? pl : undefined,
      })
    : null;

  return (
    <button
      onClick={onClick}
      className="flex gap-3 w-full text-left group py-2 border-b border-dashed"
      style={{ borderColor: "rgba(40,70,130,.12)" }}
    >
      {/* Thumbnail */}
      <div className="relative shrink-0 w-[100px] aspect-video rounded-[9px] overflow-hidden">
        {video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            alt={title}
            fill
            className="object-cover transition-transform duration-200 group-hover:scale-[1.04]"
            sizes="100px"
          />
        ) : (
          <div className="absolute inset-0 bg-[#1a1a1a]" />
        )}
        {isPatron && (
          <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
            <NajsIcon name="lock" className="h-4 w-4" stroke="white" />
          </div>
        )}
        {video.duration && (
          <span className="absolute bottom-0.5 right-1 text-[9px] font-mono text-white bg-black/75 px-1 rounded">
            {video.duration}
          </span>
        )}
        <CleanFrame radius={9} seed={(video.id.charCodeAt(0) % 80) + 1} />
      </div>

      {/* Meta */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p
          className="text-[12.5px] leading-snug line-clamp-2 mb-1 transition-colors"
          style={{
            fontFamily: HAND,
            color: isSelected ? BLUE : "#171717",
            fontWeight: isSelected ? "bold" : "normal",
          }}
        >
          {title}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {isSelected && (
            <span
              className="text-[9px] font-black uppercase tracking-wider text-white rounded-full px-2 py-0.5"
              style={{ fontFamily: SANS, background: BLUE }}
            >
              {language === "pl" ? "Teraz" : "Now"}
            </span>
          )}
          {isPatron && (
            <span
              className="text-[9px] font-black uppercase tracking-wider bg-[#171717] text-white rounded-full px-2 py-0.5"
              style={{ fontFamily: SANS }}
            >
              Patron
            </span>
          )}
          {timeAgo && (
            <span className="text-[10px] text-[#71717A]" style={{ fontFamily: SANS }}>
              {timeAgo}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function Sidebar({
  videos,
  selectedId,
  language,
  onSelect,
  userProfile,
  selectedVideo,
}: {
  videos: PublicVideoDTO[];
  selectedId: string;
  language: string;
  onSelect: (v: PublicVideoDTO) => void;
  userProfile: E3HomeProps["userProfile"];
  selectedVideo: PublicVideoDTO;
}) {
  const isPl = language === "pl";
  const publicVideos = videos.filter(v => v.tier !== "PATRON");
  const patronVideos = videos.filter(v => v.tier === "PATRON");

  return (
    <div>
      {/* Subscribe + Wesprzyj */}
      <div className="mb-5 flex flex-col gap-2">
        <div className="relative h-[46px]">
          <HachureFill fill={BLUE} seed={7} />
          <button
            className="absolute inset-0 flex items-center justify-center text-white font-black text-[14px]"
            style={{ fontFamily: HAND }}
          >
            Wesprzyj POLUTEK.PL
          </button>
        </div>
        <div className="flex justify-center">
          <SubscribeButton
            creatorId={selectedVideo.creatorId}
            creatorSlug={selectedVideo.creator?.slug}
            creatorName={selectedVideo.creator?.name}
            initialIsSubscribed={userProfile?.initialIsSubscribed}
            colorScheme="v2"
          />
        </div>
      </div>

      <NajsSeparator />

      {publicVideos.length > 0 && (
        <div className="mt-4">
          <SectionTitle label={isPl ? "Dostępne filmy" : "Available"} />
          <div className="space-y-0">
            {publicVideos.map(v => (
              <VideoRow
                key={v.id}
                video={v}
                isSelected={v.id === selectedId}
                language={language}
                onClick={() => onSelect(v)}
              />
            ))}
          </div>
        </div>
      )}

      {patronVideos.length > 0 && (
        <div className="mt-5">
          <SectionTitle label={isPl ? "Strefa Fenkju" : "Patron Zone"} />
          <div className="space-y-0">
            {patronVideos.map(v => (
              <VideoRow
                key={v.id}
                video={v}
                isSelected={v.id === selectedId}
                language={language}
                onClick={() => onSelect(v)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function E3Home({
  mainVideo,
  allVideos = [],
  currentVideoId,
  userProfile,
}: E3HomeProps) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"comments" | "videos">("comments");

  useEffect(() => { setMounted(true); }, []);

  const selectedVideo =
    allVideos.find(v => v.id === currentVideoId || v.slug === currentVideoId) || mainVideo;

  const sortedVideos = [...allVideos].sort(compareSidebarItems);

  const handleVideoSelect = (video: PublicVideoDTO) => {
    router.push(`/eksperyment3?v=${video.slug || video.id}`);
  };

  const wrapperStyle: React.CSSProperties = {
    fontFamily: HAND,
    backgroundColor: PAPER,
    backgroundImage: NOTEBOOK_BG,
    backgroundAttachment: "fixed",
    minHeight: "100vh",
    color: INK,
    WebkitFontSmoothing: "antialiased",
    "--font-najs": HAND,
  } as React.CSSProperties;

  if (!selectedVideo) {
    return (
      <div style={wrapperStyle}>
        <Navbar />
        <main className="max-w-3xl mx-auto px-6 py-20 text-center">
          <NajsIcon name="alert" className="h-10 w-10 mx-auto mb-4 text-[#71717A]" />
          <p className="text-[#71717A]" style={{ fontFamily: HAND }}>Brak materiałów</p>
        </main>
        <Footer />
      </div>
    );
  }

  const isPl = language === "pl";

  return (
    <div style={wrapperStyle}>
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-5">
        <div className="grid grid-cols-12 gap-5">

          {/* === LEFT: player + comments === */}
          <div className="col-span-12 lg:col-span-8 min-w-0">
            <Hero
              video={selectedVideo}
              initialInteraction={userProfile?.initialInteraction}
              initialIsSubscribed={userProfile?.initialIsSubscribed}
            />

            {/* Mobile tabs */}
            <div className="lg:hidden mt-4">
              <div className="flex">
                {(["comments", "videos"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="flex-1 py-3 text-[12px] font-black uppercase tracking-widest transition-colors"
                    style={{
                      fontFamily: SANS,
                      color: activeTab === tab ? INK : "rgba(23,23,23,0.3)",
                      borderBottom: activeTab === tab ? `2px solid ${INK}` : "2px solid transparent",
                    }}
                  >
                    {tab === "comments" ? t.comments : (isPl ? "Filmy" : "Videos")}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile: comments */}
            <div className={`lg:hidden mt-5 ${activeTab === "comments" ? "block" : "hidden"}`}>
              <SectionTitle label={isPl ? "Komentarze" : "Comments"} />
              <EmbeddedComments
                videoId={selectedVideo.id}
                userProfile={userProfile}
                videoTier={selectedVideo.tier}
              />
            </div>

            {/* Mobile: videos */}
            <div className={`lg:hidden mt-5 ${activeTab === "videos" ? "block" : "hidden"}`}>
              <Sidebar
                videos={sortedVideos}
                selectedId={selectedVideo.id}
                language={language}
                onSelect={handleVideoSelect}
                userProfile={userProfile}
                selectedVideo={selectedVideo}
              />
            </div>

            {/* Desktop: comments */}
            <div className="hidden lg:block mt-8">
              <SectionTitle label={isPl ? "Komentarze" : "Comments"} />
              <EmbeddedComments
                videoId={selectedVideo.id}
                userProfile={userProfile}
                videoTier={selectedVideo.tier}
              />
            </div>
          </div>

          {/* === RIGHT: sidebar === */}
          <aside className="hidden lg:block lg:col-span-4">
            <Sidebar
              videos={sortedVideos}
              selectedId={selectedVideo.id}
              language={language}
              onSelect={handleVideoSelect}
              userProfile={userProfile}
              selectedVideo={selectedVideo}
            />
          </aside>

        </div>
      </main>

      <Footer />
    </div>
  );
}
