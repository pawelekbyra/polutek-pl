"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import Image from "next/image";
import { Video, AlertCircle, Heart } from "../icons";
import { PublicVideoDTO } from "@/app/types/video";
import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";
import { SidebarPlaylistSkeleton } from "@/components/skeletons";
import AccessLockOverlay from "../AccessLockOverlay";
import { getVideoDisplayTitle } from "@/lib/video-title-overrides";

type SidebarLayoutItem = PublicVideoDTO & {
  isLocked?: boolean;
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
  userProfile: any;
  viewerIsPatron: boolean;
  t: any;
  language: string;
  mounted: boolean;
  premiereCountdown: string;
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
  premiereCountdown,
  onVideoMouseEnter,
}: SidebarPlaylistProps) {
  const getSidebarAccessBadge = (
    video: any,
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

  const [layout, setLayout] = useState<SidebarLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);

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
        className="relative"
      >
        <Link
          href={`/?v=${video.slug || video.id}`}
          scroll={false}
          aria-current={isCurrent ? "page" : undefined}
          className={cn(
            "group flex gap-[11px] p-[6px] rounded-[11px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 mb-1",
            isCurrent ? "bg-secondary" : "hover:bg-secondary",
          )}
        >
        <div className="w-[158px] h-[90px] shrink-0 overflow-hidden rounded-[9px] bg-black relative group/thumb border border-input">
          <div className="relative w-full h-full">
            {lockState ? (
              <div className="pointer-events-none">
                <AccessLockOverlay state={lockState} variant="thumbnailCompact" />
              </div>
            ) : video.thumbnailUrl ? (
              <Image
                src={video.thumbnailUrl}
                alt={displayTitle}
                fill
                className="object-cover opacity-90 transition duration-700 group-hover/thumb:scale-105"
              />
            ) : (
              <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                <Video className="text-white/20 w-8 h-8" />
              </div>
            )}

            {video.duration && (
              <div className="absolute bottom-[5px] right-[5px] bg-black/80 text-white text-[10px] font-bold px-[5px] py-0.5 rounded-[4px] z-30 pointer-events-none font-mono">
                {video.duration}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-start pt-[1px] gap-0 z-10 relative">
          <h4 className="font-heading text-[14px] font-semibold text-[#0f0f0f] line-clamp-2 leading-[1.25] mb-[5px] group-hover:opacity-80 transition-opacity">
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
                {t.views}
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
          {/* Access Indicator Badge */}
          {mounted &&
            (() => {
              const badge = getSidebarAccessBadge(video, hasAccess, language);
              if (!badge) return null;
              return (
                <div
                  className={cn(
                    "absolute bottom-[5px] left-[-169px] bg-black/62 text-white text-[8px] font-extrabold uppercase px-[6px] py-[2px] rounded-[5px] border border-white/15 tracking-widest z-30 pointer-events-none",
                    badge.variant === "unlocked" &&
                      "bg-primary border-transparent",
                    badge.variant === "locked" && video.tier === "PATRON" && "bg-neutral-800 border-border"
                  )}
                >
                  {badge.text}
                </div>
              );
            })()}
        </div>
        </Link>
      </div>
    );
  };

  const renderSectionHeader = (title: string, icon?: React.ReactNode) => (
    <div className="pb-[6px] border-b border-border mb-[14px] flex items-center gap-2">
      {icon}
      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1a1a1a]">
        {title}
      </h3>
    </div>
  );

  const PatronBox = () => {
    const isPl = language === "pl";
    const cdDays = premiereCountdown.split(' ')[0] || '—';
    const cdClock = premiereCountdown.split(' ').slice(2).join('') || '--:--:--';

    return (
      <div className="margin-[18px_0_26px] border border-accent-ring bg-gradient-to-b from-accent-soft to-white rounded-[16px] p-[18px] shadow-[0_6px_22px_rgba(37,99,235,0.07)] mb-6">
        <div className="flex items-center gap-2 mb-[4px]">
          <Heart size={17} className="text-primary fill-primary" />
          <h4 className="font-heading text-[16px] font-bold text-[#0f0f0f] m-0">
            {isPl ? "Zostań patronem" : "Become a patron"}
          </h4>
        </div>
        <p className="m-[0_0_14px] text-[12.5px] leading-[1.55] text-[#4a4a4a]">
          {isPl ? "Jednorazowe wsparcie odblokowuje wszystkie materiały patronów — na zawsze. Bez subskrypcji." : "A one-time tip unlocks every patron video — forever. No subscription."}
        </p>

        <div className="bg-white border border-accent-ring rounded-[11px] p-[12px_14px] mb-[14px]">
          <div className="text-[10px] font-extrabold tracking-[0.16em] uppercase text-[#7a7a7a] mb-[7px]">
            {isPl ? "DO PREMIERY PATRONÓW" : "PATRON PREMIERE IN"}
          </div>
          <div className="flex items-baseline gap-[10px]">
            <div className="flex items-baseline gap-[5px]">
              <span className="font-brand text-[30px] font-bold text-primary leading-none tabular-nums">
                {cdDays}
              </span>
              <span className="text-[12px] font-bold text-muted-foreground">
                {isPl ? "dni" : "days"}
              </span>
            </div>
            <span className="font-brand text-[19px] font-semibold text-[#1a1a1a] tabular-nums tracking-[0.02em]">
              {cdClock}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
             const el = document.getElementById('support-box');
             if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="w-full h-[44px] border-none rounded-[11px] bg-primary text-white font-bold text-[14px] cursor-pointer flex items-center justify-center gap-2 hover:brightness-[1.07] active:scale-[0.98] transition-all"
        >
          {isPl ? "Wesprzyj" : "Support"}
          <span className="font-semibold opacity-[0.85]">· od 20 zł</span>
        </button>
        <div className="text-center text-[11px] text-[#7a7a7a] mt-[9px]">
          {isPl ? "Jednorazowo · dostęp dożywotni" : "One-time · lifetime access"}
        </div>
      </div>
    );
  };

  if (loading) {
    return <SidebarPlaylistSkeleton />;
  }

  if (error || !layout) {
    if (!sortedVideos || sortedVideos.length === 0) {
      return (
        <div className="p-8 text-center border-2 border-dashed border-neutral-100 rounded-2xl">
          <p className="text-sm text-neutral-500 italic">
            {language === "pl"
              ? "Brak filmów do wyświetlenia."
              : "No videos to show."}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {renderSectionHeader(language === "pl" ? "Dostępne filmy" : "Available videos", <AlertCircle size={14} className="text-amber-500" />)}
        {sortedVideos.map((v) =>
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
      </div>
    );
  }

  const publicSection = layout.sections.find((s) => s.type === "FREE");
  const loggedInSection = layout.sections.find((s) => s.type === "LOGGED_IN");
  const patronSection = layout.sections.find((s) => s.type === "PATRON");

  return (
    <>
      {publicSection && (
        <div className="mb-6">
          {renderSectionHeader(publicSection.title)}
          {publicSection.items.map(renderVideoItem)}
        </div>
      )}
      {loggedInSection && (
        <div className="mb-6">
          {renderSectionHeader(loggedInSection.title)}
          {loggedInSection.items.map(renderVideoItem)}
        </div>
      )}

      {!viewerIsPatron && <PatronBox />}

      {patronSection && (
        <div className="mb-6">
          {renderSectionHeader(patronSection.title, <Video size={13} className="stroke-[#1a1a1a] stroke-[2.4]" />)}
          {patronSection.items.map(renderVideoItem)}
        </div>
      )}
    </>
  );
}
