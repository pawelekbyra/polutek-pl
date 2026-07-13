import { logger } from "@/lib/logger";
import React from "react";
import Footer from "@/app/components/Footer";
import { PublicVideoDTO } from "@/app/types/video";
import { getHomeContentCached } from "@/lib/modules/channel/application/home-content.loader";
import { normalizePaymentTotals } from "@/lib/modules/users/domain/payment-totals";
import { prisma } from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Metadata } from "next";
import { getOrCreateCurrentUser } from "@/lib/modules/users";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { APP_NAME } from "@/lib/constants";
import { redirect } from "next/navigation";
import ChannelHome from "@/app/components/ChannelHome";
import Navbar from "@/app/components/Navbar";
import GlassNavigationBridge from "./GlassNavigationBridge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Glass — ${APP_NAME}`,
  description: "Eksperymentalna, dopracowana odsłona strony głównej w stylu premium glassmorphism.",
  robots: { index: false, follow: false },
};

export default async function GlassPage(props: {
  searchParams: Promise<{ v?: string; q?: string }>;
}) {
  const searchParams = await props.searchParams;

  const getSafeAuth = async () => {
    try {
      return await auth();
    } catch (error) {
      logger.error("[GLASS_AUTH_ERROR]", error);
      return { userId: null as string | null };
    }
  };

  const [authData, content, user] = await Promise.all([
    getSafeAuth(),
    getHomeContentCached(),
    currentUser().catch((error) => {
      logger.error("[GLASS_CURRENT_USER_ERROR]", error);
      return null;
    }),
  ]);

  const userId = authData.userId;
  const videoId = searchParams.v;
  const { mainVideo, allVideos } =
    content.status !== "error"
      ? content
      : { mainVideo: null, allVideos: [] as PublicVideoDTO[] };

  if (videoId) {
    const matchedById = allVideos.find((video) => video.id === videoId);
    if (matchedById?.slug && matchedById.slug !== videoId) {
      const canonicalParams = new URLSearchParams();
      if (searchParams.q) canonicalParams.set("q", searchParams.q);
      canonicalParams.set("v", matchedById.slug);
      redirect(`/glass?${canonicalParams.toString()}`);
    }
  }

  let userDb = null;
  let hasActivePatronGrant = false;
  let initialInteraction = { liked: false, disliked: false };
  let initialIsSubscribed = false;

  if (userId) {
    const targetVideo =
      (videoId
        ? allVideos.find((video) => video.id === videoId || video.slug === videoId)
        : null) || mainVideo;
    const targetVideoId = targetVideo?.id;

    const userContext = createAppContext();
    await getOrCreateCurrentUser(userContext, userId).catch((error) => {
      logger.error("[GLASS_USER_FETCH_ERROR]", error);
    });

    const [dbResult, activeGrant, like, dislike, subscription] = await Promise.all([
      prisma.user
        .findUnique({
          where: { id: userId },
          include: { paymentTotals: true },
        })
        .catch(() => null),
      prisma.patronGrant
        .findFirst({
          where: { userId, revokedAt: null },
          select: { id: true },
        })
        .catch(() => null),
      targetVideoId
        ? prisma.videoLike
            .findUnique({ where: { userId_videoId: { userId, videoId: targetVideoId } } })
            .catch(() => null)
        : null,
      targetVideoId
        ? prisma.videoDislike
            .findUnique({ where: { userId_videoId: { userId, videoId: targetVideoId } } })
            .catch(() => null)
        : null,
      targetVideo?.creatorId
        ? prisma.subscription
            .findUnique({
              where: { userId_creatorId: { userId, creatorId: targetVideo.creatorId } },
              select: { id: true },
            })
            .catch(() => null)
        : null,
    ]);

    userDb = dbResult;
    hasActivePatronGrant = Boolean(activeGrant);
    initialInteraction = { liked: Boolean(like), disliked: Boolean(dislike) };
    initialIsSubscribed = Boolean(subscription);
  }

  const userProfile = userId
    ? {
        id: userId,
        email: user?.primaryEmailAddress?.emailAddress || "",
        name:
          userDb?.name ||
          (user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : null),
        imageUrl: user?.imageUrl || null,
        totalPaid:
          userDb && "paymentTotals" in userDb
            ? normalizePaymentTotals(userDb.paymentTotals)
            : 0,
        isPatronDecorative: userDb?.role === "ADMIN" || hasActivePatronGrant,
        role: userDb?.role || "USER",
        initialInteraction,
        initialIsSubscribed,
      }
    : null;

  if (content.status === "error" || content.status === "empty") {
    const isError = content.status === "error";
    return (
      <div className="glass-page">
        <Navbar />
        <main className="glass-empty-state mx-auto max-w-3xl px-6 py-20 text-center">
          <div className="glass-empty-card">
            <span className="glass-empty-kicker">POLUTEK.PL / GLASS</span>
            <h1 className="font-brand mb-4 text-2xl font-bold">
              {isError ? "Błąd wczytywania" : "Brak materiałów"}
            </h1>
            <p className="mb-0 text-[var(--chan-muted)]">
              {isError
                ? content.publicMessage
                : "Nie znaleziono żadnych filmów. Dodaj film w panelu admina, aby go tutaj zobaczyć."}
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="glass-page">
      <Navbar />
      <GlassNavigationBridge>
        <main className="relative">
          <ChannelHome
            mainVideo={mainVideo}
            allVideos={allVideos}
            currentVideoId={videoId}
            userProfile={userProfile}
          />
        </main>
      </GlassNavigationBridge>
      <Footer />
    </div>
  );
}
