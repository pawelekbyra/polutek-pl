import { MetadataRoute } from 'next';
import { flags } from '@/lib/feature-flags';
import { CreatorContentService as ContentService, VideoContentService } from '@/lib/services/content.service';

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

  const creator = flags.mainCreatorSlug
    ? await ContentService.getCreatorBySlug(flags.mainCreatorSlug).catch(() => null)
    : await ContentService.getConfiguredOrDefaultCreator().catch(() => null);

  const creatorRoutes = creator ? [
    {
      url: `${baseUrl}/channel/${creator.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }
  ] : [];

  const videos = flags.multiCreator
      ? await VideoContentService.getAllVideos()
      : creator?.videos || [];

  const videoRoutes = videos.map((v) => ({
    url: `${baseUrl}/?v=${v.id}`,
    lastModified: v.publishedAt ? new Date(v.publishedAt) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...routes, ...creatorRoutes, ...videoRoutes];
}
