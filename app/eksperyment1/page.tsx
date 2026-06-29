import { logger } from "@/lib/logger";
import React from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import ChannelHome from "../components/ChannelHome";
import { PublicVideoDTO } from "@/app/types/video";
import { loadHomeContent } from "@/lib/services/home-content.loader";
import { normalizePaymentTotals } from "@/lib/modules/users/domain/payment-totals";
import { prisma } from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Metadata } from "next";
import { getOrCreateCurrentUser } from "@/lib/modules/users";
import { createAppContext } from "@/lib/modules/shared/app-context";
import ExperimentSkin from "./ExperimentSkin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eksperyment 1 — Rough UI · Polutek",
  description: "Prawdziwa strona główna Polutek w stylu papier + cienkopis.",
};

export default async function Eksperyment1Page(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  const searchParams = await props.searchParams;
  const getSafeAuth = async () => {
    try {
      return await auth();
    } catch (error) {
      logger.error("[EXPERIMENT1_AUTH_ERROR]", error);
      return { userId: null as string | null };
    }
  };

  const [authData, content, user] = await Promise.all([
    getSafeAuth(),
    loadHomeContent(),
    currentUser().catch((error) => {
      logger.error("[EXPERIMENT1_CURRENT_USER_ERROR]", error);
      return null;
    }),
  ]);

  const userId = authData.userId;
  const videoId = searchParams.v;
  const { mainVideo, allVideos } = content.status !== "error"
    ? content
    : { mainVideo: null, allVideos: [] as PublicVideoDTO[] };

  let userDb = null;
  let hasActivePatronGrant = false;
  let initialInteraction = { liked: false, disliked: false };
  let initialIsSubscribed = false;

  if (userId) {
    const targetVideo = (videoId ? allVideos.find((video) => video.id === videoId || video.slug === videoId) : null) || mainVideo;
    const targetVideoId = targetVideo?.id;
    const userCtx = createAppContext();

    await getOrCreateCurrentUser(userCtx, userId).catch((error) => {
      logger.error("[EXPERIMENT1_USER_FETCH_ERROR]", error);
    });

    const [dbResult, activeGrant, like, dislike, sub] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { paymentTotals: true },
      }).catch(() => null),
      prisma.patronGrant.findFirst({
        where: { userId, revokedAt: null },
        select: { id: true },
      }).catch(() => null),
      targetVideoId ? prisma.videoLike.findUnique({
        where: { userId_videoId: { userId, videoId: targetVideoId } },
      }).catch(() => null) : null,
      targetVideoId ? prisma.videoDislike.findUnique({
        where: { userId_videoId: { userId, videoId: targetVideoId } },
      }).catch(() => null) : null,
      targetVideo?.creatorId ? prisma.subscription.findUnique({
        where: { userId_creatorId: { userId, creatorId: targetVideo.creatorId } },
        select: { id: true },
      }).catch(() => null) : null,
    ]);

    userDb = dbResult;
    hasActivePatronGrant = Boolean(activeGrant);
    initialInteraction = { liked: !!like, disliked: !!dislike };
    initialIsSubscribed = !!sub;
  }

  const userProfile = userId ? {
    id: userId,
    email: user?.primaryEmailAddress?.emailAddress || "",
    name: userDb?.name || (user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : null),
    imageUrl: user?.imageUrl || null,
    totalPaid: (userDb && "paymentTotals" in userDb) ? normalizePaymentTotals(userDb.paymentTotals) : 0,
    isPatronDecorative: userDb?.role === "ADMIN" || hasActivePatronGrant,
    role: userDb?.role || "USER",
    initialInteraction,
    initialIsSubscribed,
  } : null;

  if (content.status === "error" || content.status === "empty") {
    const isError = content.status === "error";
    return (
      <ExperimentSkin>
        <Navbar />
        <main className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">
            {isError ? "Błąd wczytywania" : "Brak materiałów"}
          </h1>
          <p className="text-neutral-600 mb-8">
            {isError
              ? content.publicMessage
              : "Nie znaleziono żadnych filmów. Dodaj film w panelu admina, aby go tutaj zobaczyć."}
          </p>
        </main>
        <Footer />
      </ExperimentSkin>
    );
  }

  return (
    <ExperimentSkin>
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
    </ExperimentSkin>
  );
}
