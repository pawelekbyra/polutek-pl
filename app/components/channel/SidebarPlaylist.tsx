"use client";

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import VideoPlaylist from '../VideoPlaylist';
import Image from 'next/image';
import { Video, Lock, AlertCircle } from '../icons';
import { PublicVideoDTO } from '@/app/types/video';
import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { SidebarPlaylistSkeleton } from '@/components/skeletons';

interface SidebarPlaylistProps {
  sortedVideos: PublicVideoDTO[];
  selectedVideoId?: string;
  userProfile: any;
  viewerIsPatron: boolean;
  searchQuery: string | null;
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
  searchQuery,
  t,
  language,
  mounted,
  premiereCountdown,
  onVideoMouseEnter
}: SidebarPlaylistProps) {
  const getSidebarAccessBadge = (video: any, hasAccess: boolean, lang: string) => {
    const isPl = lang === 'pl';
    if (!video.tier || video.tier === 'PUBLIC') {
      return { text: isPl ? "Publiczne" : "Public", variant: 'public' };
    }

    if (video.tier === 'LOGGED_IN') {
      if (!hasAccess) return { text: isPl ? "Zaloguj się" : "Login required", variant: 'locked' };
      return { text: isPl ? "Odblokowane" : "Unlocked", variant: 'unlocked' };
    }

    if (video.tier === 'PATRON') {
      if (!hasAccess) return { text: isPl ? "Patron" : "Patron", variant: 'locked' };
      return { text: isPl ? "Odblokowane" : "Unlocked", variant: 'unlocked' };
    }

    return null;
  };

  const [layout, setLayout] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    async function fetchLayout() {
      try {
        const res = await fetch(`/api/channel/sidebar?currentVideoId=${selectedVideoId || ''}`);
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

  const renderVideoItem = (video: any) => {
    const displayTitle = language === 'en' && video.titleEn ? video.titleEn : video.title;
    const isCurrent = video.id === selectedVideoId;
    const hasAccess = !video.isLocked;

    return (
      <div
        key={video.id || video.slug}
        onMouseEnter={() => onVideoMouseEnter(video.id)}
        className={cn(
          "group flex gap-2 p-1 rounded-lg transition-colors relative cursor-pointer",
          isCurrent ? "bg-[#ebebeb]" : "hover:bg-[#ebebeb]"
        )}
      >
        <Link href={`/?v=${video.id}`} scroll={false} className="absolute inset-0 z-0" />
        <div className="w-[168px] h-[94px] shrink-0 overflow-hidden rounded-md bg-black relative z-10 group/thumb border border-neutral-300">
          <Link href={`/?v=${video.id}`} scroll={false} className="absolute inset-0 z-40" />
          <div className="relative w-full h-full">
              {video.thumbnailUrl ? (
                  <Image
                    src={video.thumbnailUrl}
                    alt={displayTitle}
                    fill
                    className={cn(
                      "object-cover transition duration-700 group-hover/thumb:scale-105",
                      !hasAccess ? "opacity-40 grayscale-[0.5]" : "opacity-90"
                    )}
                  />
              ) : (
                  <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                      <Video className="text-white/20 w-8 h-8" />
                  </div>
              )}

              {!hasAccess && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                  <Lock className="text-white/80 w-5 h-5 drop-shadow-md" />
                </div>
              )}

              {video.duration && (
                <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1 rounded z-30 pointer-events-none">
                   {video.duration}
                </div>
              )}
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-start pt-0 gap-0.5 z-10 relative">
          <Link href={`/?v=${video.id}`} scroll={false} className="hover:opacity-80 transition-opacity">
            <h4 className="text-[14px] font-semibold text-[#0f0f0f] line-clamp-2 leading-[1.2] tracking-tight">
               {displayTitle}
            </h4>
          </Link>
          <div className="text-[12px] text-[#606060] flex flex-col mt-0.5">
             <div className="hover:text-[#0f0f0f] transition-colors w-fit relative z-20">
               {video.creator?.name || 'Anonimowy Twórca'}
             </div>
             <div className="flex items-center gap-1">
                <span>{mounted ? video.views?.toLocaleString(language === 'pl' ? 'pl-PL' : 'en-US') : video.views} {t.views}</span>
                {video.publishedAt && (
                    <>
                        <span>•</span>
                        <span>{mounted ? formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true, locale: language === 'pl' ? pl : undefined }).replace('około', 'ok.') : ''}</span>
                    </>
                )}
             </div>
          </div>
          {/* Access Indicator Badge moved to right-bottom of text box */}
          {mounted && (() => {
              const badge = getSidebarAccessBadge(video, hasAccess, language);
              if (!badge) return null;
              return (
                  <div className={cn(
                    "absolute bottom-0 right-0 bg-black/60 backdrop-blur-md text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-[#1a1a1a] tracking-widest z-30 pointer-events-none mb-0.5 mr-0.5",
                    badge.variant === 'unlocked' && "bg-primary/80 border-primary/20"
                  )}>
                      {badge.text}
                  </div>
              );
          })()}
        </div>
      </div>
    );
  };

  if (loading) {
      return <SidebarPlaylistSkeleton />;
  }

  // Fallback to sortedVideos if layout is missing or error occurred
  if (error || !layout) {
    if (!sortedVideos || sortedVideos.length === 0) {
      return (
        <div className="p-8 text-center border-2 border-dashed border-neutral-100 rounded-2xl">
          <p className="text-sm text-neutral-500 italic">
            {language === 'pl' ? 'Brak filmów do wyświetlenia.' : 'No videos to show.'}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="pb-1 border-b border-neutral-100 mb-4 flex items-center gap-2">
           <AlertCircle size={14} className="text-amber-500" />
           <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a1a1a]">
             {language === 'pl' ? 'Dostępne filmy' : 'Available videos'}
           </h3>
        </div>
        {sortedVideos.map(v => renderVideoItem({
          ...v,
          isLocked: v.tier === 'PATRON' ? !viewerIsPatron : (v.tier === 'LOGGED_IN' ? !userProfile : false)
        }))}
      </div>
    );
  }

  if (layout.sections.length === 0) {
    return (
      <div className="p-8 text-center border-2 border-dashed border-neutral-100 rounded-2xl">
        <p className="text-sm text-neutral-500 italic">
          {language === 'pl' ? 'Brak filmów do wyświetlenia.' : 'No videos to show.'}
        </p>
      </div>
    );
  }

  const searchResultsSection = searchQuery ? (
      <div className="space-y-2">
          {layout.sections.flatMap((s: any) => s.items)
            .filter((v: any) => v.title.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(renderVideoItem)}
      </div>
  ) : null;

  if (searchResultsSection) return searchResultsSection;

  // We need to find where to put the tip gate.
  // Requirement: "nad bramke napiwkowa pod darmowymi materiałami"
  // After implementing renaming, "Darmowe materiały" is "Publiczne".
  // The layout has sections: Publiczne (FREE), Dla zalogowanych (LOGGED_IN), Strefa Patrona (PATRON).
  // We want: Publiczne, Dla zalogowanych, TIP GATE, Strefa Patrona.

  const publicSection = layout.sections.find((s: any) => s.type === 'FREE');
  const loggedInSection = layout.sections.find((s: any) => s.type === 'LOGGED_IN');
  const patronSection = layout.sections.find((s: any) => s.type === 'PATRON');
  const otherSections = layout.sections.filter((s: any) => !['FREE', 'LOGGED_IN', 'PATRON'].includes(s.type));

  const renderSection = (section: any) => (
    <div key={section.id} className="space-y-2 mb-6">
      <div className="pb-1 border-b border-neutral-100">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a1a1a]">{section.title}</h3>
      </div>
      {section.items.map(renderVideoItem)}
    </div>
  );

  return (
    <>
      {publicSection && renderSection(publicSection)}
      {loggedInSection && renderSection(loggedInSection)}

      {/* TIP GATE - Always show after Public/Logged-in if there's content */}
      {(publicSection || loggedInSection) && (
          <div className="pt-2 pb-6">
              <VideoPlaylist
                videoTitle={layout.sections[0]?.items[0]?.title || "Materiały"}
                creatorId={layout.sections[0]?.items[0]?.creatorId || ""}
                isPatron={viewerIsPatron}
              />
          </div>
      )}

      {patronSection && renderSection(patronSection)}
      {otherSections.map(renderSection)}
    </>
  );
}
