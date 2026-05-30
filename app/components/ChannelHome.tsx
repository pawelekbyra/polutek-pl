"use client";

import React, { useEffect, useState } from 'react';
import Hero from './Hero';
import VideoPlaylist from './VideoPlaylist';
import PremiumWrapper from './PremiumWrapper';
import VideoPlayer from './VideoPlayer';
import EmbeddedComments from './comments/EmbeddedComments';
import { Video } from '../types/video';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useLanguage } from './LanguageContext';
import BrandName from './BrandName';

interface ChannelHomeProps {
  mainVideo: Video;
  allVideos: Video[];
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
  // 1. Current (selected) video always first
  // 2. LOGGED_IN video (with "nie masz psychy sie zalogować" overlay) second
  // 3. Other videos (PUBLIC first, then VIP)
  const sortedVideos = [...allVideos].sort((a, b) => {
      // Rule 1: Selected video first
      if (a.id === selectedVideo.id) return -1;
      if (b.id === selectedVideo.id) return 1;

      // Rule 2: "LOGGED_IN" video (with paywall overlay) second
      const aIsLoggedInGated = a.tier === 'LOGGED_IN';
      const bIsLoggedInGated = b.tier === 'LOGGED_IN';

      // If we're on the main video, we want a LOGGED_IN video at index 1
      if (selectedVideo?.id === mainVideo?.id) {
          if (aIsLoggedInGated && !bIsLoggedInGated) return -1;
          if (!aIsLoggedInGated && bIsLoggedInGated) return 1;
      }

      // Rule 3: PUBLIC videos first among others
      const aIsPublic = a.tier === 'PUBLIC' || a.isMainFeatured;
      const bIsPublic = b.tier === 'PUBLIC' || b.isMainFeatured;

      if (aIsPublic && !bIsPublic) return -1;
      if (!aIsPublic && bIsPublic) return 1;

      // Default: keep existing order (createdAt desc)
      return 0;
  });

  const playlistItems = sortedVideos.reduce((acc: any[], video, i) => {
      const isCurrent = video.id === selectedVideo.id;
      const isLoggedIn = !!userProfile;
      const isPatron = (userProfile as any)?.isPatron || (userProfile as any)?.referralPoints >= 5;

      const hasAccess = video.tier === 'PUBLIC' ||
                        (video.tier === 'LOGGED_IN' && isLoggedIn) ||
                        (video.tier === 'PATRON' && isPatron) ||
                        video.isMainFeatured;

      acc.push(
          <div
            key={video.id}
            onMouseEnter={() => prefetchVideoComments(video.id)}
            className={cn(
              "group flex gap-3 rounded-2xl border p-2.5 transition-all duration-200 relative cursor-pointer overflow-hidden",
              isCurrent
                ? "border-blue-200 bg-blue-50/90 shadow-sm ring-1 ring-blue-100"
                : "border-transparent bg-white/60 hover:-translate-y-0.5 hover:border-neutral-200 hover:bg-white hover:shadow-md"
            )}
          >
            <Link
               href={`/?v=${video.id}`}
               scroll={false}
               className="absolute inset-0 z-0"
            />
            <div className="w-[168px] h-[94px] shrink-0 overflow-hidden rounded-xl bg-black relative z-10 group/thumb border border-white/70 shadow-sm">
              <Link
                href={`/?v=${video.id}`}
                scroll={false}
                className="absolute inset-0 z-20"
              />
              <PremiumWrapper videoId={video.id} videoUrl={video.videoUrl} requiredTier={video.tier} isMainFeatured={video.isMainFeatured} variant="thumbnail">
                 <VideoPlayer video={video} variant="thumbnail" />
              </PremiumWrapper>
              {video.duration && (
                <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md z-30 pointer-events-none">
                   {video.duration}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 z-10">
              <Link
                href={`/?v=${video.id}`}
                scroll={false}
                className="hover:opacity-80 transition-opacity"
              >
                <h4 className="text-[14px] font-bold text-neutral-950 line-clamp-2 leading-[1.25] tracking-tight group-hover:text-blue-700 transition-colors">
                   {video.slug === 'independency-2024'
                    ? (isLoggedIn ? (
                        <>{t.welcomeOn} <BrandName /></>
                    ) : t.independencyTitle)
                    : video.title}
                </h4>
              </Link>
              <div className="text-[12px] text-neutral-500 flex flex-col mt-0.5">
                 <Link
                   href={video.creator?.slug ? `/channel/${video.creator.slug}` : "#"}
                   className="hover:text-[#0f0f0f] transition-colors hover:underline w-fit relative z-20"
                 >
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
                  <span className="w-fit rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-blue-700 mt-1">
                    {video.tier === 'PUBLIC' ? t.publicStatus : t.unlockedStatus}
                  </span>
                ) : video.tier === 'LOGGED_IN' ? (
                  <span className="w-fit rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-sky-700 mt-1">{t.loginToWatchShort}</span>
                ) : (
                  <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700 mt-1">{t.becomePatron}</span>
                )
              )}
            </div>
          </div>
      );

      // Rule: Donate section always appears after the 2nd item (index 1) in the visual list
      if (i === 1) {
        acc.push(
          <div key="donate" className="pt-4 pb-0">
              <div className="flex justify-between items-end border-b border-neutral-200/70 pb-2 mb-3">
                 <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a1a1a]">{t.donate}</h3>
              </div>
              <VideoPlaylist
                 videoTitle={selectedVideo.title}
                 creatorId={selectedVideo.creatorId}
              />
          </div>
        );
        acc.push(
          <div key="patron-header" className="pt-4">
              <div className="flex justify-between items-end border-b border-neutral-200/70 pb-2 mb-2">
                 <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a1a1a]">{t.patronZone}</h3>
              </div>
          </div>
        );
      }

      return acc;
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.16),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#f5f1ea_100%)]">
      <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-4 md:px-6 lg:px-8 lg:py-8">


        <div className="grid grid-cols-12 gap-5 lg:gap-8">
          <div className="col-span-12 lg:col-span-8 xl:col-span-8">
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
                    <div className="flex justify-between items-end border-b border-neutral-200/70 pb-2 mb-3">
                       <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a1a1a]">{t.materials}</h3>
                    </div>
                    {playlistItems}
                    {searchQuery && (
                      <div className="px-2 pt-4 border-t border-neutral-300 mt-4">
                        <Link
                          href="/"
                          className="inline-flex rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-bold uppercase tracking-widest italic shadow-sm transition-all hover:-translate-y-0.5 hover:bg-neutral-50 hover:shadow"
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

          <aside className="hidden lg:block lg:col-span-4 xl:col-span-4">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-[2rem] border border-white/70 bg-white/70 p-3 shadow-xl shadow-neutral-900/5 backdrop-blur-xl">
            <div className="flex justify-between items-end border-b border-neutral-200/70 pb-2 mb-2">
              <div className="flex items-center gap-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a1a1a]">
                  {searchQuery ? (language === 'pl' ? 'Wyniki wyszukiwania' : 'Search Results') : t.materials}
                </h3>
              </div>
            </div>
            {playlistItems.length > 0 ? (
                <>
                  {playlistItems}
                  {searchQuery && (
                    <div className="pt-4 border-t border-neutral-300 mt-4">
                      <Link
                        href="/"
                        className="inline-flex rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-bold uppercase tracking-widest italic shadow-sm transition-all hover:-translate-y-0.5 hover:bg-neutral-50 hover:shadow"
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
                      className="inline-flex rounded-full border border-neutral-300 bg-white px-6 py-2 text-sm font-bold uppercase tracking-widest italic shadow-sm transition-all hover:-translate-y-0.5 hover:bg-neutral-50 hover:shadow"
                    >
                      {t.showAll}
                    </Link>
                </div>
            )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
