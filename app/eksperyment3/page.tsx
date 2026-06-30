import { logger } from "@/lib/logger";
import React from 'react';
import { PublicVideoDTO } from '@/app/types/video';
import { loadHomeContent } from '@/lib/services/home-content.loader';
import { normalizePaymentTotals } from '@/lib/modules/users/domain/payment-totals';
import { prisma } from '@/lib/prisma';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateCurrentUser } from '@/lib/modules/users';
import { createAppContext } from '@/lib/modules/shared/app-context';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import E3Home from './E3Home';

export const dynamic = 'force-dynamic';

export default async function Eksperyment3(props: { searchParams: Promise<{ v?: string }> }) {
  const searchParams = await props.searchParams;

  const getSafeAuth = async () => {
    try { return await auth(); }
    catch (e) { logger.error("[EXP3_AUTH]", e); return { userId: null as string | null }; }
  };

  const [authData, content, user] = await Promise.all([
    getSafeAuth(),
    loadHomeContent(),
    currentUser().catch(() => null),
  ]);

  const userId = authData.userId;
  const videoId = searchParams.v;
  const { mainVideo, allVideos } = content.status !== 'error'
    ? content
    : { mainVideo: null, allVideos: [] as PublicVideoDTO[] };

  let userDb = null;
  let hasActivePatronGrant = false;
  let initialInteraction = { liked: false, disliked: false };
  let initialIsSubscribed = false;

  if (userId) {
    const targetVideo = (videoId ? allVideos.find(v => v.id === videoId || v.slug === videoId) : null) || mainVideo;
    const targetVideoId = targetVideo?.id;
    const userCtx = createAppContext();
    await getOrCreateCurrentUser(userCtx, userId).catch((e) => logger.error("[EXP3_USER]", e));

    const [dbResult, activeGrant, like, dislike, sub] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, include: { paymentTotals: true } }).catch(() => null),
      prisma.patronGrant.findFirst({ where: { userId, revokedAt: null }, select: { id: true } }).catch(() => null),
      targetVideoId ? prisma.videoLike.findUnique({ where: { userId_videoId: { userId, videoId: targetVideoId } } }).catch(() => null) : null,
      targetVideoId ? prisma.videoDislike.findUnique({ where: { userId_videoId: { userId, videoId: targetVideoId } } }).catch(() => null) : null,
      targetVideo?.creatorId ? prisma.subscription.findUnique({ where: { userId_creatorId: { userId, creatorId: targetVideo.creatorId } }, select: { id: true } }).catch(() => null) : null,
    ]);

    userDb = dbResult;
    hasActivePatronGrant = Boolean(activeGrant);
    initialInteraction = { liked: !!like, disliked: !!dislike };
    initialIsSubscribed = !!sub;
  }

  const userProfile = userId ? {
    id: userId,
    email: user?.primaryEmailAddress?.emailAddress || '',
    imageUrl: user?.imageUrl || null,
    totalPaid: (userDb && 'paymentTotals' in userDb) ? normalizePaymentTotals(userDb.paymentTotals) : 0,
    isPatronDecorative: userDb?.role === 'ADMIN' || hasActivePatronGrant,
    role: userDb?.role || 'USER',
    initialInteraction,
    initialIsSubscribed,
  } : null;

  return (
    <E3Home
      mainVideo={mainVideo}
      allVideos={allVideos}
      currentVideoId={videoId}
      userProfile={userProfile}
    />
  );
}
