"use client";

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import VideoPlayer from '../VideoPlayer';
import VideoPlaylist from '../VideoPlaylist';
import PremiumWrapper from '../PremiumWrapper';
import Image from 'next/image';
import { Video, Lock } from '../icons';
import { PublicVideoDTO } from '@/app/types/video';
import { getVideoDisplayTitle } from '@/lib/video-title-overrides';
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
  const [layout, setLayout] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLayout() {
      try {
        const res = await fetch(`/api/channel/sidebar?currentVideoId=${selectedVideoId || ''}`);
        if (res.ok) {
          const data = await res.json();
          setLayout(data);
        }
      } catch (err) {
        logger.error("Failed to fetch sidebar layout", err);
      } finally {
        setLoading(false);
      }
    }
    fetchLayout();
  }, [selectedVideoId]);

  const renderPremiereItem = () => (
    <div className="group flex gap-2 p-1 rounded-lg relative cursor-default bg-gradient-to-r from-amber-50 to-white border border-amber-100">
      <div className="w-[168px] h-[94px] shrink-0 overflow-hidden rounded-md bg-black relative z-10 border border-amber-300">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.55),_transparent_42%),linear-gradient(135deg,_#171717,_#3f2a08)]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 text-white">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">Premiera</span>
          <span className="mt-1 text-[13px] font-black leading-tight">13.10.2026</span>
        </div>
        <div className="absolute inset-0 z-20 bg-black/35 backdrop-blur-[1px] flex items-center justify-center px-2 text-center">
          <div className="rounded-full border border-white/35 bg-black/60 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
            {language === 'pl' ? 'Premiera 13.10.2026' : 'Premiere 13.10.2026'}
          </div>
        </div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 z-10">
        <h4 className="text-[14px] font-semibold text-[#0f0f0f] line-clamp-2 leading-[1.2] tracking-tight">
          Premiera 13.10.2026
        </h4>
        <div className="text-[12px] text-[#606060] flex flex-col mt-0.5">
          <span>{language === 'pl' ? 'Strefa patronów' : 'Patron zone'}</span>
          <span className="font-mono text-[11px] text-amber-700">
            {mounted ? premiereCountdown : '—'}
          </span>
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 mt-0.5">
          {language === 'pl' ? 'Odliczanie do premiery' : 'Premiere countdown'}
        </span>
      </div>
    </div>
  );

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
          <Link href={`/?v=${video.id}`} scroll={false} className="absolute inset-0 z-20" />
          {video.thumbnailUrl ? (
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
          {!hasAccess && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30">
                  <Lock className="text-white/60 w-5 h-5" />
              </div>
          )}
          {video.duration && (
            <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1 rounded z-30 pointer-events-none">
               {video.duration}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 z-10">
          <Link href={`/?v=${video.id}`} scroll={false} className="hover:opacity-80 transition-opacity">
            <h4 className="text-[14px] font-semibold text-[#0f0f0f] line-clamp-2 leading-[1.2] tracking-tight">
               {displayTitle}
            </h4>
          </Link>
          <div className="text-[12px] text-[#606060] flex flex-col mt-0.5">
             <Link href={video.creator?.slug ? `/channel/${video.creator.slug}` : "#"} className="hover:text-[#0f0f0f] transition-colors hover:underline w-fit relative z-20">
               {video.creator?.name || 'Anonimowy Twórca'}
             </Link>
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
          {mounted && (
            hasAccess ? (
              <span className="text-[9px] font-black uppercase tracking-widest text-primary mt-0.5">
                {video.tier === 'PUBLIC' ? t.publicStatus : t.unlockedStatus}
              </span>
            ) : video.tier === 'LOGGED_IN' ? (
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-500 mt-0.5">{t.loginToWatchShort}</span>
            ) : (
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 mt-0.5">{t.becomePatron}</span>
            )
          )}
        </div>
      </div>
    );
  };

  if (loading || !layout) {
      return <SidebarPlaylistSkeleton />;
  }

  const searchResultsSection = searchQuery ? (
      <div className="space-y-2">
          {layout.sections.flatMap((s: any) => s.items)
            .filter((v: any) => v.title.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(renderVideoItem)}
      </div>
  ) : null;

  if (searchResultsSection) return searchResultsSection;

  return (
    <>
      {layout.sections.map((section: any) => (
          <div key={section.id} className="space-y-2 mb-6">
              <div className="pb-1 border-b border-neutral-100">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a1a1a]">{section.title}</h3>
              </div>
              {section.items.map(renderVideoItem)}

              {section.type === 'FREE' && (
                  <div className="pt-4 pb-2">
                      <VideoPlaylist
                        videoTitle={layout.sections[0]?.items[0]?.title || "Materiały"}
                        creatorId={layout.sections[0]?.items[0]?.creatorId || ""}
                        isPatron={viewerIsPatron}
                      />
                  </div>
              )}
          </div>
      ))}
    </>
  );
}
