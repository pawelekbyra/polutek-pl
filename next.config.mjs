import withFlowbiteReact from "flowbite-react/plugin/nextjs";

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

const nextConfig = {
  productionBrowserSourceMaps: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'yellow-elegant-porpoise-917.mypinata.cloud',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: 'www.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      ...configuredImageHosts.map((hostname) => ({
        protocol: 'https',
        hostname,
        pathname: '/**',
      })),
    ],
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
            key: 'X-XSS-Protection',
            value: '1; mode=block',
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
    ];
  },
};

export default withFlowbiteReact(nextConfig);