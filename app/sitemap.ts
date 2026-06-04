import { MetadataRoute } from 'next';
import { ContentService } from '@/lib/services/content.service';
import { flags } from '@/lib/feature-flags';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pawelperfect.pl';

  // Base routes
  const routes = [
    '',
    ...(flags.multiCreator ? [`/channel/${flags.mainCreatorSlug}`] : []),
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  try {
    const videos = await ContentService.getAllVideos();
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
