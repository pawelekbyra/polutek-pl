/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'yellow-elegant-porpoise-917.mypinata.cloud',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
