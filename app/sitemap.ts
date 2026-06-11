import { MetadataRoute } from 'next';
import { MainChannelService } from '@/lib/channel/main-channel.service';
import { CreatorContentService as ContentService, VideoContentService } from '@/lib/services/content.service';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://polutek.pl';

  const routes = [
    '',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  const creator = await ContentService.getConfiguredOrDefaultCreator().catch(() => null);

  const creatorRoutes = creator ? [
    {
      url: `${baseUrl}/channel/${creator.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }
  ] : [];

  const videos = await VideoContentService.getSitemapVideos();

  const videoRoutes = videos.map((v) => ({
    url: `${baseUrl}/?v=${v.id}`,
    lastModified: v.publishedAt ? new Date(v.publishedAt) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...routes, ...creatorRoutes, ...videoRoutes];
}
