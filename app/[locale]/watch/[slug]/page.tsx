import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import PremiumWrapper from "@/app/components/PremiumWrapper";
import VideoPlayer from "@/app/components/VideoPlayer";
import type { PublicVideoDTO } from "@/app/types/video";
import { WatchVideoHeader } from "@/app/watch/[slug]/WatchVideoHeader";
import { getCanonicalVideoDescription, getCanonicalVideoTitle } from "@/lib/video-title-overrides";
import { getBaseUrl } from "@/lib/utils";
import { getLocalizedHref, isLocale, type Locale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";

type WatchPageProps = {
  params: Promise<{ locale: string; slug: string }>;
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
  const { locale: rawLocale, slug } = await props.params;
  if (!isLocale(rawLocale)) return { title: "Not found — POLUTEK.PL" };
  const locale: Locale = rawLocale;
  const video = await getPublishedVideoBySlug(slug);

  if (!video) {
    return { title: locale === "pl" ? "Nie znaleziono filmu — POLUTEK.PL" : "Video not found — POLUTEK.PL" };
  }

  const primaryYouTubeAsset = await prisma.videoAsset.findFirst({
    where: { videoId: video.id, provider: "YOUTUBE", isPrimary: true },
    select: { externalVideoId: true },
  });

  const ytVideoId = primaryYouTubeAsset?.externalVideoId;
  const thumbnailUrl = video.thumbnailUrl || (ytVideoId ? `https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg` : undefined);
  const baseUrl = getBaseUrl();

  return {
    title: `${locale === "en" ? (video.titleEn || getCanonicalVideoTitle(video)) : getCanonicalVideoTitle(video)} — POLUTEK.PL`,
    alternates: {
      canonical: `${baseUrl}${getLocalizedHref(locale, "watch", { slug })}`,
      languages: {
        pl: `${baseUrl}${getLocalizedHref("pl", "watch", { slug })}`,
        en: `${baseUrl}${getLocalizedHref("en", "watch", { slug })}`,
        "x-default": `${baseUrl}${getLocalizedHref("pl", "watch", { slug })}`,
      },
    },
    description: (locale === "en" ? (video.descriptionEn || getCanonicalVideoDescription(video)) : getCanonicalVideoDescription(video)) || (locale === "pl" ? "Film na POLUTEK.PL" : "Video on POLUTEK.PL"),
    openGraph: {
      title: locale === "en" ? (video.titleEn || getCanonicalVideoTitle(video)) : getCanonicalVideoTitle(video),
      description: (locale === "en" ? (video.descriptionEn || getCanonicalVideoDescription(video)) : getCanonicalVideoDescription(video)) || undefined,
      images: thumbnailUrl ? [{ url: thumbnailUrl }] : [],
      type: "video.other",
      ...(ytVideoId && {
        videos: [{ url: `https://www.youtube-nocookie.com/embed/${ytVideoId}`, type: "text/html" }],
      }),
    },
  };
}

export default async function WatchPage(props: WatchPageProps) {
  const { locale: rawLocale, slug } = await props.params;
  if (!isLocale(rawLocale)) notFound();
  const video = await getPublishedVideoBySlug(slug);

  if (!video) notFound();

  return (
    <div className="min-h-screen bg-[var(--chan-nav)] text-[var(--chan-ink)] font-sans">
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
