/** @type {import('next').NextConfig} */
const parseHosts = (value) => {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      try {
        return new URL(entry.startsWith('http') ? entry : `https://${entry}`).hostname;
      } catch {
        return entry.replace(/^https?:\/\//, '').split('/')[0];
      }
    })
    .filter(Boolean);
};

const configuredImageHosts = Array.from(new Set([
  ...parseHosts(process.env.ALLOWED_THUMBNAIL_HOSTS),
  ...parseHosts(process.env.ALLOWED_COMMENT_IMAGE_HOSTS),
  ...parseHosts(process.env.NEXT_PUBLIC_R2_PUBLIC_HOST),
  ...parseHosts(process.env.NEXT_PUBLIC_BLOB_PUBLIC_HOST),
]));

// Beta (test version) stage: same rule as lib/site-stage.ts (default ON; NEXT_PUBLIC_SITE_BETA=false at
// build time switches it off). Every response carries `X-Robots-Tag: noindex, nofollow` while it is on.
const siteIsBeta = !['false', '0', 'no', 'off'].includes((process.env.NEXT_PUBLIC_SITE_BETA ?? '').trim().toLowerCase());

const nextConfig = {
  // Self-hosted container build (deploy/serwerek/Dockerfile) sets NEXT_OUTPUT=standalone.
  // Unset on Vercel, so the normal build is unchanged.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' } : {}),
  productionBrowserSourceMaps: false,
  // No `X-Powered-By: Next.js` on every response.
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Only hosts the app really renders through the image optimizer (audit SEC-08): every allowed host is
    // a host /_next/image will fetch and transcode on our server, so no wildcards and no demo hosts.
    // Most remote images are `unoptimized` anyway; these remain: public video thumbnails (R2) and
    // avatars of accounts that predate Better Auth (img.clerk.com, until no User.imageUrl points there).
    remotePatterns: Array.from(new Set(['thumbs.pawelperfect.com', 'img.clerk.com', ...configuredImageHosts])).map((hostname) => ({
      protocol: 'https',
      hostname,
      pathname: '/**',
    })),
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            // OWASP: the legacy XSS auditor is gone from current browsers and was itself an attack vector; 0 disables it.
            key: 'X-XSS-Protection',
            value: '0',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          }
        ],
      },
      ...(siteIsBeta
        ? [{
            // EVERY response (pages, API, /_next, images, SVGs, audio, manifest), so nothing of the site is
            // indexable, not even a file found by its direct URL (image search). Only robots.txt and
            // sitemap.xml are left out: they are the crawlers' entry points. A crawler must still be
            // allowed to fetch a page to see this, so robots.txt keeps crawling allowed.
            source: '/((?!robots\\.txt|sitemap\\.xml).*)',
            headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
          }]
        : []),
      {
        // Language-switcher flags (public/flags): static, rarely changed, so no revalidation on every open.
        source: '/flags/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
    ];
  },
};

export default nextConfig;
