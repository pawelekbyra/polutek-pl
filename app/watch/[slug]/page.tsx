import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import PremiumWrapper from "@/app/components/PremiumWrapper";
import VideoPlayer from "@/app/components/VideoPlayer";
import type { PublicVideoDTO } from "@/app/types/video";
import { WatchVideoHeader } from "./WatchVideoHeader";
import { getCanonicalVideoDescription, getCanonicalVideoTitle } from "@/lib/video-title-overrides";

export const dynamic = "force-dynamic";

type WatchPageProps = {
  params: Promise<{ slug: string }>;
};

async function getPublishedVideoBySlug(slug: string): Promise<PublicVideoDTO | null> {
  const video = await prisma.video.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      OR: [
        { publishedAt: null },
        { publishedAt: { lte: new Date() } },
      ],
      creator: {
        isApproved: true,
        isPrimary: true,
      },
    },
    select: {
      id: true,
      creatorId: true,
      title: true,
      titleEn: true,
      slug: true,
      description: true,
      descriptionEn: true,
      thumbnailUrl: true,
      duration: true,
      tier: true,
      status: true,
      views: true,
      likesCount: true,
      dislikesCount: true,
      isMainFeatured: true,
      sidebarOrder: true,
      publishedAt: true,
      creator: {
        select: {
          id: true,
          name: true,
          slug: true,
          subscribersCount: true,
          user: {
            select: {
              imageUrl: true,
            },
          },
        },
      },
    },
  });

  if (!video) return null;

  return {
    id: video.id,
    creatorId: video.creatorId,
    title: video.title,
    titleEn: video.titleEn,
    slug: video.slug,
    description: video.description,
    descriptionEn: video.descriptionEn,
    thumbnailUrl: video.thumbnailUrl,
    duration: video.duration,
    tier: video.tier,
    status: video.status,
    views: video.views,
    likesCount: video.likesCount,
    dislikesCount: video.dislikesCount,
    isMainFeatured: video.isMainFeatured,
    sidebarOrder: video.sidebarOrder,
    publishedAt: video.publishedAt,
    creator: {
      id: video.creator.id,
      name: video.creator.name,
      slug: video.creator.slug,
      imageUrl: video.creator.user.imageUrl,
      subscribersCount: video.creator.subscribersCount,
    },
  };
}

export async function generateMetadata(props: WatchPageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const video = await getPublishedVideoBySlug(slug);

  if (!video) {
    return { title: "Nie znaleziono filmu — POLUTEK.PL" };
  }

  return {
    title: `${getCanonicalVideoTitle(video)} — POLUTEK.PL`,
    description: getCanonicalVideoDescription(video) || "Film na POLUTEK.PL",
    openGraph: {
      title: getCanonicalVideoTitle(video),
      description: getCanonicalVideoDescription(video) || undefined,
      images: video.thumbnailUrl ? [{ url: video.thumbnailUrl }] : [],
      type: "video.other",
    },
  };
}

export default async function WatchPage(props: WatchPageProps) {
  const { slug } = await props.params;
  const video = await getPublishedVideoBySlug(slug);

  if (!video) notFound();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <WatchVideoHeader video={video} />

        <div className="overflow-hidden rounded-2xl bg-black shadow-2xl aspect-video">
          <PremiumWrapper videoId={video.id} requiredTier={video.tier}>
            <VideoPlayer video={video} />
          </PremiumWrapper>
        </div>
      </main>
      <Footer />
    </div>
  );
}
