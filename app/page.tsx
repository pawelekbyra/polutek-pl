import React from 'react';
import Footer from './components/Footer';
import { ContentService } from '@/lib/services/content.service';
import { prisma } from '@/lib/prisma';
import { auth, currentUser } from '@clerk/nextjs/server';
import { UserService } from '@/lib/services/user.service';
import CampaignContent from './zrzutka/CampaignContent';
import ChannelHome from './components/ChannelHome';
import Navbar from './components/Navbar';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: { v?: string, q?: string } }) {
  const { userId } = await auth();
  const videoId = searchParams.v;
  const searchQuery = searchParams.q;

  let userDb = null;
  if (userId) {
    userDb = await UserService.getOrCreateUser(userId).catch(() => null);
  }

  const adminData = await ContentService.getAdminData();
  const creator = await ContentService.getCreatorBySlug('polutek');

  // Always show the standard video player view on homepage
  const allVideos = (await ContentService.getAllVideos()) || [];
  const mainVideo = await ContentService.getMainFeaturedVideo();

  const user = await currentUser();

  let initialInteraction = { liked: false, disliked: false };
  let initialIsSubscribed = false;

  if (userId && mainVideo) {
    const targetVideoId = videoId || mainVideo.id;
    const [like, dislike] = await Promise.all([
      prisma.videoLike.findUnique({
        where: { userId_videoId: { userId, videoId: targetVideoId } }
      }),
      prisma.videoDislike.findUnique({
        where: { userId_videoId: { userId, videoId: targetVideoId } }
      })
    ]);
    initialInteraction = { liked: !!like, disliked: !!dislike };

    if (creator?.id) {
      const sub = await prisma.subscription.findUnique({
        where: { userId_creatorId: { userId, creatorId: creator.id } }
      });
      initialIsSubscribed = !!sub;
    }
  }

  const userProfile = userId ? {
    id: userId,
    email: user?.primaryEmailAddress?.emailAddress || '',
    name: userDb?.name || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : null),
    imageUrl: user?.imageUrl || null,
    totalPaid: (userDb?.totalPaidMinor || 0) / 100,
    isPatron: userDb?.isPatron || false,
    role: userDb?.role || 'USER',
    referralPoints: userDb?.referralPoints || 0,
    initialInteraction,
    initialIsSubscribed
  } : null;

  if (!mainVideo && allVideos.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
        <Navbar />
        <main className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Brak materiałów</h1>
          <p className="text-neutral-600 mb-8">
            Nie znaleziono żadnych filmów. Dodaj film w panelu admina, aby go tutaj zobaczyć.
          </p>
          {process.env.NODE_ENV !== 'production' && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800 inline-block">
              Wskazówka: Ustaw <strong>ENABLE_DEMO_FALLBACKS=true</strong> w pliku .env, aby zobaczyć przykładowe materiały.
            </div>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <Navbar />
      <main className="relative">
        <ChannelHome
          mainVideo={mainVideo}
          allVideos={allVideos}
          currentVideoId={videoId}
          userProfile={userProfile as any}
        />
      </main>
      <Footer />
    </div>
  );
}
