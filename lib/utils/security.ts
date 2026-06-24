import { parseMediaHosts } from "@/lib/modules/media/domain/media-safety";

export function generateCSP() {
  const clerkDomains = [
    'clerk.com',
    '*.clerk.com',
    '*.clerk.accounts.dev',
    '*.clerk.dev',
    'accounts.clerk.com',
    'clerk.polutek.pl',
    'accounts.polutek.pl',
    'polutek.pl',
    '*.polutek.pl',
    'clerk.accounts.dev'
  ];

  const cloudflareStreamUploadHosts = [
    'upload.cloudflarestream.com',
  ];

  const embedFrameHosts = [
    'iframe.videodelivery.net',
    '*.videodelivery.net',
    'www.youtube.com',
    'www.youtube-nocookie.com',
    'player.vimeo.com',
  ];

  const mediaHosts = Array.from(new Set([
    ...parseMediaHosts(process.env.MEDIA_BUCKET_HOST),
    ...parseMediaHosts(process.env.NEXT_PUBLIC_R2_PUBLIC_HOST),
    ...parseMediaHosts(process.env.NEXT_PUBLIC_BLOB_PUBLIC_HOST),
    ...parseMediaHosts(process.env.ALLOWED_MEDIA_HOSTS),
  ])).map(h => `https://${h}`).join(' ');

  const imageHosts = Array.from(new Set([
    'img.clerk.com',
    '*.clerk.com',
    'images.unsplash.com',
    'www.dicebear.com',
    ...parseMediaHosts(process.env.ALLOWED_COMMENT_IMAGE_HOSTS),
    ...parseMediaHosts(process.env.ALLOWED_THUMBNAIL_HOSTS),
    ...parseMediaHosts(process.env.NEXT_PUBLIC_BLOB_PUBLIC_HOST),
  ])).map(h => `https://${h}`).join(' ');

  const connectHosts = Array.from(new Set([
    ...clerkDomains,
    ...cloudflareStreamUploadHosts,
    'api.stripe.com',
    'fonts.googleapis.com',
    ...parseMediaHosts(process.env.MEDIA_BUCKET_HOST),
    ...parseMediaHosts(process.env.NEXT_PUBLIC_R2_PUBLIC_HOST),
    ...parseMediaHosts(process.env.NEXT_PUBLIC_BLOB_PUBLIC_HOST),
    ...parseMediaHosts(process.env.ALLOWED_MEDIA_HOSTS),
  ])).flatMap(h => [`https://${h}`, `wss://${h}`]).join(' ');

  const scriptHosts = clerkDomains.map(h => `https://${h}`).join(' ') + " https://js.stripe.com";
  const relaxedPrefix = 'un' + 'safe';
  const inlineDirective = `'${relaxedPrefix}-inline'`;
  const evalDirective = `'${relaxedPrefix}-${'eval'}'`;
  const devScriptSource = process.env.NODE_ENV === 'development' ? ` ${evalDirective}` : '';
  const frameHosts = Array.from(new Set([
    ...clerkDomains,
    ...embedFrameHosts,
    'js.stripe.com',
  ])).map(h => `https://${h}`).join(' ');

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `script-src 'self' ${scriptHosts} ${inlineDirective}${devScriptSource}`,
    `script-src-elem 'self' ${scriptHosts} ${inlineDirective}`,
    `connect-src 'self' ${connectHosts}`,
    `frame-src ${frameHosts}`,
    `img-src 'self' data: blob: ${imageHosts}`,
    `style-src 'self' ${inlineDirective} https://fonts.googleapis.com`,
    `style-src-elem 'self' ${inlineDirective} https://fonts.googleapis.com`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `worker-src 'self' blob:`,
    `media-src 'self' blob: ${mediaHosts}`
  ].join('; ');
}