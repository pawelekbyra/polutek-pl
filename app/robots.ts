import { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/utils';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/api/',
        // Search result pages are thin and infinite; the sitemap does not list them either.
        '/pl/search',
        '/en/search',
        '/search',
      ],
    },
    sitemap: `${getBaseUrl()}/sitemap.xml`,
  };
}
