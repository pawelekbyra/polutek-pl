import { MetadataRoute } from 'next';
import { CreatorContentService as ContentService } from '@/lib/modules/channel/infrastructure/creator-content.service';
import { VideoContentService } from '@/lib/modules/video/infrastructure/video-content.service';
import { getLocalizedHref, type RouteKey } from '@/lib/i18n/routing';

const DEFAULT_BASE_URL = 'https://polutek.pl';
function getBaseUrl() { try { return new URL(process.env.NEXT_PUBLIC_APP_URL || DEFAULT_BASE_URL).origin; } catch { return DEFAULT_BASE_URL; } }
function localizedEntry(baseUrl: string, routeKey: RouteKey, priority: number, params: { slug?: string } = {}, lastModified = new Date()): MetadataRoute.Sitemap[number][] {
  return (["pl", "en"] as const).map((locale) => ({
    url: `${baseUrl}${getLocalizedHref(locale, routeKey, params)}`,
    lastModified,
    changeFrequency: routeKey === 'home' ? 'daily' : 'monthly',
    priority,
    alternates: { languages: { pl: `${baseUrl}${getLocalizedHref('pl', routeKey, params)}`, en: `${baseUrl}${getLocalizedHref('en', routeKey, params)}`, 'x-default': `${baseUrl}${getLocalizedHref('pl', routeKey, params)}` } },
  }));
}
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const routes: MetadataRoute.Sitemap = [
    ...localizedEntry(baseUrl, 'home', 1),
    ...localizedEntry(baseUrl, 'search', 0.5),
    ...localizedEntry(baseUrl, 'terms', 0.4),
    ...localizedEntry(baseUrl, 'privacy', 0.4),
    ...localizedEntry(baseUrl, 'shop', 0.5),
  ];
  const creator = await ContentService.getConfiguredOrDefaultCreator().catch(() => null);
  if (creator) routes.push(...localizedEntry(baseUrl, 'channel', 0.7, { slug: creator.slug }));
  const videos = await VideoContentService.getSitemapVideos().catch(() => []);
  for (const video of videos) routes.push(...localizedEntry(baseUrl, 'watch', 0.6, { slug: video.slug }, video.publishedAt ? new Date(video.publishedAt) : new Date()));
  return routes;
}

// Slugs are encoded by getLocalizedHref; legacy sitemap used encodeURIComponent(video.slug).
