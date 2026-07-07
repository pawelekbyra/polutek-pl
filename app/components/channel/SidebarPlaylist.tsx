"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import Image from "next/image";
import { AlertCircle } from "../icons";
import { PublicVideoDTO } from "@/app/types/video";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";
import AccessLockOverlay from "../AccessLockOverlay";
import { getVideoDisplayTitle } from "@/lib/video-title-overrides";
import { NajsIcon } from "../najs/primitives";
import DonationBox from "./DonationBox";
import { useAppPreload } from "../preload/AppPreloadProvider";
import { getLocalizedHref } from "@/lib/i18n/routing";

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
  onVideoSelect?: (videoId?: string) => void;
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
  onVideoSelect,
}: SidebarPlaylistProps) {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const preloader = useAppPreload();
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
          text: "Login",
          variant: "locked",
        };
      return { text: isPl ? "Odblok." : "Unlocked", variant: "unlocked" };
    }

    if (video.tier === "PATRON") {
      if (!hasAccess)
        return { text: isPl ? "Patron" : "Patron", variant: "locked" };
      return { text: isPl ? "Odblok." : "Unlocked", variant: "unlocked" };
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

  useEffect(() => {
    async function fetchLayout() {
      try {
        const res = await fetch(
          `/api/channel/sidebar?currentVideoId=${selectedVideoId || ""}`,
          { cache: "no-store" },
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

  const renderVideoItem = (video: SidebarLayoutItem, isPublicSection = false) => {
    const displayTitle = getVideoDisplayTitle(video, language);
    const isCurrent = video.id === selectedVideoId;
    const hasAccess = !video.isLocked;
    const lockState = !hasAccess
      ? video.tier === "PATRON"
        ? "PATRON_REQUIRED"
        : "LOGIN_REQUIRED"
      : null;
    const warmVideoOnIntent = () => {
      void preloader?.warmVideo(video.id, {
        includeComments: true,
        includePoster: true,
        priority: "intent",
      });
    };

    return (
      <div
        key={video.id || video.slug}
        onMouseEnter={() => {
          onVideoMouseEnter(video.id);
          warmVideoOnIntent();
        }}
        onPointerEnter={warmVideoOnIntent}
        onFocus={() => {
          onVideoMouseEnter(video.id);
          warmVideoOnIntent();
        }}
        className="relative group/item"
      >
        <Link
          href={getLocalizedHref(language === "pl" ? "pl" : "en", "watch", { slug: video.slug || video.id })}
          scroll={false}
          onClick={() => {
            onVideoSelect?.(video.id);
          }}
          aria-current={isCurrent ? "page" : undefined}
          className={cn(
            "group relative mb-1 flex gap-3 overflow-hidden rounded-[14px] p-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            isCurrent
              ? "bg-[var(--chan-surface)]"
              : isPublicSection
                ? "bg-gradient-to-br from-[#EAF0FF] to-[#DBE7FB] hover:brightness-[1.03]"
                : "hover:bg-[var(--chan-surface)]",
          )}
        >
          {isCurrent && (
            <span
              aria-hidden="true"
              className="absolute left-0 top-1/2 h-10 w-[3px] -translate-y-1/2 rounded-r-full bg-[#2563EB]"
            />
          )}
          <div className="w-[130px] h-[73px] shrink-0 rounded-[10px] bg-black relative overflow-hidden group/thumb">
              {video.thumbnailUrl ? (
                <Image
                  src={video.thumbnailUrl}
                  alt={displayTitle}
                  fill
                  sizes="130px"
                  className="object-cover transition duration-700 group-hover/thumb:scale-105"
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
              {mounted &&
                (() => {
                  const badge = getSidebarAccessBadge(video, hasAccess, language);
                  if (!badge) return null;
                  return (
                    <div
                      className={cn(
                        "absolute right-[6px] top-[6px] z-30 max-w-[86px] truncate rounded-full px-[7px] py-[3px] text-[8px] font-black uppercase leading-none tracking-[0.1em] pointer-events-none",
                        badge.variant === "public" &&
                          "bg-white/92 text-[var(--chan-ink)]",
                        badge.variant === "unlocked" &&
                          "bg-[#EFF3FE] text-[#2563EB]",
                        badge.variant === "locked" &&
                          "bg-[var(--chan-ink)] text-white",
                      )}
                    >
                      {badge.text}
                    </div>
                  );
                })()}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-start pt-[1px] gap-1 z-10 relative">
            <h4 className="font-sans text-[13px] font-bold text-[var(--chan-ink)] line-clamp-2 leading-[1.3] group-hover:opacity-80 transition-opacity">
              {displayTitle}
            </h4>
            <div className="text-[12px] text-[var(--chan-muted)] flex flex-col mt-0">
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
      </div>
    );
  };

  const supportItem = (layout?.sections.flatMap((section) => section.items) ?? sortedVideos).find((item) => item.creatorId);

  const renderSectionHeader = (title: string, icon?: React.ReactNode) => (
    <div className="mb-1 flex items-center gap-2 border-b border-[var(--chan-line)] pb-1">
      {icon}
      <h3 className="font-brand text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--chan-muted-2)]">
        {title}
      </h3>
    </div>
  );

  const PatronBox = () => {
    if (!authLoaded || !isSignedIn) return null;
    if (!supportItem?.creatorId) return null;
    return <DonationBox videoTitle={supportItem?.title} viewerIsPatron={viewerIsPatron} />;
  };

  if (loading) {
    const fallbackItems = sortedVideos || [];
    return (
      <div className="space-y-2" aria-busy="true">
        {renderSectionHeader(language === "pl" ? "Dostępne filmy" : "Available videos")}
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

  if (error || !layout) {
    const fallbackItems = sortedVideos || [];

    if (fallbackItems.length === 0) {
      return (
        <div className="rounded-2xl border-2 border-dashed border-[var(--chan-line)] p-8 text-center">
          <p className="text-sm text-[var(--chan-muted)]">
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
        <div className="mb-1 last:mb-0">
          {renderSectionHeader(publicSection.title)}
          {publicSection.items.map((v) => renderVideoItem(v, true))}
        </div>
      )}
      {loggedInSection && (
        <div className="mb-1 last:mb-0">
          {renderSectionHeader(loggedInSection.title)}
          {loggedInSection.items.map((v) => renderVideoItem(v))}
        </div>
      )}

      {patronSection && (
        <div className="mb-1 last:mb-0">
          {renderSectionHeader(
            language === "pl" ? "Strefa Fenkju" : "Thank You Zone",
          )}
          {patronSection.items.map((v) => renderVideoItem(v))}
        </div>
      )}

      <PatronBox />
    </>
  );
}
