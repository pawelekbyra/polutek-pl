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

export function generateCSP() {
  // Google sign-in (redirect flow needs nothing here; One Tap loads Google's script, iframe and
  // posts back to the app). Turnstile is the sign-up/sign-in bot check.
  const googleAuthHosts = ['accounts.google.com'];
  // Google Identity Services (One Tap) injects its own stylesheet from this path (documented as required).
  const googleOneTapStyle = 'https://accounts.google.com/gsi/style';

  // Own HLS delivery (Worker on video.<domain>): manifests/segments via XHR/fetch (hls.js) and media-src.
  const selfHlsHosts = Array.from(new Set([
    'video.pawelperfect.com',
    ...parseMediaHosts(process.env.HLS_DELIVERY_BASE_URL),
  ]));

  const configuredMediaHosts = [
    ...parseMediaHosts(process.env.MEDIA_BUCKET_HOST),
    ...parseMediaHosts(process.env.NEXT_PUBLIC_R2_PUBLIC_HOST),
    ...parseMediaHosts(process.env.NEXT_PUBLIC_BLOB_PUBLIC_HOST),
    ...parseMediaHosts(process.env.ALLOWED_MEDIA_HOSTS),
  ];

  const mediaHosts = Array.from(new Set([
    ...configuredMediaHosts,
    ...selfHlsHosts,
  ])).map(h => `https://${h}`).join(' ');

  const imageHosts = Array.from(new Set([
    // Avatars of accounts that predate Better Auth were hosted by the old identity provider.
    'img.clerk.com',
    'images.unsplash.com',
    'www.dicebear.com',
    ...parseMediaHosts(process.env.ALLOWED_COMMENT_IMAGE_HOSTS),
    ...parseMediaHosts(process.env.ALLOWED_THUMBNAIL_HOSTS),
    ...parseMediaHosts(process.env.NEXT_PUBLIC_BLOB_PUBLIC_HOST),
    // Public thumbnails of published videos are served straight from the public R2 bucket.
    'thumbs.pawelperfect.com',
    ...parseMediaHosts(process.env.NEXT_PUBLIC_R2_PUBLIC_HOST),
  ])).map(h => `https://${h}`).join(' ');

  const connectHosts = Array.from(new Set([
    ...googleAuthHosts,
    ...getR2UploadHosts(),
    ...selfHlsHosts,
    'api.stripe.com',
    'fonts.googleapis.com',
    'challenges.cloudflare.com',
    ...configuredMediaHosts,
  ])).flatMap(h => [`https://${h}`, `wss://${h}`]).join(' ');

  // Better Auth's captcha plugin uses Cloudflare Turnstile on sign-up, sign-in and password
  // reset. Without this host the widget can't load and those forms stay blocked.
  const captchaHost = 'challenges.cloudflare.com';

  const scriptHosts = [
    ...googleAuthHosts.map(h => `https://${h}`),
    `https://${captchaHost}`,
    // Stripe.js and its sub-frames (hosts required by Stripe's CSP guide; 3-D Secure uses hooks.stripe.com).
    'https://js.stripe.com',
    'https://*.js.stripe.com',
  ].join(' ');
  // Real, permanent CSP weakness — script-src/style-src allow 'unsafe-inline' in every
  // environment, not just development. Written as literal strings (not built via string
  // concatenation) so this stays grep-visible to future security review.
  const inlineDirective = "'unsafe-inline'";
  const evalDirective = "'unsafe-eval'";
  const devScriptSource = process.env.NODE_ENV === 'development' ? ` ${evalDirective}` : '';
  const frameHosts = Array.from(new Set([
    ...googleAuthHosts,
    'js.stripe.com',
    '*.js.stripe.com',
    'hooks.stripe.com',
    captchaHost,
  ])).map(h => `https://${h}`).join(' ');

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' ${scriptHosts} ${inlineDirective}${devScriptSource}`,
    `script-src-elem 'self' ${scriptHosts} ${inlineDirective}`,
    `connect-src 'self' ${connectHosts}`,
    `frame-src ${frameHosts}`,
    `img-src 'self' data: blob: ${imageHosts}`,
    `style-src 'self' ${inlineDirective} https://fonts.googleapis.com ${googleOneTapStyle}`,
    `style-src-elem 'self' ${inlineDirective} https://fonts.googleapis.com ${googleOneTapStyle}`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `worker-src 'self' blob:`,
    `media-src 'self' blob: ${mediaHosts}`
  ].join('; ');
}
