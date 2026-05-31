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
  let allVideos: any[] = [];
  let mainVideo = null;
  let contentError = null;

  try {
    allVideos = (await ContentService.getAllVideos()) || [];
    mainVideo = await ContentService.getMainFeaturedVideo();
  } catch (e: unknown) {
    console.error("[HOME_CONTENT_LOAD_ERROR]", e);
    contentError = (e as Error).message || String(e);
  }

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
          <p className="text-neutral-600 mb-8">
            Nie znaleziono żadnych filmów. Dodaj film w panelu admina, aby go tutaj zobaczyć.
          </p>

          {(process.env.DEBUG_HOME_CONTENT === "true" || contentError) && (
            <div className="mt-8 p-6 bg-white border border-neutral-200 rounded-xl shadow-sm text-left font-sans text-sm">
              <h2 className="text-red-600 font-bold mb-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                DIAGNOSTYKA (Widoczna tylko w trybie debug)
              </h2>
              <div className="space-y-1 text-neutral-700">
                {contentError ? (
                  <p className="text-red-600 font-medium bg-red-50 p-2 rounded">BŁĄD: {contentError}</p>
                ) : (
                  <p className="text-green-600">Query zakończone sukcesem (200 OK).</p>
                )}
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-neutral-100">
                  <div>
                    <p className="text-xs uppercase text-neutral-400 font-bold">Main Video</p>
                    <p className="font-mono">{mainVideo ? "Wczytany" : "NULL"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-neutral-400 font-bold">All Videos</p>
                    <p className="font-mono">{allVideos.length}</p>
                  </div>
                </div>
                <div className="mt-6 bg-neutral-900 text-neutral-300 p-4 rounded-lg font-mono text-xs">
                  <p className="mb-2 text-neutral-500"># Spróbuj naprawić dane:</p>
                  <p className="text-blue-400">npm run content:diagnose</p>
                  <p className="text-blue-400">npm run db:fix:schema</p>
                  <p className="text-blue-400">npm run content:fix:polutek</p>
                </div>
                <p className="mt-4 text-xs text-neutral-400 italic">
                  Jeśli liczniki powyżej są równe 0, problem leży w danych (brak opublikowanych filmów lub zatwierdzonych twórców).
                </p>
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
