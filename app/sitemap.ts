import { MetadataRoute } from 'next';
import { CreatorContentService as ContentService } from '@/lib/modules/channel/infrastructure/creator-content.service';
import { VideoContentService } from '@/lib/modules/video/infrastructure/video-content.service';
import { CONTENT_LOCALES, getLocaleAlternates, type RouteKey } from '@/lib/i18n/routing';

const DEFAULT_BASE_URL = 'https://www.pawelperfect.com';
function getBaseUrl() { try { return new URL(process.env.NEXT_PUBLIC_APP_URL || DEFAULT_BASE_URL).origin; } catch { return DEFAULT_BASE_URL; } }

/**
 * One entry per content language, at the URL that names its language (/pl/..., /en/...), the same
 * canonical/hreflang URLs the pages declare (getLocaleAlternates). Bare paths are not listed: their
 * language is negotiated per visitor.
 */
function localizedEntry(
  baseUrl: string,
  routeKey: RouteKey,
  priority: number,
  { params = {}, query = '', lastModified = new Date() }: { params?: { slug?: string }; query?: string; lastModified?: Date } = {},
): MetadataRoute.Sitemap[number][] {
  // Only the content languages (pl, en): the interface-only languages show English content and
  // canonicalise to the English URL, so listing them would only add duplicates.
  return CONTENT_LOCALES.map((locale) => {
    const { canonical, languages } = getLocaleAlternates(locale, routeKey, { params, query, baseUrl });
    return {
      url: canonical,
      lastModified,
      changeFrequency: routeKey === 'home' && !query ? 'daily' : 'monthly',
      priority,
      alternates: { languages },
    };
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const routes: MetadataRoute.Sitemap = [
    ...localizedEntry(baseUrl, 'home', 1),
    ...localizedEntry(baseUrl, 'search', 0.5),
    ...localizedEntry(baseUrl, 'terms', 0.4),
    ...localizedEntry(baseUrl, 'privacy', 0.4),
  ];
  const creator = await ContentService.getConfiguredOrDefaultCreator().catch(() => null);
  if (creator) routes.push(...localizedEntry(baseUrl, 'channel', 0.7, { params: { slug: creator.slug } }));
  const videos = await VideoContentService.getSitemapVideos().catch(() => []);
  // A video's canonical URL is the feed with ?v= (/watch/<slug> only redirects there).
  for (const video of videos) {
    routes.push(...localizedEntry(baseUrl, 'home', 0.6, {
      query: `v=${encodeURIComponent(video.slug)}`,
      lastModified: video.publishedAt ? new Date(video.publishedAt) : new Date(),
    }));
  }
  return routes;
}
