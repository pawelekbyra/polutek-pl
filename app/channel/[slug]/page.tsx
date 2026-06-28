import React from 'react';
import Navbar from '@/app/components/Navbar';
import Footer from '@/app/components/Footer';
import { auth } from '@clerk/nextjs/server';
import { Metadata } from 'next';
import { PublicVideoDTO } from '@/app/types/video';
import Link from 'next/link';
import Image from 'next/image';
import { Search } from '@/app/components/icons';
import { CreatorContentService as ContentService } from '@/lib/services/content/creator.service';
import { getOrCreateCurrentUser } from '@/lib/modules/users';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { MainChannelService } from '@/lib/channel/main-channel.service';
import ChannelVideoCard from '@/app/components/ChannelVideoCard';
import { formatCount } from '@/lib/utils';
import SubscribeButton from '@/app/components/SubscribeButton';
import { prisma } from '@/lib/prisma';

export const revalidate = 60;

function getConfiguredSlugSafe() {
  try {
    return MainChannelService.getConfiguredSlug();
  } catch (error) {
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
      throw error;
    }
    return null;
  }
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const mainSlug = getConfiguredSlugSafe();
  if (mainSlug && params.slug !== mainSlug) return { title: 'Kanał nie znaleziony' };

  const creator = await ContentService.getCreatorBySlug(params.slug).catch(() => null);
  if (!creator) return { title: 'Kanał nie znaleziony' };

  return {
    title: creator.name,
    description: creator.bio ?? `Kanał ${creator.name} — materiały wideo`,
    openGraph: {
      title: creator.name,
      description: creator.bio ?? `Kanał ${creator.name}`,
      images: creator.bannerUrl ? [{ url: creator.bannerUrl }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: creator.name,
      images: creator.bannerUrl ? [creator.bannerUrl] : [],
    },
  };
}

function getVideoCountLabel(count: number) {
  if (count === 1) return "film";
  const last = count % 10;
  const lastTwo = count % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return "filmy";
  return "filmów";
}

export default async function ChannelPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const mainSlug = getConfiguredSlugSafe();
  if (mainSlug && params.slug !== mainSlug) {
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

  let authState: { userId: string | null } = { userId: null };
  try {
    authState = await auth();
  } catch {
    authState = { userId: null };
  }

  const creator = await ContentService.getCreatorBySlug(params.slug).catch(() => null);
  const userId = authState.userId;

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

  const userCtx = createAppContext();
  const [userDb, initialSubscribed] = await Promise.all([
    userId ? getOrCreateCurrentUser(userCtx, userId).catch(() => null) : Promise.resolve(null),
    userId
      ? prisma.subscription.findUnique({
          where: { userId_creatorId: { userId, creatorId: creator.id } },
          select: { id: true },
        }).catch(() => null).then(Boolean)
      : Promise.resolve(false),
  ]);

  const freshCreator = await prisma.creator.findUnique({
      where: { id: creator.id },
      select: { subscribersCount: true, displaySubscribersCount: true }
  }).catch(() => null);

  if (freshCreator) {
      creator.subscribersCount = freshCreator.subscribersCount;
  }
  const channelAvatar = creator.imageUrl || null;

  const allVideos: PublicVideoDTO[] = (creator.videos || []).map((v: PublicVideoDTO) => ({
    ...v,
    creator: {
      id: creator.id,
      name: creator.name,
      slug: creator.slug,
      imageUrl: channelAvatar,
      subscribersCount: creator.subscribersCount || 0
    }
  }));

  const displayName = creator.name;
  const displayBio = creator.bio || "Witamy na oficjalnym kanale.";

  return (
    <div className="min-h-screen bg-background text-[#0f0f0f] font-serif">
      <Navbar />

      <div className="max-w-[1284px] mx-auto px-0 md:px-4 lg:px-6">
        <div className="w-full aspect-[6/1] bg-neutral-200 relative overflow-hidden rounded-none md:rounded-xl border border-black/5">
           {creator.bannerUrl ? (
             <Image src={creator.bannerUrl} alt={displayName} fill sizes="(max-width: 768px) 100vw, 1284px" className="object-cover" unoptimized />
           ) : (
             <>
               <div className="absolute inset-0 bg-gradient-to-r from-neutral-300 to-neutral-400 opacity-50" />
               <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                  <span className="text-[10vw] font-black uppercase tracking-tighter rotate-2">{displayName}</span>
               </div>
             </>
           )}
        </div>
      </div>

      <div className="max-w-[1284px] mx-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="relative w-24 h-24 md:w-40 md:h-40 rounded-full border border-neutral-200 overflow-hidden bg-[#1a1a1a]/5 shrink-0 shadow-sm">
             <Image
               src={channelAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`}
               alt={displayName}
               fill
               sizes="(min-width: 768px) 160px, 96px"
               className="object-cover"
               unoptimized
             />
          </div>
          <div className="flex-1 text-center md:text-left space-y-1">
            <h1 className="text-[36px] font-semibold leading-tight tracking-tight mb-1">
              {displayName}
            </h1>
            <div className="text-[14px] text-[#606060] flex flex-wrap justify-center md:justify-start gap-x-1.5 font-sans">
               <span className="font-bold text-[#0f0f0f]">@{creator.slug}</span>
               <span>•</span>
               <span>{formatCount(allVideos.length)} {getVideoCountLabel(allVideos.length)}</span>
            </div>
            <p className="text-[14px] text-[#606060] line-clamp-1 max-w-2xl font-sans mt-1">
               {displayBio}
            </p>
            <div className="mt-4 flex justify-center md:justify-start">
              <SubscribeButton
                creatorId={creator.id}
                creatorSlug={creator.slug}
                creatorName={creator.name}
                initialIsSubscribed={initialSubscribed}
              />
            </div>
          </div>
        </div>

        <div className="flex border-b border-neutral-200 mt-6 overflow-x-auto no-scrollbar gap-8">
           <button className="pb-3 border-b-2 border-[#0f0f0f] text-[14px] font-bold uppercase tracking-widest">Wideo</button>
           <button className="pb-3 text-[#606060] text-[14px] font-bold uppercase tracking-widest hover:text-[#0f0f0f] transition-colors">Playlisty</button>
           <button className="pb-3 text-[#606060] text-[14px] font-bold uppercase tracking-widest hover:text-[#0f0f0f] transition-colors">Społeczność</button>
           <button className="pb-3 text-[#606060] text-[14px] font-bold uppercase tracking-widest hover:text-[#0f0f0f] transition-colors">Informacje</button>
           <div className="ml-auto pb-3 flex items-center gap-4">
              <Search size={20} className="text-[#606060] cursor-pointer" />
           </div>
        </div>

        {allVideos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-8 py-6">
            {allVideos.map((video) => (
              <ChannelVideoCard
                key={video.id}
                video={video}
                isLoggedIn={!!userId}
                isPatron={userDb?.isPatron}
                role={userDb?.role}
              />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center space-y-4">
             <div className="text-4xl opacity-20">🎬</div>
             <h3 className="text-xl font-bold uppercase tracking-tight text-[#0f0f0f]">Brak publicznych materiałów</h3>
             <p className="text-[#606060] max-w-md mx-auto">Na kanale nie ma jeszcze opublikowanych materiałów. Wróć tu później.</p>
             <Link href="/" className="inline-block mt-4 text-[14px] font-bold uppercase tracking-widest border-b-2 border-[#0f0f0f] pb-1 hover:opacity-70 transition-opacity">
                Przejdź do strony głównej
             </Link>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
