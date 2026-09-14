import { parseMediaHosts } from "@/lib/modules/media/domain/media-safety";

function getR2UploadHosts() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim();
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_VIDEO_ORIGINALS?.trim();

  return Array.from(new Set([
    accountId && bucket ? `${bucket}.${accountId}.r2.cloudflarestorage.com` : null,
    accountId ? `${accountId}.r2.cloudflarestorage.com` : null,
    '*.r2.cloudflarestorage.com',
  ].filter((host): host is string => Boolean(host))));
}

function getConfiguredAppHosts() {
  const hosts = new Set<string>();

  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (rawAppUrl) {
    try {
      hosts.add(new URL(rawAppUrl).hostname.toLowerCase().replace(/^www\./, ''));
    } catch {
      // Invalid NEXT_PUBLIC_APP_URL — fall through to the static fallbacks below
      // so a bad env value can't take the CSP allow-list down to nothing.
    }
  }

  // Static fallbacks cover both the pre- and post-rebrand production domains so
  // a Clerk custom-domain cutover (Clerk dashboard side) can't silently get CSP
  // blocked by a stale/missing NEXT_PUBLIC_APP_URL in Vercel. Keep both until the
  // polutek.pl domain alias is fully retired — see CLAUDE.md rebrand notes.
  hosts.add('polutek.pl');
  hosts.add('pawelperfect.pl');

  return Array.from(hosts);
}

export function generateCSP() {
  const clerkDomains = Array.from(new Set([
    'clerk.com',
    '*.clerk.com',
    '*.clerk.accounts.dev',
    '*.clerk.dev',
    'accounts.clerk.com',
    'clerk.accounts.dev',
    ...getConfiguredAppHosts().flatMap((host) => [`clerk.${host}`, `accounts.${host}`, host, `*.${host}`]),
  ]));

  const cloudflareStreamUploadHosts = [
    'upload.cloudflarestream.com',
  ];

  const cloudflareStreamPlaybackHosts = [
    'videodelivery.net',
    '*.videodelivery.net',
    '*.cloudflarestream.com',
  ];

  const embedFrameHosts = [
    'iframe.videodelivery.net',
    '*.videodelivery.net',
    'www.youtube.com',
    'www.youtube-nocookie.com',
    'player.vimeo.com',
  ];

  const configuredMediaHosts = [
    ...parseMediaHosts(process.env.MEDIA_BUCKET_HOST),
    ...parseMediaHosts(process.env.NEXT_PUBLIC_R2_PUBLIC_HOST),
    ...parseMediaHosts(process.env.NEXT_PUBLIC_BLOB_PUBLIC_HOST),
    ...parseMediaHosts(process.env.ALLOWED_MEDIA_HOSTS),
  ];

  const mediaHosts = Array.from(new Set([
    ...configuredMediaHosts,
    ...cloudflareStreamPlaybackHosts,
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
    ...cloudflareStreamPlaybackHosts,
    ...getR2UploadHosts(),
    'api.stripe.com',
    'fonts.googleapis.com',
    ...configuredMediaHosts,
  ])).flatMap(h => [`https://${h}`, `wss://${h}`]).join(' ');

  const scriptHosts = [
    ...clerkDomains.map(h => `https://${h}`),
    'https://cdn.jsdelivr.net',
    'https://js.stripe.com',
  ].join(' ');
  // Real, permanent CSP weakness — script-src/style-src allow 'unsafe-inline' in every
  // environment, not just development. Written as literal strings (not built via string
  // concatenation) so this stays grep-visible to future security review.
  const inlineDirective = "'unsafe-inline'";
  const evalDirective = "'unsafe-eval'";
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
