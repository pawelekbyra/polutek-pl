import { MetadataRoute } from 'next';
import { ContentService } from '@/lib/services/content.service';
import { flags } from '@/lib/feature-flags';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'test') {
    return [{
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    }];
  }

  const configuredCreator = flags.mainCreatorSlug
    ? await ContentService.getCreatorBySlug(flags.mainCreatorSlug).catch(() => null)
    : await ContentService.getConfiguredOrDefaultCreator().catch(() => null);

  // Base routes
  const routes = [
    '',
    ...(configuredCreator?.slug ? [`/channel/${configuredCreator.slug}`] : []),
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  try {
    const videos = flags.multiCreator
      ? await ContentService.getAllVideos()
      : configuredCreator?.videos || [];
    const videoRoutes = videos
      .filter(v => v.tier === 'PUBLIC')
      .map((v) => ({
        url: `${baseUrl}/?v=${v.id}`,
        lastModified: v.publishedAt ? new Date(v.publishedAt) : new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }));

    return [...routes, ...videoRoutes];
  } catch (e) {
    return routes;
  }
}
