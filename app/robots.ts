import { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/utils';
import { SITE_IS_BETA } from '@/lib/site-stage';
import { SUPPORTED_LOCALES } from '@/lib/i18n/routing';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/api/',
        // Search result pages are thin and infinite; the sitemap does not list them either.
        ...SUPPORTED_LOCALES.map((locale) => `/${locale}/search`),
        '/search',
      ],
    },
    // Beta: pages are noindex, so no sitemap is advertised (it would list URLs we ask not to index).
    // The rules above stay as they are: crawling must remain allowed or the crawler never sees the noindex.
    ...(SITE_IS_BETA ? {} : { sitemap: `${getBaseUrl()}/sitemap.xml` }),
  };
}
