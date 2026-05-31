import React from 'react';
import Footer from './components/Footer';
import { ContentService } from '@/lib/services/content.service';
import { prisma } from '@/lib/prisma';
import { auth, currentUser } from '@clerk/nextjs/server';
import { UserService } from '@/lib/services/user.service';
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
      }).catch(() => null),
      prisma.videoDislike.findUnique({
        where: { userId_videoId: { userId, videoId: targetVideoId } }
      }).catch(() => null)
    ]);
    initialInteraction = { liked: !!like, disliked: !!dislike };

    if (creator?.id) {
      const sub = await prisma.subscription.findUnique({
        where: { userId_creatorId: { userId, creatorId: creator.id } }
      }).catch(() => null);
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

  if (!mainVideo && (!allVideos || allVideos.length === 0)) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
        <Navbar />
        <main className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Brak materiałów</h1>
          {process.env.DEBUG_HOME_CONTENT === "true" && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded text-left text-xs font-mono text-red-800">
              <p className="font-bold mb-2">DEBUG INFO (Visible only with DEBUG_HOME_CONTENT=true):</p>
              <p>mainVideo: {mainVideo ? "Found" : "Null"}</p>
              <p>allVideos count: {allVideos.length}</p>
              <p>Check &quot;npm run content:diagnose&quot; for database status.</p>
            </div>
          )}
          <p className="text-neutral-600 mb-8">
            Nie znaleziono żadnych filmów. Dodaj film w panelu admina, aby go tutaj zobaczyć.
          </p>
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
          userProfile={userProfile}
        />
      </main>
      <Footer />
    </div>
  );
}
