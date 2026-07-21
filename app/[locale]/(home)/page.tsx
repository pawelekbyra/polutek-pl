import { Metadata } from 'next';
import { getHomeContentCached } from '@/lib/modules/channel/application/home-content.loader';
import { APP_NAME } from '@/lib/constants';
import { getLocalizedHref, isLocale, type Locale } from '@/lib/i18n/routing';
import { getBaseUrl } from '@/lib/utils';
import { notFound } from 'next/navigation';
import HomeExperience from '@/app/components/home/HomeExperience';
import type { PublicVideoDTO } from '@/app/types/video';

export const dynamic = 'force-dynamic';

function resolveSelectedVideo(
  allVideos: PublicVideoDTO[],
  mainVideo: PublicVideoDTO | null,
  selectedVideoId?: string
): PublicVideoDTO | null {
  if (!selectedVideoId) return mainVideo;
  return allVideos.find((v) => v.id === selectedVideoId || v.slug === selectedVideoId) || mainVideo;
}

function canonicalHomeHref(locale: Locale, videoSlug?: string): string {
  const base = getLocalizedHref(locale, 'home');
  return videoSlug ? `${base}?v=${encodeURIComponent(videoSlug)}` : base;
}

// Cloudflare webhook stores duration as "M:SS"/"H:MM:SS"; VideoObject JSON-LD needs ISO 8601.
function durationToIso8601(duration?: string | null): string | undefined {
  if (!duration) return undefined;
  const parts = duration.split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return undefined;
  const [hours, minutes, seconds] =
    parts.length === 3 ? parts : parts.length === 2 ? [0, parts[0], parts[1]] : [0, 0, NaN];
  if (Number.isNaN(seconds)) return undefined;
  return `PT${hours ? `${hours}H` : ''}${minutes ? `${minutes}M` : ''}${seconds}S`;
}

export async function generateMetadata(props: { params: Promise<{ locale: string }>; searchParams: Promise<{ v?: string }> }): Promise<Metadata> {
  const [{ locale: rawLocale }, searchParams] = await Promise.all([props.params, props.searchParams]);
  if (!isLocale(rawLocale)) return { title: APP_NAME };
  const locale: Locale = rawLocale;

  const content = await getHomeContentCached();
  if (content.status !== 'ready') return { title: APP_NAME };

  const { creator, mainVideo, allVideos } = content;

  // If a specific video is selected via ?v=, use it for OG tags
  const selectedVideoId = searchParams.v;
  const selectedVideo = resolveSelectedVideo(allVideos, mainVideo, selectedVideoId);
  const baseUrl = getBaseUrl();
  const canonicalSlug = selectedVideoId ? selectedVideo?.slug ?? selectedVideoId : undefined;

  return {
    // Browser tab always reads POLUTEK.PL regardless of the selected video; the
    // per-video title is kept only for social/OG previews below.
    title: APP_NAME,
    description: selectedVideo?.title ?? creator?.bio ?? `${APP_NAME} — kanał wideo`,
    alternates: {
      canonical: `${baseUrl}${canonicalHomeHref(locale, canonicalSlug)}`,
      languages: {
        pl: `${baseUrl}${canonicalHomeHref('pl', canonicalSlug)}`,
        en: `${baseUrl}${canonicalHomeHref('en', canonicalSlug)}`,
        'x-default': `${baseUrl}${canonicalHomeHref('pl', canonicalSlug)}`,
      },
    },
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

  const content = await getHomeContentCached();
  const selectedVideo =
    content.status === 'ready' ? resolveSelectedVideo(content.allVideos, content.mainVideo, searchParams.v) : null;

  const videoJsonLd = selectedVideo
    ? {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: locale === 'en' ? selectedVideo.titleEn || selectedVideo.title : selectedVideo.title,
        description:
          (locale === 'en' ? selectedVideo.descriptionEn || selectedVideo.description : selectedVideo.description) ||
          selectedVideo.title,
        thumbnailUrl: [
          selectedVideo.thumbnailUrl.startsWith('http')
            ? selectedVideo.thumbnailUrl
            : `${getBaseUrl()}${selectedVideo.thumbnailUrl}`,
        ],
        uploadDate: selectedVideo.publishedAt ? new Date(selectedVideo.publishedAt).toISOString() : undefined,
        duration: durationToIso8601(selectedVideo.duration),
        embedUrl: `${getBaseUrl()}${canonicalHomeHref(locale, selectedVideo.slug)}`,
      }
    : null;

  return (
    <>
      {videoJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd).replace(/</g, '\\u003c') }}
        />
      ) : null}
      <HomeExperience locale={locale} videoId={searchParams.v} q={searchParams.q} />
    </>
  );
}
