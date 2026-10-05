import { logger } from "@/lib/logger";
import React from 'react';
import Footer from '@/app/components/Footer';
import { PublicVideoDTO } from '@/app/types/video';
import { getHomeContentCached } from '@/lib/modules/channel/application/home-content.loader';
import { normalizePaymentTotals } from '@/lib/modules/users/domain/payment-totals';
import { prisma } from '@/lib/prisma';
import { auth, type ServerSession } from "@/lib/auth/server";
import { toAuthSessionSnapshot } from "@/lib/auth/session-snapshot";
import { AuthSessionSeedProvider } from "@/lib/auth/react";
import { getOrCreateCurrentUser } from '@/lib/modules/users';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { getLocalizedHref, type Locale } from '@/lib/i18n/routing';
import { redirect } from 'next/navigation';
import ChannelHome from '@/app/components/ChannelHome';
import Navbar from '@/app/components/Navbar';
import { PageRevealGate } from '@/app/components/preload/PageRevealGate';
import { ChannelLayoutService } from '@/lib/modules/channel';
import {
  sidebarLayoutViewerKey,
  type SidebarLayout,
} from '@/app/components/channel/sidebar-layout-request';
import { resolvePlaybackViewerKey } from '@/app/components/preload/playback-viewer-key';
import { getHomeViewerActor, loadHeroPlaybackPlan, loadInitialComments } from './home-viewer-data';

interface HomeExperienceProps {
  locale: Locale;
  /** Selected video id/slug from ?v= (optional). */
  videoId?: string;
  /** Search query from ?q= (optional, used to preserve canonical redirects). */
  q?: string;
}

/**
 * The full public home/channel experience (Navbar + ChannelHome + Footer) plus
 * its per-request data loading. Rendered both by the localized home route and by
 * the temporary /logoN font bake-off pages, so the two stay pixel-identical apart
 * from the wordmark font.
 */
export default async function HomeExperience({ locale, videoId, q }: HomeExperienceProps) {
  // auth() and the home content are read once per request (React cache), shared with the page
  // and its metadata.
  const [session, content] = await Promise.all([
    auth().catch((e) => {
      logger.error("[HOME_AUTH_ERROR]", e);
      return { userId: null, sessionId: null, user: null } as ServerSession;
    }),
    getHomeContentCached(),
  ]);

  const userId = session.userId;
  const user = session.user;
  const sessionSnapshot = toAuthSessionSnapshot(session);
  const { mainVideo, allVideos } = content.status !== 'error'
    ? content
    : { mainVideo: null, allVideos: [] as PublicVideoDTO[] };

  // Canonical URL: a video's ?v= param should always be its slug, never its raw id. Old/
  // shared links using the id still resolve (see the id-or-slug match below), but redirect
  // to the slug form so there is exactly one canonical URL per video going forward.
  if (videoId) {
    const matchedById = allVideos.find(v => v.id === videoId);
    if (matchedById?.slug && matchedById.slug !== videoId) {
      const canonicalParams = new URLSearchParams();
      if (q) canonicalParams.set('q', q);
      canonicalParams.set('v', matchedById.slug);
      redirect(`${getLocalizedHref(locale, 'home')}?${canonicalParams.toString()}`);
    }
  }

  const selectedVideo =
    (videoId ? allVideos.find(v => v.id === videoId || v.slug === videoId) : null) || mainVideo;
  const hasContent = content.status !== 'error' && content.status !== 'empty';

  // Sidebar layout is loaded here, with the page, rather than by a client-side fetch
  // after hydration — that fetch was one of the pieces popping in on its own. The
  // JSON round-trip gives exactly the shape `/api/channel/sidebar` returns (dates as
  // strings). On failure the client falls back to fetching it itself.
  const loadSidebarLayout = async (): Promise<SidebarLayout | null> => {
    try {
      const layout = await ChannelLayoutService.getSidebarLayout(userId ?? null);
      return JSON.parse(JSON.stringify(layout)) as SidebarLayout;
    } catch (e) {
      logger.error("[HOME_SIDEBAR_LAYOUT_ERROR]", e);
      return null;
    }
  };

  // Per-viewer pieces of the first view, all in parallel and all in this one response: the
  // sidebar, the first page of comments and the hero's playback plan (see home-viewer-data).
  const viewerKey = resolvePlaybackViewerKey({ isLoaded: true, userId, sessionId: session.sessionId });
  const loadViewerPieces = async () => {
    if (!hasContent || !selectedVideo) {
      return { sidebar: null, comments: null, playback: null };
    }
    const actor = await getHomeViewerActor();
    const [sidebar, comments, playback] = await Promise.all([
      loadSidebarLayout(),
      loadInitialComments(selectedVideo.id, actor),
      loadHeroPlaybackPlan({ video: selectedVideo, actor, viewerKey }),
    ]);
    return { sidebar, comments, playback };
  };

  let userDb = null;
  let initialInteraction = { liked: false, disliked: false };
  let initialIsSubscribed = false;
  let viewerPieces: Awaited<ReturnType<typeof loadViewerPieces>>;

  if (userId) {
    const targetVideoId = selectedVideo?.id;

    // Loads (never creates) the viewer's row; fails closed for a missing or deleted account.
    const userCtx = createAppContext();
    const [, dbResult, like, dislike, sub, pieces] = await Promise.all([
      getOrCreateCurrentUser(userCtx, userId).catch((e) => {
        logger.error("[HOME_USER_FETCH_ERROR]", e);
      }),
      prisma.user.findUnique({
        where: { id: userId },
        include: { paymentTotals: true }
      }).catch(() => null),
      targetVideoId ? prisma.videoLike.findUnique({
        where: { userId_videoId: { userId, videoId: targetVideoId } }
      }).catch(() => null) : null,
      targetVideoId ? prisma.videoDislike.findUnique({
        where: { userId_videoId: { userId, videoId: targetVideoId } }
      }).catch(() => null) : null,
      selectedVideo?.creatorId ? prisma.subscription.findUnique({
        where: { userId_creatorId: { userId, creatorId: selectedVideo.creatorId } },
        select: { id: true }
      }).catch(() => null) : null,
      loadViewerPieces(),
    ]);

    userDb = dbResult;
    initialInteraction = { liked: !!like, disliked: !!dislike };
    initialIsSubscribed = !!sub;
    viewerPieces = pieces;
  } else {
    viewerPieces = await loadViewerPieces();
  }

  // One clock for every relative date in the first HTML ("3 months ago"), so the browser renders
  // the same text during hydration instead of swapping it in afterwards.
  const renderedAt = new Date().toISOString();

  const userProfile = userId ? {
    id: userId,
    email: user?.email || '',
    name: userDb?.name || user?.name || null,
    imageUrl: userDb?.imageUrl || user?.image || null,
    // Use normalized totals from UserPaymentTotal if userDb is present
    totalPaid: (userDb && 'paymentTotals' in userDb) ? normalizePaymentTotals(userDb.paymentTotals) : 0,
    role: userDb?.role || 'USER',
    initialInteraction,
    initialIsSubscribed
  } : null;

  if (content.status === 'error' || content.status === 'empty') {
    const isError = content.status === 'error';
    return (
      <AuthSessionSeedProvider snapshot={sessionSnapshot}>
      <div className="public-visual-shell min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">
            {isError ? 'Błąd wczytywania' : 'Brak materiałów'}
          </h1>
          <p className="text-[var(--chan-muted)] mb-8">
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
      </AuthSessionSeedProvider>
    );
  }

  return (
    <AuthSessionSeedProvider snapshot={sessionSnapshot}>
    <PageRevealGate waitFor={['player', 'comments']}>
      <div className="public-visual-shell min-h-screen bg-background text-foreground">
        <Navbar isHome />
        <main className="relative">
          <ChannelHome
            mainVideo={mainVideo}
            allVideos={allVideos}
            currentVideoId={videoId}
            userProfile={userProfile}
            initialSidebarLayout={viewerPieces.sidebar}
            initialSidebarViewerKey={sidebarLayoutViewerKey(userId, Boolean(userId))}
            initialComments={viewerPieces.comments}
            initialPlayback={viewerPieces.playback}
            renderedAt={renderedAt}
          />
        </main>
        <Footer />
      </div>
    </PageRevealGate>
    </AuthSessionSeedProvider>
  );
}
