import React from 'react';
import Navbar from '@/app/components/Navbar';
import Footer from '@/app/components/Footer';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { Video } from '@/app/types/video';
import Link from 'next/link';
import { Search } from '@/app/components/icons';
import { ContentService } from '@/lib/services/content.service';
import { UserService } from '@/lib/services/user.service';
import ChannelVideoCard from '@/app/components/ChannelVideoCard';
import SubscribeButton from '@/app/components/SubscribeButton';
import BrandName from '@/app/components/BrandName';
import { cn, formatCount } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ChannelPage({ params }: { params: { slug: string } }) {
  const creator = await ContentService.getCreatorBySlug(params.slug) as (any & { videos: any[] });

  if (!creator) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-serif">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <h1 className="text-4xl font-black uppercase">Kanał nie znaleziony</h1>
            <p className="text-[#606060] mt-2 mb-6">Ten kanał nie istnieje.</p>
            <Link href="/" className="bg-[#0f0f0f] text-white px-8 py-3 rounded-md uppercase font-bold tracking-widest hover:bg-[#272727] transition-all">Wróć na stronę główną</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const { userId } = auth();
  const userDb = userId ? await UserService.getOrCreateUser(userId).catch(() => null) : null;
  const isSubscribed = (userId && creator) ? await UserService.isSubscribed(userId, creator.id).catch(() => false) : false;

  // Check if current user is the owner of this channel
  const isOwner = userDb && userDb.id === creator.userId;
  const ownerAvatar = (params.slug === 'polutek') ? '/nowe.png' : (isOwner ? userDb.imageUrl : (creator.user?.imageUrl || creator.imageUrl || null));
  const ownerEmail = isOwner ? userDb.email : (creator.user?.email || null);

  const allVideos: Video[] = (creator.videos || []).map((v: any) => ({
    ...v,
    creator: {
      id: creator.id,
      name: creator.slug === 'polutek' ? 'POLUTEK.PL' : creator.name,
      slug: creator.slug,
      bio: creator.bio,
      imageUrl: ownerAvatar,
      email: ownerEmail,
      bannerUrl: creator.bannerUrl,
      subscribersCount: creator.subscribersCount || 0
    }
  }));

  const displayName = creator.slug === 'polutek' ? 'POLUTEK.PL' : creator.name;
  const displayBio = creator.slug === 'polutek'
    ? "Oficjalna platforma POLUTEK.PL. Ekskluzywne materiały VOD i niezależne śledztwa."
    : (creator.bio || "Witamy na oficjalnym kanale.");

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#0f0f0f] font-serif">
      <Navbar />

      {/* CHANNEL COVER */}
      <div className="max-w-[1284px] mx-auto px-0 md:px-4 lg:px-6">
        <div className="w-full aspect-[6/1] bg-neutral-200 relative overflow-hidden rounded-none md:rounded-xl border border-black/5">
           {creator.bannerUrl ? (
             <img src={creator.bannerUrl} alt={displayName} className="w-full h-full object-cover" />
           ) : (
             <>
               <div className="absolute inset-0 bg-gradient-to-r from-neutral-300 to-neutral-400 opacity-50" />
               <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                  {creator.slug === 'polutek' ? (
                    <BrandName className="text-[10vw] rotate-2" dotPlClassName="text-primary" />
                  ) : (
                    <span className="text-[10vw] font-black uppercase tracking-tighter rotate-2">{displayName}</span>
                  )}
               </div>
             </>
           )}
        </div>
      </div>

      {/* CHANNEL HEADER */}
      <div className="max-w-[1284px] mx-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="w-24 h-24 md:w-40 md:h-40 rounded-full border border-neutral-200 overflow-hidden bg-[#1a1a1a]/5 shrink-0 shadow-sm">
             <img
               src={ownerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ownerEmail || displayName}`}
               alt={displayName}
               className={cn(
                 "w-full h-full",
                 params.slug === 'polutek' ? "object-contain p-2" : "object-cover"
               )}
             />
          </div>
          <div className="flex-1 text-center md:text-left space-y-1">
            <h1 className="text-[36px] font-black leading-tight tracking-tight uppercase mb-1">
              {creator.slug === 'polutek' ? <BrandName /> : displayName}
            </h1>
            <div className="text-[14px] text-[#606060] flex flex-wrap justify-center md:justify-start gap-x-1.5 font-sans">
               <span className="font-bold text-[#0f0f0f]">@{creator.slug}</span>
               <span>•</span>
               <span>{formatCount(allVideos.length)} filmów</span>
            </div>
            <p className="text-[14px] text-[#606060] line-clamp-1 max-w-2xl font-sans mt-1">
               {displayBio}
            </p>
            <div className="pt-3 flex flex-wrap justify-center md:justify-start gap-4 items-center">
               <SubscribeButton
                 creatorId={creator.id}
                 initialSubscribersCount={creator.subscribersCount || 0}
                 initialIsSubscribed={isSubscribed}
               />
               <Link href={userId ? "/#donations" : "/"} className="bg-[#000000]/5 hover:bg-[#000000]/10 rounded-md px-6 h-9 font-bold text-[14px] transition-all uppercase tracking-widest flex items-center mb-5 border border-neutral-200">Wspieraj</Link>
            </div>
          </div>
        </div>

        {/* CHANNEL TABS */}
        <div className="flex border-b border-neutral-200 mt-6 overflow-x-auto no-scrollbar gap-8">
           <button className="pb-3 border-b-2 border-[#0f0f0f] text-[14px] font-bold uppercase tracking-widest">Wideo</button>
           <button className="pb-3 text-[#606060] text-[14px] font-bold uppercase tracking-widest hover:text-[#0f0f0f] transition-colors">Playlisty</button>
           <button className="pb-3 text-[#606060] text-[14px] font-bold uppercase tracking-widest hover:text-[#0f0f0f] transition-colors">Społeczność</button>
           <button className="pb-3 text-[#606060] text-[14px] font-bold uppercase tracking-widest hover:text-[#0f0f0f] transition-colors">Informacje</button>
           <div className="ml-auto pb-3 flex items-center gap-4">
              <Search size={20} className="text-[#606060] cursor-pointer" />
           </div>
        </div>

        {/* VIDEOS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-8 py-6">
          {allVideos.map((video) => (
            <ChannelVideoCard
              key={video.id}
              video={video}
              isLoggedIn={!!userId}
              userTotalPaid={userDb?.totalPaid || 0}
            />
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
