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
  const { userId } = auth();
  const videoId = searchParams.v;
  const searchQuery = searchParams.q;

  let userDb = null;
  if (userId) {
    userDb = await UserService.getOrCreateUser(userId).catch(() => null);
  }

  const adminData = await ContentService.getAdminData();
  const creator = await ContentService.getCreatorBySlug('polutek');

  // Always show the standard video player view on homepage
  const allVideos = await ContentService.getAllVideos();
  const mainVideo = await ContentService.getMainFeaturedVideo();

  const user = await currentUser();

  let initialInteraction = { liked: false, disliked: false };
  let initialIsSubscribed = false;

  if (userId) {
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
    totalPaid: userDb?.totalPaid || 0,
    role: userDb?.role || 'USER',
    referralCount: userDb?.referralCount || 0,
    initialInteraction,
    initialIsSubscribed
  } : null;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <Navbar />
      <main className="relative">
        <ChannelHome
          mainVideo={mainVideo as any}
          allVideos={allVideos as any}
          currentVideoId={videoId}
          userProfile={userProfile as any}
        />
      </main>
      <Footer />
    </div>
  );
}
