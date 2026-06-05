import { parseMediaHosts } from "@/lib/blob";

export function generateCSP() {
  const mediaHosts = Array.from(new Set([
    ...parseMediaHosts(process.env.MEDIA_BUCKET_HOST),
    ...parseMediaHosts(process.env.NEXT_PUBLIC_R2_PUBLIC_HOST),
    ...parseMediaHosts(process.env.NEXT_PUBLIC_BLOB_PUBLIC_HOST),
    ...parseMediaHosts(process.env.ALLOWED_MEDIA_HOSTS),
  ])).map(h => `https://${h}`).join(' ');

  const imageHosts = Array.from(new Set([
    'img.clerk.com',
    'images.unsplash.com',
    'www.dicebear.com',
    ...parseMediaHosts(process.env.ALLOWED_COMMENT_IMAGE_HOSTS),
    ...parseMediaHosts(process.env.ALLOWED_THUMBNAIL_HOSTS),
    ...parseMediaHosts(process.env.NEXT_PUBLIC_BLOB_PUBLIC_HOST),
  ])).map(h => `https://${h}`).join(' ');

  const connectHosts = Array.from(new Set([
    'clerk.com',
    '*.clerk.accounts.dev',
    'api.stripe.com',
    'fonts.googleapis.com',
    ...parseMediaHosts(process.env.MEDIA_BUCKET_HOST),
    ...parseMediaHosts(process.env.NEXT_PUBLIC_R2_PUBLIC_HOST),
    ...parseMediaHosts(process.env.NEXT_PUBLIC_BLOB_PUBLIC_HOST),
    ...parseMediaHosts(process.env.ALLOWED_MEDIA_HOSTS),
  ])).map(h => `https://${h}`).join(' ');

  return [
    "default-src 'self'",
    `script-src 'self' https://clerk.com https://*.clerk.accounts.dev https://js.stripe.com 'unsafe-inline' 'unsafe-eval'`,
    `script-src-elem 'self' https://clerk.com https://*.clerk.accounts.dev https://js.stripe.com 'unsafe-inline'`,
    `connect-src 'self' ${connectHosts}`,
    `frame-src https://js.stripe.com https://*.clerk.accounts.dev`,
    `img-src 'self' data: blob: ${imageHosts}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `worker-src 'self' blob:`,
    `media-src 'self' blob: ${mediaHosts}`
  ].join('; ');
}
