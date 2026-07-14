"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { PublicVideoDTO } from "@/app/types/video";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { useLanguage } from "./LanguageContext";
import { getVideoDisplayTitle } from "@/lib/video-title-overrides";
import AccessLockOverlay from "./AccessLockOverlay";
import { NajsIcon } from "./najs/primitives";
import { getLocalizedHref, appendQueryString } from "@/lib/i18n/routing";

interface ChannelVideoCardProps {
  video: PublicVideoDTO;
  isLoggedIn: boolean;
  isPatron?: boolean;
  role?: string;
}

function getViewsLabel(count: number, language: string) {
  if (language !== "pl") return count === 1 ? "view" : "views";
  if (count === 1) return "wyświetlenie";
  const last = count % 10;
  const lastTwo = count % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return "wyświetlenia";
  return "wyświetleń";
}

export default function ChannelVideoCard({
  video,
  isLoggedIn,
  isPatron: propIsPatron,
  role,
}: ChannelVideoCardProps) {
  const { t, language } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isPatron = role === "ADMIN" || propIsPatron === true;
  const displayTitle = getVideoDisplayTitle(video, language);

  const clientHasAccess =
    video.tier === "PUBLIC" ||
    (video.tier === "LOGGED_IN" && isLoggedIn) ||
    (video.tier === "PATRON" && isPatron);

  const hasAccess = clientHasAccess;

  const getAccessBadge = () => {
    if (!mounted) return null;
    const isPl = language === "pl";

    if (video.tier === "PUBLIC") {
      return { text: isPl ? "Publiczne" : "Public", variant: "public" };
    }

    if (video.tier === "LOGGED_IN") {
      if (!hasAccess) return { text: isPl ? "Login" : "Login", variant: "locked" };
      return { text: isPl ? "Odblok." : "Unlocked", variant: "unlocked" };
    }

    if (video.tier === "PATRON") {
      if (!hasAccess) return { text: t.patronOnly, variant: "locked" };
      return { text: isPl ? "Odblok." : "Unlocked", variant: "unlocked" };
    }

    return null;
  };

  const badge = getAccessBadge();
  const lockState = !hasAccess
    ? video.tier === "PATRON"
      ? "PATRON_REQUIRED"
      : "LOGIN_REQUIRED"
    : null;

  return (
    <div className="channel-video-card group cursor-pointer flex flex-col">
      <div className="block relative">
        <Link href={appendQueryString(getLocalizedHref(language, "home"), `v=${video.id}`)} className="absolute inset-0 z-0" />
        <div className="channel-video-card-media relative aspect-video rounded-[13px] bg-black mb-3 z-10 overflow-hidden">
          <div className="relative h-full w-full">
            {video.thumbnailUrl ? (
              <Image
                src={video.thumbnailUrl}
                alt={displayTitle}
                fill
                sizes="(min-width: 1280px) 20vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover opacity-90 transition duration-500 group-hover:scale-105 motion-reduce:transition-none"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-neutral-900">
                <NajsIcon name="video" className="w-8 h-8" stroke="rgba(255,255,255,0.2)" />
              </div>
            )}
            {lockState && (
              <div className="absolute inset-0 z-20">
                <AccessLockOverlay state={lockState} variant="thumbnailCompact" />
              </div>
            )}
            {video.duration && !lockState && (
              <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[12px] font-bold px-1.5 py-0.5 rounded z-30">
                {video.duration}
              </div>
            )}
            {/* Access Indicator Badge on Thumbnail */}
            {badge && (
              <div
                className={cn(
                  "absolute right-2 top-2 z-30 max-w-[92px] truncate rounded-full px-2 py-[3px] text-[9px] font-black uppercase leading-none tracking-[0.14em] pointer-events-none",
                  badge.variant === "public" && "bg-white/92 text-[var(--chan-ink)]",
                  badge.variant === "unlocked" && "bg-[var(--chan-blue-soft)] text-[var(--chan-blue)]",
                  badge.variant === "locked" && "bg-[var(--chan-ink)] text-white",
                )}
              >
                {badge.text}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 relative z-10">
          <div className="flex-1 min-w-0">
            <Link href={appendQueryString(getLocalizedHref(language, "home"), `v=${video.id}`)}>
              <h3 className="font-sans text-[14px] font-bold text-[var(--chan-ink)] leading-tight line-clamp-2 mb-1 hover:opacity-80 transition-opacity">
                {displayTitle}
              </h3>
            </Link>
            <div className="font-sans text-[12px] text-[var(--chan-muted)] leading-relaxed">
              <div className="flex items-center gap-1">
                <span>
                  {mounted
                    ? video.views.toLocaleString(
                        t.currency === "PLN" ? "pl-PL" : "en-US",
                      )
                    : video.views}{" "}
                  {mounted ? getViewsLabel(video.views, language) : t.views}
                </span>
                {video.publishedAt && (
                  <>
                    <span>{"\u2022"}</span>
                    <span>
                      {mounted
                        ? formatDistanceToNow(new Date(video.publishedAt), {
                            addSuffix: true,
                            locale: t.currency === "PLN" ? pl : undefined,
                          }).replace("około", "ok.")
                        : ""}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
