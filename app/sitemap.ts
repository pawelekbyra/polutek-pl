import { MetadataRoute } from 'next';
import { CreatorContentService as ContentService, VideoContentService } from '@/lib/services/content.service';

export const dynamic = 'force-dynamic';

const DEFAULT_BASE_URL = 'https://polutek.pl';

function getBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_BASE_URL;

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return DEFAULT_BASE_URL;
  }
}

function coreRoutes(baseUrl: string): MetadataRoute.Sitemap {
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const routes = coreRoutes(baseUrl);

  const creator = await ContentService.getConfiguredOrDefaultCreator().catch(() => null);
  const creatorRoutes = creator ? [
    {
      url: `${baseUrl}/channel/${creator.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
  ] : [];

  const videos = await VideoContentService.getSitemapVideos().catch(() => []);
  const videoRoutes = videos.map((video) => ({
    url: `${baseUrl}/?v=${encodeURIComponent(video.id)}`,
    lastModified: video.publishedAt ? new Date(video.publishedAt) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...routes, ...creatorRoutes, ...videoRoutes];
}
