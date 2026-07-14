import { Metadata } from 'next';
import { getHomeContentCached } from '@/lib/modules/channel/application/home-content.loader';
import { APP_NAME } from '@/lib/constants';
import { isLocale, type Locale } from '@/lib/i18n/routing';
import { notFound } from 'next/navigation';
import HomeExperience from '@/app/components/home/HomeExperience';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: { searchParams: Promise<{ v?: string }> }): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const content = await getHomeContentCached();
  if (content.status !== 'ready') return { title: APP_NAME };

  const { creator, mainVideo, allVideos } = content;

  // If a specific video is selected via ?v=, use it for OG tags
  const selectedVideoId = searchParams.v;
  let selectedVideo = mainVideo;
  if (selectedVideoId && allVideos) {
    selectedVideo = allVideos.find(v => v.id === selectedVideoId || v.slug === selectedVideoId) || mainVideo;
  }

  return {
    // Browser tab always reads POLUTEK.PL regardless of the selected video; the
    // per-video title is kept only for social/OG previews below.
    title: APP_NAME,
    description: selectedVideo?.title ?? creator?.bio ?? `${APP_NAME} — kanał wideo`,
    openGraph: {
      title: selectedVideo?.title ?? APP_NAME,
      description: selectedVideo?.title ?? creator?.bio ?? undefined,
      images: selectedVideo?.thumbnailUrl ? [{ url: selectedVideo.thumbnailUrl }] : [],
      type: 'video.other',
    },
  };
}

export default async function Home(props: { params: Promise<{ locale: string }>; searchParams: Promise<{ v?: string, q?: string }> }) {
  const { locale: rawLocale } = await props.params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const searchParams = await props.searchParams;

  return (
    <HomeExperience locale={locale} videoId={searchParams.v} q={searchParams.q} />
  );
}
