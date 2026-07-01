"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import Image from "next/image";
import { AlertCircle } from "../icons";
import { PublicVideoDTO } from "@/app/types/video";
import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";
import { SidebarPlaylistSkeleton } from "@/components/skeletons";
import AccessLockOverlay from "../AccessLockOverlay";
import { getVideoDisplayTitle } from "@/lib/video-title-overrides";
import { Download } from "lucide-react";
import { DownloadSheet } from "./DownloadSheet";
import { Frame, NajsIcon, INK } from "../najs/primitives";
import DonationBox from "./DonationBox";

type UserProfile = {
  id: string;
  email: string;
  imageUrl?: string | null;
  totalPaid: number;
  initialInteraction?: { liked: boolean; disliked: boolean };
  initialIsSubscribed?: boolean;
  isPatronDecorative?: boolean;
  role?: string;
} | null | undefined;

type Translations = {
  views: string;
};

type SidebarLayoutItem = PublicVideoDTO & {
  isLocked?: boolean;
  creatorId?: string | null;
};

type SidebarLayoutSection = {
  id: string;
  type: "FREE" | "LOGGED_IN" | "PATRON" | "ANNOUNCEMENT";
  title: string;
  items: SidebarLayoutItem[];
};

type SidebarLayout = {
  viewerState: "ANONYMOUS" | "LOGGED_IN" | "PATRON" | "ADMIN";
  sections: SidebarLayoutSection[];
  currentVideoId?: string;
};

interface SidebarPlaylistProps {
  sortedVideos: PublicVideoDTO[];
  selectedVideoId?: string;
  userProfile: UserProfile;
  viewerIsPatron: boolean;
  t: Translations;
  language: string;
  mounted: boolean;
  premiereCountdown?: string;
  onVideoMouseEnter: (id: string) => void;
}

export function SidebarPlaylist({
  sortedVideos,
  selectedVideoId,
  userProfile,
  viewerIsPatron,
  t,
  language,
  mounted,
  onVideoMouseEnter,
}: SidebarPlaylistProps) {
  const getSidebarAccessBadge = (
    video: SidebarLayoutItem,
    hasAccess: boolean,
    lang: string,
  ) => {
    const isPl = lang === "pl";
    if (!video.tier || video.tier === "PUBLIC") {
      return { text: isPl ? "Publiczne" : "Public", variant: "public" };
    }

    if (video.tier === "LOGGED_IN") {
      if (!hasAccess)
        return {
          text: isPl ? "Zaloguj się" : "Login required",
          variant: "locked",
        };
      return { text: isPl ? "Odblokowane" : "Unlocked", variant: "unlocked" };
    }

    if (video.tier === "PATRON") {
      if (!hasAccess)
        return { text: isPl ? "Patron" : "Patron", variant: "locked" };
      return { text: isPl ? "Odblokowane" : "Unlocked", variant: "unlocked" };
    }

    return null;
  };

  const getViewsLabel = (count: number) => {
    if (language !== "pl") return count === 1 ? "view" : "views";
    if (count === 1) return "wyświetlenie";
    const last = count % 10;
    const lastTwo = count % 100;
    if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return "wyświetlenia";
    return "wyświetleń";
  };

  const [layout, setLayout] = useState<SidebarLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);
  const [downloadTarget, setDownloadTarget] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    async function fetchLayout() {
      try {
        const res = await fetch(
          `/api/channel/sidebar?currentVideoId=${selectedVideoId || ""}`,
        );
        if (res.ok) {
          const data = await res.json();
          setLayout(data);
          setError(false);
        } else {
          logger.warn(`Sidebar layout fetch failed with status: ${res.status}`);
          setError(true);
        }
      } catch (err) {
        logger.error("Failed to fetch sidebar layout", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchLayout();
  }, [selectedVideoId]);

  const renderVideoItem = (video: SidebarLayoutItem) => {
    const displayTitle = getVideoDisplayTitle(video, language);
    const isCurrent = video.id === selectedVideoId;
    const hasAccess = !video.isLocked;
    const lockState = !hasAccess
      ? video.tier === "PATRON"
        ? "PATRON_REQUIRED"
        : "LOGIN_REQUIRED"
      : null;

    return (
      <div
        key={video.id || video.slug}
        onMouseEnter={() => onVideoMouseEnter(video.id)}
        className="relative group/item"
      >
        <Link
          href={`/?v=${video.slug || video.id}`}
          scroll={false}
          aria-current={isCurrent ? "page" : undefined}
          className={cn(
            "group flex gap-[11px] p-[6px] rounded-[11px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 mb-1",
            isCurrent ? "bg-[rgba(248,243,231,0.75)]" : "hover:bg-[rgba(248,243,231,0.75)]",
          )}
        >
          <div className="w-[158px] h-[90px] shrink-0 rounded-[9px] bg-black relative group/thumb">
            <Frame radius={9} seed={33} stroke={INK} strokeWidth={1} />
            <div className="absolute inset-0 overflow-hidden rounded-[8px]">
              <div className="relative w-full h-full">
              {video.thumbnailUrl ? (
                <Image
                  src={video.thumbnailUrl}
                  alt={displayTitle}
                  fill
                  sizes="158px"
                  className="object-cover opacity-90 transition duration-700 group-hover/thumb:scale-105"
                />
              ) : (
                <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                  <NajsIcon name="video" className="text-white/20 w-8 h-8" stroke="rgba(255,255,255,0.2)" />
                </div>
              )}

              {lockState && (
                <div className="pointer-events-none">
                  <div className="absolute inset-0 z-20">
                    <AccessLockOverlay state={lockState} variant="thumbnailCompact" />
                  </div>
                </div>
              )}

              {video.duration && !lockState && (
                <div className="absolute bottom-[5px] right-[5px] bg-black/80 text-white text-[10px] font-bold px-[5px] py-0.5 rounded-[4px] z-30 pointer-events-none font-mono">
                  {video.duration}
                </div>
              )}
              {/* Access Indicator Badge, anchored to the thumbnail itself (not a
                  fragile negative-offset reach from the text column) */}
              {mounted &&
                (() => {
                  const badge = getSidebarAccessBadge(video, hasAccess, language);
                  if (!badge) return null;
                  return (
                    <div
                      className={cn(
                        "absolute top-[5px] right-[5px] bg-black/62 text-white text-[8px] font-extrabold uppercase px-[6px] py-[2px] rounded-[5px] border border-white/15 tracking-widest z-30 pointer-events-none",
                        badge.variant === "unlocked" &&
                          "bg-primary border-transparent",
                        badge.variant === "locked" &&
                          video.tier === "PATRON" &&
                          "bg-neutral-800 border-border",
                      )}
                    >
                      {badge.text}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-start pt-[1px] gap-0 z-10 relative">
            <h4 className="text-[14px] font-semibold text-[#0f0f0f] line-clamp-2 leading-[1.25] mb-[5px] group-hover:opacity-80 transition-opacity" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
              {displayTitle}
            </h4>
            <div className="text-[12px] text-muted-foreground flex flex-col mt-0">
              <div className="transition-colors w-fit relative z-20 leading-[1.4]">
                {video.creator?.name || "Polutek"}
              </div>
              <div className="flex items-center gap-1">
                <span>
                  {mounted
                    ? video.views?.toLocaleString(
                        language === "pl" ? "pl-PL" : "en-US",
                      )
                    : video.views}{" "}
                  {mounted ? getViewsLabel(video.views ?? 0) : t.views}
                </span>
                {video.publishedAt && (
                  <>
                    <span>·</span>
                    <span>
                      {mounted
                        ? formatDistanceToNow(new Date(video.publishedAt), {
                            addSuffix: true,
                            locale: language === "pl" ? pl : undefined,
                          }).replace("około", "ok.")
                        : ""}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </Link>

        {/* Download button — only for unlocked videos */}
        {hasAccess && (
          <button
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              setDownloadTarget({ id: video.id, title: displayTitle });
            }}
            title={language === "pl" ? "Pobierz wideo" : "Download video"}
            className="absolute top-[6px] right-[6px] z-40 w-7 h-7 rounded-[7px] bg-white/90 border border-neutral-200 shadow-sm flex items-center justify-center opacity-0 group-hover/item:opacity-100 focus:opacity-100 transition-opacity hover:bg-neutral-100 active:scale-95"
          >
            <Download size={13} className="text-neutral-600" />
          </button>
        )}
      </div>
    );
  };

  const supportItem = (layout?.sections.flatMap((section) => section.items) ?? sortedVideos).find((item) => item.creatorId);

  const renderSectionHeader = (title: string, icon?: React.ReactNode) => (
    <div className="mb-[2px]">
      <div className="flex items-center gap-2 mb-[2px]">
        {icon}
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1a1a1a]" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
          <span style={{ background: "linear-gradient(180deg, transparent 52%, #FBE08A 52%, #FBE08A 92%, transparent 92%)", padding: "0 3px", WebkitBoxDecorationBreak: "clone", boxDecorationBreak: "clone" }}>
            {title}
          </span>
        </h3>
      </div>
      <div className="relative h-[8px] w-full">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 8" preserveAspectRatio="none" aria-hidden="true">
          <path d="M 0 4 Q 300 3 600 4" fill="none" stroke={INK} strokeWidth="1.1" strokeLinecap="round" opacity=".55"/>
        </svg>
      </div>
    </div>
  );

  const PatronBox = () => {
    if (!supportItem?.creatorId) return null;
    return <DonationBox videoTitle={supportItem?.title} />;
  };

  if (loading) {
    return <SidebarPlaylistSkeleton />;
  }

  if (error || !layout) {
    const fallbackItems = sortedVideos || [];

    if (fallbackItems.length === 0) {
      return (
        <div className="p-8 text-center border-2 border-dashed border-neutral-100 rounded-2xl">
          <p className="text-sm text-neutral-500">
            {language === "pl"
              ? "Brak filmów do wyświetlenia."
              : "No videos to show."}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {renderSectionHeader(
          language === "pl" ? "Dostępne filmy" : "Available videos",
          <AlertCircle size={14} className="text-amber-500" />,
        )}
        {fallbackItems.map((v) =>
          renderVideoItem({
            ...v,
            isLocked:
              v.tier === "PATRON"
                ? !viewerIsPatron
                : v.tier === "LOGGED_IN"
                  ? !userProfile
                  : false,
          }),
        )}
        <PatronBox />
      </div>
    );
  }

  const publicSection = layout.sections.find((s) => s.type === "FREE");
  const loggedInSection = layout.sections.find((s) => s.type === "LOGGED_IN");
  const patronSection = layout.sections.find((s) => s.type === "PATRON");

  return (
    <>
      {publicSection && (
        <div className="mb-3">
          {renderSectionHeader(publicSection.title)}
          {publicSection.items.map(renderVideoItem)}
        </div>
      )}
      {loggedInSection && (
        <div className="mb-3">
          {renderSectionHeader(loggedInSection.title)}
          {loggedInSection.items.map(renderVideoItem)}
        </div>
      )}

      <PatronBox />

      {patronSection && (
        <div className="mb-3">
          {renderSectionHeader(
            language === "pl" ? "Strefa Fenkju" : "Thank You Zone",
          )}
          {patronSection.items.map(renderVideoItem)}
        </div>
      )}

      {downloadTarget && (
        <DownloadSheet
          videoId={downloadTarget.id}
          videoTitle={downloadTarget.title}
          language={language}
          onClose={() => setDownloadTarget(null)}
        />
      )}
    </>
  );
}
