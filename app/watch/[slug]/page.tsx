import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import type { PublicVideoDTO } from "@/app/types/video";
import WatchContent from "./WatchContent";
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
    return { title: "Nie znaleziono filmu — Polutek.pl" };
  }

  const canonicalTitle = getCanonicalVideoTitle(video);
  const canonicalDescription = getCanonicalVideoDescription(video);

  return {
    title: `${canonicalTitle} — Polutek.pl`,
    description: canonicalDescription || "Film na Polutek.pl",
    openGraph: {
      title: canonicalTitle,
      description: canonicalDescription || undefined,
      images: video.thumbnailUrl ? [{ url: video.thumbnailUrl }] : [],
      type: "video.other",
    },
  };
}

export default async function WatchPage(props: WatchPageProps) {
  const { slug } = await props.params;
  const video = await getPublishedVideoBySlug(slug);

  if (!video) notFound();

  return <WatchContent video={video} />;
}
