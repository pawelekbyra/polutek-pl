"use client";

import React, { useEffect, useState } from 'react';
import Hero from './Hero';
import VideoPlaylist from './VideoPlaylist';
import PremiumWrapper from './PremiumWrapper';
import VideoPlayer from './VideoPlayer';
import EmbeddedComments from './comments/EmbeddedComments';
import { PublicVideoDTO } from '../types/video';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useLanguage } from './LanguageContext';
import BrandName from './BrandName';

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
  } | null;
}

import { useSearchParams } from 'next/navigation';

export default function ChannelHome({ mainVideo, allVideos = [], currentVideoId, userProfile }: ChannelHomeProps) {
  const { t, language, setLanguage } = useLanguage();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q');
  const selectedVideo = (allVideos || []).find(v => v.id === currentVideoId) || mainVideo;
  const [activeTab, setActiveTab] = useState<'comments' | 'videos'>('comments');
  const [mounted, setMounted] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    setMounted(true);
    if (selectedVideo?.id) {
        window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [selectedVideo?.id]);

  if (!selectedVideo) {
    return (
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-20 text-center">
            <h1 className="text-2xl font-bold mb-4">{language === 'pl' ? 'Brak filmu' : 'No video found'}</h1>
            <p className="text-neutral-600">
                {language === 'pl'
                    ? 'Nie znaleziono wybranego filmu lub filmu głównego.'
                    : 'The selected video or the main featured video could not be found.'}
            </p>
        </div>
    );
  }

  const prefetchVideoComments = (vidId: string) => {
    queryClient.prefetchInfiniteQuery({
        queryKey: ['comments', vidId],
        queryFn: async () => {
            const url = new URL('/api/comments', window.location.origin);
            url.searchParams.append('videoId', vidId);
            const res = await fetch(url.toString());
            return res.json();
        },
        initialPageParam: '',
    });
  };

  // CUSTOM SORTING LOGIC:
  // 1. PUBLIC videos
  // 2. LOGGED_IN videos
  // 3. PATRON videos
  const sortedVideos = [...(allVideos || [])].sort((a, b) => {
      const tierScore = {
          'PUBLIC': 0,
          'LOGGED_IN': 1,
          'PATRON': 2
      };
      const scoreA = tierScore[a.tier] ?? 0;
      const scoreB = tierScore[b.tier] ?? 0;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return 0;
  });

  const renderVideoItem = (video: PublicVideoDTO) => {
    const isCurrent = video.id === selectedVideo.id;
    const isLoggedIn = !!userProfile;
    const isPatron = (userProfile as any)?.isPatron || (userProfile as any)?.referralPoints >= 5;
    const hasAccess = video.tier === 'PUBLIC' || (video.tier === 'LOGGED_IN' && isLoggedIn) || (video.tier === 'PATRON' && isPatron);

    return (
      <div
        key={video.id}
        onMouseEnter={() => prefetchVideoComments(video.id)}
        className={cn(
          "group flex gap-2 p-1 rounded-lg transition-colors relative cursor-pointer",
          isCurrent ? "bg-[#ebebeb]" : "hover:bg-[#ebebeb]"
        )}
      >
        <Link href={`/?v=${video.id}`} scroll={false} className="absolute inset-0 z-0" />
        <div className="w-[168px] h-[94px] shrink-0 overflow-hidden rounded-md bg-black relative z-10 group/thumb border border-neutral-300">
          <Link href={`/?v=${video.id}`} scroll={false} className="absolute inset-0 z-20" />
          <PremiumWrapper videoId={video.id} requiredTier={video.tier} isMainFeatured={video.isMainFeatured} variant="thumbnail">
             <VideoPlayer video={video} variant="thumbnail" />
          </PremiumWrapper>
          {video.duration && (
            <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1 rounded z-30 pointer-events-none">
               {video.duration}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 z-10">
          <Link href={`/?v=${video.id}`} scroll={false} className="hover:opacity-80 transition-opacity">
            <h4 className="text-[14px] font-semibold text-[#0f0f0f] line-clamp-2 leading-[1.2] tracking-tight">
               {video.slug === 'independency-2024' ? (isLoggedIn ? <>{t.welcomeOn} <BrandName /></> : t.independencyTitle) : video.title}
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

  const publicAndRegisteredVideos = sortedVideos.filter(v => v.tier !== 'PATRON');
  const patronVideos = sortedVideos.filter(v => v.tier === 'PATRON');

  const playlistItems = (
    <>
      {/* SECTION: MATERIALS */}
      {!searchQuery && (
        <div className="pb-2 pt-2">
            <div className="flex justify-between items-end border-b border-neutral-100 pb-1 mb-1">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a1a1a]">{t.materials}</h3>
            </div>
        </div>
      )}
      {publicAndRegisteredVideos.map(renderVideoItem)}

      {/* SECTION: DONATE (STRIPE GATE) */}
      {!searchQuery && (
        <div className="pt-4 pb-0">
            <div className="flex justify-between items-end border-b border-neutral-100 pb-1 mb-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a1a1a]">{t.donate}</h3>
            </div>
            <VideoPlaylist videoTitle={selectedVideo.title} creatorId={selectedVideo.creatorId} />
        </div>
      )}

      {/* SECTION: PATRON ZONE */}
      {!searchQuery && patronVideos.length > 0 && (
        <div className="pt-4">
            <div className="flex justify-between items-end border-b border-neutral-100 pb-1 mb-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a1a1a]">{t.patronZone}</h3>
            </div>
        </div>
      )}
      {patronVideos.map(renderVideoItem)}
    </>
  );

  return (
    <main className="bg-neutral-50 min-h-screen">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-6 py-6">


        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <Hero
              video={selectedVideo}
              initialInteraction={userProfile?.initialInteraction}
              initialIsSubscribed={userProfile?.initialIsSubscribed}
            />

            <div className="lg:hidden flex border-b border-neutral-300 mt-4">
               <button
                 onClick={() => setActiveTab('comments')}
                 className={cn(
                   "flex-1 py-3 text-sm font-semibold uppercase tracking-widest transition-all border-b-2",
                   activeTab === 'comments' ? "border-primary text-primary" : "border-transparent text-[#1a1a1a]/40"
                 )}
               >
                 {t.comments}
               </button>
               <button
                 onClick={() => setActiveTab('videos')}
                 className={cn(
                   "flex-1 py-3 text-sm font-semibold uppercase tracking-widest transition-all border-b-2",
                   activeTab === 'videos' ? "border-primary text-primary" : "border-transparent text-[#1a1a1a]/40"
                 )}
               >
                 {t.videosTab}
               </button>
            </div>

            <div className="lg:hidden mt-10">
               {activeTab === 'comments' ? (
                 <EmbeddedComments
                   videoId={selectedVideo.id}
                   userProfile={userProfile}
                   videoTier={selectedVideo.tier}
                 />
               ) : (
                 <div className="space-y-2">
                    <div className="flex justify-between items-end border-b border-neutral-100 pb-1 mb-2">
                       <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a1a1a]">{t.materials}</h3>
                    </div>
                    {playlistItems}
                    {searchQuery && (
                      <div className="px-2 pt-4 border-t border-neutral-300 mt-4">
                        <Link
                          href="/"
                          className="bg-white border border-neutral-300 rounded-md py-2 text-sm font-medium hover:bg-neutral-50 transition-all font-bold uppercase tracking-widest italic"
                        >
                          {language === 'pl' ? '← Wróć do wszystkich' : '← Back to all'}
                        </Link>
                      </div>
                    )}
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
            {searchQuery && (
                <div className="flex justify-between items-end border-b border-neutral-100 pb-1 mb-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a1a1a]">
                      {language === 'pl' ? 'Wyniki wyszukiwania' : 'Search Results'}
                    </h3>
                  </div>
                </div>
            )}
            {(sortedVideos.length > 0 || !searchQuery) ? (
                <>
                  {playlistItems}
                  {searchQuery && (
                    <div className="pt-4 border-t border-neutral-300 mt-4">
                      <Link
                        href="/"
                        className="bg-white border border-neutral-300 rounded-md py-2 text-sm font-medium hover:bg-neutral-50 transition-all font-bold uppercase tracking-widest italic"
                      >
                        {language === 'pl' ? '← Wróć do listy' : '← Back to list'}
                      </Link>
                    </div>
                  )}
                </>
            ) : (
                <div className="py-10 text-center">
                    <p className="font-serif italic text-sm opacity-30 mb-6">
                        {language === 'pl' ? 'Brak zeznań dla tej kwerendy.' : 'No evidence found for this query.'}
                    </p>
                    <Link
                      href="/"
                      className="bg-white border border-neutral-300 rounded-md py-2 text-sm font-medium hover:bg-neutral-50 transition-all font-bold uppercase tracking-widest italic px-6"
                    >
                      {t.showAll}
                    </Link>
                </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
