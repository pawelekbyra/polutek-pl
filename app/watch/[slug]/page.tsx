import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import PremiumWrapper from "@/app/components/PremiumWrapper";
import VideoPlayer from "@/app/components/VideoPlayer";
import type { PublicVideoDTO } from "@/app/types/video";

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
    return { title: "Nie znaleziono filmu — Polutek.pl" };
  }

  return {
    title: `${video.title} — Polutek.pl`,
    description: video.description || "Film na Polutek.pl",
    openGraph: {
      title: video.title,
      description: video.description || undefined,
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
        <div className="mb-6 space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-neutral-950">{video.title}</h1>
          {video.description ? (
            <p className="max-w-3xl text-sm text-neutral-600">{video.description}</p>
          ) : null}
        </div>

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
