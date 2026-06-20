"use client";

import React, { useEffect, useState } from 'react';
import Hero from './Hero';
import VideoPlayer from './VideoPlayer';
import EmbeddedComments from './comments/EmbeddedComments';
import { PublicVideoDTO } from '../types/video';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useLanguage } from './LanguageContext';
import { getVideoDisplayTitle } from '@/lib/video-title-overrides';
import { useSearchParams } from 'next/navigation';
import { SidebarPlaylist } from './channel/SidebarPlaylist';

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
    isPatron?: boolean;
    referralPoints?: number;
    role?: string;
  } | null;
}

const PATRON_PREMIERE_DATE = new Date('2026-10-13T00:00:00+02:00');

const formatPremiereCountdown = (targetDate: Date, language: string) => {
  const remainingMs = targetDate.getTime() - Date.now();
  if (remainingMs <= 0) return language === 'pl' ? 'Premiera już dostępna' : 'Premiere available now';
  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const pad = (v: number) => v.toString().padStart(2, '0');
  return language === 'pl'
    ? `${days} dni ${pad(Math.floor((totalSeconds % 86400) / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}`
    : `${days} days ${pad(Math.floor((totalSeconds % 86400) / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}`;
};

export default function ChannelHome({ mainVideo, allVideos = [], currentVideoId, userProfile }: ChannelHomeProps) {
  const { t, language } = useLanguage();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q');
  const selectedVideo = (allVideos || []).find(v => v.id === currentVideoId || v.slug === currentVideoId) || mainVideo;
  const viewerIsPatron = userProfile?.role === 'ADMIN' || userProfile?.isPatron === true;
  const [activeTab, setActiveTab] = useState<'comments' | 'videos'>('comments');
  const [mounted, setMounted] = useState(false);
  const [premiereCountdown, setPremiereCountdown] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    setMounted(true);
    if (selectedVideo?.id) window.scrollTo({ top: 0, behavior: 'auto' });
  }, [selectedVideo?.id]);

  useEffect(() => {
    const update = () => setPremiereCountdown(formatPremiereCountdown(PATRON_PREMIERE_DATE, language));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [language]);

  if (!selectedVideo) return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 text-center">
      <h1 className="text-2xl font-bold mb-4">{language === 'pl' ? 'Brak filmu' : 'No video found'}</h1>
      <p className="text-neutral-600">{language === 'pl' ? 'Nie znaleziono wybranego filmu lub filmu głównego.' : 'The selected video or the main featured video could not be found.'}</p>
    </div>
  );

  const sortedVideos = [...(allVideos || [])].sort((a, b) => {
      const orderA = a.sidebarOrder === 0 ? 999999 : (a.sidebarOrder ?? 999999);
      const orderB = b.sidebarOrder === 0 ? 999999 : (b.sidebarOrder ?? 999999);
      if (orderA !== orderB) return orderA - orderB;
      return (b.publishedAt ? new Date(b.publishedAt).getTime() : 0) - (a.publishedAt ? new Date(a.publishedAt).getTime() : 0);
  });

  const prefetchComments = (vidId: string) => {
    queryClient.prefetchInfiniteQuery({
        queryKey: ['comments', vidId],
        queryFn: async () => {
            const url = new URL('/api/comments', window.location.origin);
            url.searchParams.append("videoId", vidId);
            const res = await fetch(url.toString());
            return res.json();
        },
        initialPageParam: '',
    });
  };

  const commonSidebarProps = {
    sortedVideos,
    selectedVideoId: selectedVideo.id,
    userProfile,
    viewerIsPatron,
    searchQuery,
    t,
    language,
    mounted,
    premiereCountdown,
    onVideoMouseEnter: prefetchComments
  };

  return (
    <main className="bg-neutral-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-6 py-6">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8">
            <Hero
              video={selectedVideo}
              initialInteraction={userProfile?.initialInteraction}
              initialIsSubscribed={userProfile?.initialIsSubscribed}
            />
            <div className="lg:hidden flex border-b border-neutral-300 mt-4">
               {(['comments', 'videos'] as const).map((tab) => (
                 <button key={tab} onClick={() => setActiveTab(tab)} className={cn("flex-1 py-3 text-sm font-semibold uppercase tracking-widest transition-all border-b-2", activeTab === tab ? "border-primary text-primary" : "border-transparent text-[#1a1a1a]/40")}>
                   {tab === 'comments' ? t.comments : t.videosTab}
                 </button>
               ))}
            </div>
            <div className="lg:hidden mt-10">
               {activeTab === 'comments' ? (
                 <EmbeddedComments videoId={selectedVideo.id} userProfile={userProfile} videoTier={selectedVideo.tier} />
               ) : (
                 <div className="space-y-2">
                    <div className="flex justify-between items-end border-b border-neutral-100 pb-1 mb-2">
                       <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a1a1a]">{t.materials}</h3>
                    </div>
                    <SidebarPlaylist {...commonSidebarProps} />
                    {searchQuery && (
                      <div className="px-2 pt-4 border-t border-neutral-300 mt-4">
                        <Link href="/" className="bg-white border border-neutral-300 rounded-md py-2 text-sm font-medium hover:bg-neutral-50 transition-all font-bold uppercase tracking-widest italic">{language === 'pl' ? '← Wróć do wszystkich' : '← Back to all'}</Link>
                      </div>
                    )}
                 </div>
               )}
            </div>
            <div className="hidden lg:block mt-10">
               <EmbeddedComments videoId={selectedVideo.id} userProfile={userProfile} videoTier={selectedVideo.tier} />
            </div>
          </div>
          <aside className="hidden lg:block lg:col-span-4 space-y-2">
            {searchQuery && (
                <div className="flex justify-between items-end border-b border-neutral-100 pb-1 mb-0">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a1a1a]">{language === 'pl' ? 'Wyniki wyszukiwania' : 'Search Results'}</h3>
                </div>
            )}
            {(sortedVideos.length > 0 || !searchQuery) ? (
                <>
                  <SidebarPlaylist {...commonSidebarProps} />
                  {searchQuery && (
                    <div className="pt-4 border-t border-neutral-300 mt-4">
                      <Link href="/" className="bg-white border border-neutral-300 rounded-md py-2 text-sm font-medium hover:bg-neutral-50 transition-all font-bold uppercase tracking-widest italic">{language === 'pl' ? '← Wróć do listy' : '← Back to list'}</Link>
                    </div>
                  )}
                </>
            ) : (
                <div className="py-10 text-center">
                    <p className="font-serif italic text-sm opacity-30 mb-6">{language === 'pl' ? 'Brak zeznań dla tej kwerendy.' : 'No evidence found for this query.'}</p>
                    <Link href="/" className="bg-white border border-neutral-300 rounded-md py-2 text-sm font-medium hover:bg-neutral-50 transition-all font-bold uppercase tracking-widest italic px-6">{t.showAll}</Link>
                </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
