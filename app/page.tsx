import { logger } from "@/lib/logger";
import React from 'react';
import Footer from './components/Footer';
import { PublicVideoDTO } from '@/app/types/video';
import { ContentService } from '@/lib/services/content.service';
import { loadHomeContent } from '@/lib/services/home-content.loader';
import { normalizePaymentTotals } from '@/lib/services/user-access.service';
import { prisma } from '@/lib/prisma';
import { auth, currentUser } from '@clerk/nextjs/server';
import { UserService } from '@/lib/services/user.service';
import ChannelHome from './components/ChannelHome';
import Navbar from './components/Navbar';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: { v?: string, q?: string } }) {
  let authData = { userId: null as string | null };
  try {
    authData = await auth();
  } catch (e) {
    logger.error("[HOME_AUTH_ERROR]", e);
  }
  const userId = authData.userId;

  const videoId = searchParams.v;
  const searchQuery = searchParams.q;

  let userDb = null;
  if (userId) {
    userDb = await prisma.user.findUnique({
      where: { id: userId },
      include: { paymentTotals: true }
    }).catch(() => null);

    if (!userDb) {
      // If UserService.getOrCreateUser is called, it might not return paymentTotals by default.
      // Re-fetch to ensure relations are present for type safety and normalized totals.
      await UserService.getOrCreateUser(userId).catch((e) => {
        logger.error("[HOME_USER_FETCH_ERROR]", e);
      });
      userDb = await prisma.user.findUnique({
        where: { id: userId },
        include: { paymentTotals: true }
      }).catch(() => null);
    }
  }

  const content = await loadHomeContent();
  const { creator, allVideos, mainVideo } =
    content.status !== 'error'
      ? content
      : { creator: null, allVideos: [] as PublicVideoDTO[], mainVideo: null };

  let user = null;
  try {
    user = await currentUser();
  } catch (e) {
    logger.error("[HOME_CURRENT_USER_ERROR]", e);
  }

  let initialInteraction = { liked: false, disliked: false };
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
  }

  const userProfile = userId ? {
    id: userId,
    email: user?.primaryEmailAddress?.emailAddress || '',
    name: userDb?.name || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : null),
    imageUrl: user?.imageUrl || null,
    // Use normalized totals from UserPaymentTotal if userDb is present
    totalPaid: (userDb && 'paymentTotals' in userDb) ? normalizePaymentTotals(userDb.paymentTotals) : 0,
    isPatron: userDb?.isPatron || false,
    role: userDb?.role || 'USER',
    referralPoints: userDb?.referralPoints || 0,
    initialInteraction
  } : null;

  if (content.status === 'error' || content.status === 'empty') {
    const isError = content.status === 'error';
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
        <Navbar />
        <main className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">
            {isError ? 'Błąd wczytywania' : 'Brak materiałów'}
          </h1>
          <p className="text-neutral-600 mb-8">
            {isError
              ? content.publicMessage
              : 'Nie znaleziono żadnych filmów. Dodaj film w panelu admina, aby go tutaj zobaczyć.'}
          </p>

          {process.env.DEBUG_HOME_CONTENT === 'true' && content.debug && (
            <div className="mt-8 p-6 bg-white border border-neutral-200 rounded-xl shadow-sm text-left font-sans text-sm">
              <h2 className="text-blue-600 font-bold mb-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                DIAGNOSTYKA (Widoczna tylko w trybie debug)
              </h2>
              <div className="space-y-1 text-neutral-700">
                <p className="text-xs uppercase text-neutral-400 font-bold mb-2">Stage: {content.debug.stage}</p>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-neutral-100">
                  <div>
                    <p className="text-xs uppercase text-neutral-400 font-bold">Creator Status</p>
                    <p className="font-mono text-xs">{content.debug.creatorSuccess ? 'OK' : 'FAIL'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-neutral-400 font-bold">Videos Status</p>
                    <p className="font-mono text-xs">{content.debug.allVideosSuccess ? 'OK' : 'FAIL'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-neutral-400 font-bold">Main Video</p>
                    <p className="font-mono text-xs">{content.debug.mainVideoId || 'NULL'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-neutral-400 font-bold">All Videos Count</p>
                    <p className="font-mono text-xs">{content.debug.allVideosCount}</p>
                  </div>
                </div>
                <div className="mt-6 bg-neutral-900 text-neutral-300 p-4 rounded-lg font-mono text-xs">
                  <p className="mb-2 text-neutral-500"># Spróbuj naprawić dane:</p>
                  <p className="text-blue-400">npm run content:diagnose</p>
                  <p className="text-blue-400">npm run content:fix:main-creator</p>
                </div>
              </div>
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
          userProfile={userProfile}
        />
      </main>
      <Footer />
    </div>
  );
}
