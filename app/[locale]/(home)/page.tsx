import { Metadata } from 'next';
import { getHomeContentCached, getHomeSelectionCached } from '@/lib/modules/channel/application/home-content.loader';
import { APP_NAME, SITE_TITLE } from '@/lib/constants';
import { getExplicitLocaleHref, getLocaleAlternates, isLocale, type Locale } from '@/lib/i18n/routing';
import { getBaseUrl } from '@/lib/utils';
import { getBetaSiteText } from '@/lib/site-stage-metadata';
import { getVideoDisplayDescription, getVideoDisplayTitle } from '@/lib/video-title-overrides';
import { notFound } from 'next/navigation';
import HomeExperience from '@/app/components/home/HomeExperience';
import { shouldNoIndexVideo } from '@/lib/modules/video/domain/video-visibility';
import { getPublicChapterClips } from '@/lib/modules/video/application/get-public-video-chapters';
import { buildChannelFeedPath } from '@/lib/embed/paths';
import { buildOembedDiscoveryUrl, isOembedDiscoverable } from '@/lib/embed/discovery';

export const dynamic = 'force-dynamic';

function videoQuery(videoSlug?: string): string {
  return videoSlug ? `v=${encodeURIComponent(videoSlug)}` : '';
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
  if (!isLocale(rawLocale)) return { title: SITE_TITLE };
  const locale: Locale = rawLocale;

  const content = await getHomeContentCached();
  if (content.status !== 'ready') return { title: (await getBetaSiteText(locale))?.title ?? SITE_TITLE };

  const { creator } = content;

  // If a specific video is selected via ?v=, use it for OG tags
  const selectedVideoId = searchParams.v;
  const { selectedVideo } = await getHomeSelectionCached(selectedVideoId);
  const baseUrl = getBaseUrl();
  const canonicalSlug = selectedVideoId ? selectedVideo?.slug ?? selectedVideoId : undefined;
  const baseAlternates = getLocaleAlternates(locale, 'home', { query: videoQuery(canonicalSlug), baseUrl });
  // Feed readers find the channel's RSS here; oEmbed consumers find the endpoint for a video anyone may embed
  // (PUBLIC tier, published, not 18+, not an upcoming premiere). The oEmbed URL names this page's canonical address.
  const alternates = {
    ...baseAlternates,
    types: {
      ...(creator ? { 'application/rss+xml': `${baseUrl}${buildChannelFeedPath(creator.slug)}` } : {}),
      ...(canonicalSlug && selectedVideo?.slug === canonicalSlug && isOembedDiscoverable(selectedVideo) ? { 'application/json+oembed': buildOembedDiscoveryUrl(baseUrl, baseAlternates.canonical) } : {}),
    },
  };
  // Beta: neutral title and description everywhere (tab, search, social); the hero video's title is not used.
  const betaText = await getBetaSiteText(locale);

  // An unlisted video (link only) and an adult one (signed-in viewers only) must never be indexed: the page of
  // such a video says so, whatever the site stage is. The fallback to the hero never carries this status.
  const noIndexVideo = shouldNoIndexVideo(selectedVideo ? { status: selectedVideo.status, isAdult: selectedVideo.isAdult } : null);

  return {
    ...(noIndexVideo ? { robots: { index: false, follow: false, nocache: true } } : {}),
    // Browser tab always reads www.pawelperfect.com regardless of the selected video; the
    // per-video title is kept only for social/OG previews below.
    title: betaText?.title ?? SITE_TITLE,
    description: betaText?.description ?? selectedVideo?.title ?? creator?.bio ?? `${APP_NAME} — kanał wideo`,
    alternates,
    openGraph: {
      title: betaText?.title ?? selectedVideo?.title ?? SITE_TITLE,
      description: betaText?.description ?? selectedVideo?.title ?? creator?.bio ?? undefined,
      url: alternates.canonical,
      siteName: SITE_TITLE,
      locale: locale === 'pl' ? 'pl_PL' : 'en_US',
      images: selectedVideo?.thumbnailUrl ? [{ url: selectedVideo.thumbnailUrl }] : [],
      type: 'video.other',
    },
    twitter: {
      card: selectedVideo?.thumbnailUrl ? 'summary_large_image' : 'summary',
      title: betaText?.title ?? selectedVideo?.title ?? SITE_TITLE,
      ...(betaText ? { description: betaText.description } : {}),
      images: selectedVideo?.thumbnailUrl ? [selectedVideo.thumbnailUrl] : [],
    },
  };
}

export default async function Home(props: { params: Promise<{ locale: string }>; searchParams: Promise<{ v?: string, q?: string, t?: string, list?: string, i?: string }> }) {
  const { locale: rawLocale } = await props.params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const searchParams = await props.searchParams;

  const { selectedVideo } = await getHomeSelectionCached(searchParams.v);

  // Structured data is search-engine bait: an unlisted or adult video gets none.
  const indexable = selectedVideo && !shouldNoIndexVideo({ status: selectedVideo.status, isAdult: selectedVideo.isAdult });
  const pageUrl = `${getBaseUrl()}${getExplicitLocaleHref(locale, 'home')}`;
  // Chapters become `Clip` parts only for a PUBLIC, listed video (one extra read, and only then).
  const chapterClips = selectedVideo && indexable ? await getPublicChapterClips({ video: selectedVideo, language: locale, pageUrl }) : null;
  const videoJsonLd = selectedVideo && indexable
    ? {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: getVideoDisplayTitle(selectedVideo, locale),
        description:
          getVideoDisplayDescription(selectedVideo, locale) ||
          selectedVideo.title,
        thumbnailUrl: [
          selectedVideo.thumbnailUrl.startsWith('http')
            ? selectedVideo.thumbnailUrl
            : `${getBaseUrl()}${selectedVideo.thumbnailUrl}`,
        ],
        uploadDate: selectedVideo.publishedAt ? new Date(selectedVideo.publishedAt).toISOString() : undefined,
        duration: durationToIso8601(selectedVideo.duration),
        embedUrl: `${pageUrl}?${videoQuery(selectedVideo.slug)}`,
        ...(chapterClips ? { hasPart: chapterClips } : {}),
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
      <HomeExperience locale={locale} videoId={searchParams.v} q={searchParams.q} t={searchParams.t} list={searchParams.list} i={searchParams.i} />
    </>
  );
}
