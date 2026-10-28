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

export type CspOptions = {
  /**
   * The response may be framed by any site: ONLY the embeddable player page (`/embed/<slug>`, see lib/embed/paths.ts).
   * This is the one place that decides framing; every other response keeps `frame-ancestors 'none'`.
   */
  embeddable?: boolean;
};

export function generateCSP({ embeddable = false }: CspOptions = {}) {
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
    ...parseMediaHosts(process.env.ALLOWED_MEDIA_HOSTS),
  ];

  const mediaHosts = Array.from(new Set([
    ...configuredMediaHosts,
    ...selfHlsHosts,
  ])).map(h => `https://${h}`).join(' ');

  const imageHosts = Array.from(new Set([
    // Avatars of accounts that predate Better Auth were hosted by the old identity provider. Remove once
    // no User.imageUrl points there any more (check: docs/architecture/auth-better-auth.md, "CSP").
    'img.clerk.com',
    ...parseMediaHosts(process.env.ALLOWED_COMMENT_IMAGE_HOSTS),
    ...parseMediaHosts(process.env.ALLOWED_THUMBNAIL_HOSTS),
    // Public thumbnails of published videos are served straight from the public R2 bucket.
    'thumbs.pawelperfect.com',
    ...parseMediaHosts(process.env.NEXT_PUBLIC_R2_PUBLIC_HOST),
  ])).map(h => `https://${h}`).join(' ');

  const connectHosts = Array.from(new Set([
    ...googleAuthHosts,
    ...getR2UploadHosts(),
    ...selfHlsHosts,
    'api.stripe.com',
    'challenges.cloudflare.com',
    ...configuredMediaHosts,
    // No WebSocket hosts: nothing in the app opens a socket to another origin ("self" covers same-origin ws/wss).
  ])).map(h => `https://${h}`).join(' ');

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
  // Known CSP weakness — script-src/style-src allow 'unsafe-inline' in every environment. Written
  // as literal strings so it stays grep-visible to security review. A nonce + 'strict-dynamic' policy
  // would remove it, but Next.js can only inject nonces into dynamically rendered pages (every static
  // page and the prerendered shell would have to become per-request renders) and every third-party
  // loader (Stripe.js, Google Identity, Turnstile) would have to be re-tested under strict-dynamic.
  // Decision 2026-10-03 (audit SEC-06): keep it until that migration is planned on its own; see
  // docs/architecture/auth-better-auth.md "CSP".
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
    embeddable ? "frame-ancestors *" : "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' ${scriptHosts} ${inlineDirective}${devScriptSource}`,
    `script-src-elem 'self' ${scriptHosts} ${inlineDirective}`,
    `connect-src 'self' ${connectHosts}`,
    `frame-src ${frameHosts}`,
    `img-src 'self' data: blob: ${imageHosts}`,
    // Fonts are self-hosted (geist package, app/fonts); no Google Fonts.
    `style-src 'self' ${inlineDirective} ${googleOneTapStyle}`,
    `style-src-elem 'self' ${inlineDirective} ${googleOneTapStyle}`,
    `font-src 'self' data:`,
    `worker-src 'self' blob:`,
    `media-src 'self' blob: ${mediaHosts}`,
    ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}
