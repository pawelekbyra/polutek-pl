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
import { Frame, NajsIcon, INK } from "./najs/primitives";
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
    <div className="group cursor-pointer flex flex-col">
      <div className="block relative">
        <Link href={appendQueryString(getLocalizedHref(language, "home"), `v=${video.id}`)} className="absolute inset-0 z-0" />
        <div className="relative aspect-video rounded-md bg-black mb-2.5 z-10">
          <Frame radius={8} seed={22} stroke={INK} strokeWidth={1} />
          <div className="absolute inset-0 overflow-hidden rounded-md">
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
                  "absolute right-2 top-2 z-30 max-w-[92px] truncate rounded-full border px-2 py-[3px] text-[9px] font-black uppercase leading-none tracking-[0.14em] shadow-[0_2px_7px_rgba(0,0,0,0.24)] pointer-events-none",
                  badge.variant === "public" &&
                    "border-[#171717]/65 bg-[#f8f3e7] text-[#171717] shadow-[0_0_0_1px_rgba(248,243,231,0.65),0_2px_8px_rgba(23,23,23,0.24)]",
                  badge.variant === "unlocked" &&
                    "border-[#2563eb]/35 bg-[#eff3fe] text-[#2563eb]",
                  badge.variant === "locked" &&
                    "border-[#171717]/25 bg-[#171717] text-[#f8f3e7]",
                )}
              >
                {badge.text}
              </div>
            )}
          </div>
          </div>
        </div>
        <div className="flex gap-2 relative z-10">
          <div className="flex-1 min-w-0">
            <Link href={appendQueryString(getLocalizedHref(language, "home"), `v=${video.id}`)}>
              <h3 className="text-[14px] font-bold text-[#0f0f0f] leading-tight line-clamp-2 mb-1 hover:opacity-80 transition-opacity" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
                {displayTitle}
              </h3>
            </Link>
            <div className="text-[12px] text-[#606060] leading-relaxed" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
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
          <button className="relative h-[28px] w-[28px] flex items-center justify-center opacity-0 group-hover:opacity-100 shrink-0 active:scale-95 transition-opacity">
            <Frame radius={8} seed={55} stroke={INK} strokeWidth={1} fill="rgba(248,243,231,.88)" />
            <NajsIcon name="more-vertical" className="relative h-[16px] w-[16px]" stroke={INK} />
          </button>
        </div>
      </div>
    </div>
  );
}
