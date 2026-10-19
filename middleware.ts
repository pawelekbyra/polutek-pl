import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { createRouteMatcher } from "@/lib/auth/route-matcher";
import { SESSION_COOKIE_PREFIX } from "@/lib/auth/config";
import { generateCSP } from "@/lib/utils/security";
import { checkAdminCsrf } from "@/lib/api/csrf";
import { isLegacyAdminApiPath, resolveLegacyAdminRedirect } from "@/lib/admin-legacy-redirects";
import { handlePathRewrite } from "@/lib/channel-handle-path";
import { getRouteLocaleFromPathname, ROUTE_LOCALE_HEADER, SUPPORTED_LOCALES, UI_ONLY_LOCALES } from "@/lib/i18n/routing";
import { resolveEmbedLanguage } from "@/lib/i18n/accept-language";
import { isChannelFeedPath, isEmbedPath } from "@/lib/embed/paths";

// The interface-only languages (de, es, ...) mirror the English public routes under their own prefix.
const UI_ONLY_PUBLIC_ROUTES = UI_ONLY_LOCALES.flatMap((locale) => [
  `/${locale}`,
  `/${locale}/search`,
  `/${locale}/photos`,
  `/${locale}/shop`,
  `/${locale}/watch/(.*)`,
  `/${locale}/channel/(.*)`,
  `/${locale}/playlist/(.*)`,
  `/${locale}/@(.*)`,
  `/${locale}/terms`,
  `/${locale}/privacy-policy`,
  `/${locale}/regulamin`,
  `/${locale}/polityka-prywatnosci`,
]);

const isPublicRoute = createRouteMatcher([
  '/',
  // Better Auth endpoints (sign-in, sign-up, OAuth callback, session, ...): they authorize themselves.
  '/api/auth(.*)',
  // Landing page of the password-reset e-mail link (the token is the credential).
  '/reset-password',
  '/pl',
  '/pl/search',
  '/pl/zdjecia',
  '/pl/sklep',
  '/pl/watch/(.*)',
  '/pl/channel/(.*)',
  '/pl/playlista/(.*)',
  '/pl/playlist/(.*)',
  '/pl/@(.*)',
  '/pl/regulamin',
  '/pl/polityka-prywatnosci',
  '/pl/terms',
  '/pl/privacy-policy',
  '/en',
  '/en/search',
  '/en/photos',
  '/en/shop',
  '/en/watch/(.*)',
  '/en/channel/(.*)',
  '/en/playlist/(.*)',
  '/en/playlista/(.*)',
  '/en/@(.*)',
  '/en/terms',
  '/en/privacy-policy',
  '/en/regulamin',
  '/en/polityka-prywatnosci',
  // Bare paths are served from their /pl counterpart (see polishRewriteUrl) and pass the same gate,
  // so every public page is listed here without a prefix too. Legal documents are always public.
  '/search',
  '/zdjecia',
  '/sklep',
  '/watch/(.*)',
  '/channel/(.*)',
  '/playlista/(.*)',
  '/playlist/(.*)',
  // Embeddable player (the only page other sites may frame, see generateCSP) and its oEmbed discovery endpoint:
  // both serve PUBLIC-tier published videos only and decide that themselves. The RSS feed is /channel/<slug>/feed.xml (above).
  '/embed/(.*)',
  '/api/oembed',
  // Public cross-channel search and its category/tag facets: visibility is decided in the query (lib/modules/video public-search).
  '/api/search',
  '/api/search/categories',
  // A channel's public address: /@handle is rewritten to its channel page below.
  '/@(.*)',
  '/regulamin',
  '/polityka-prywatnosci',
  '/terms',
  '/privacy-policy',
  // PWA manifest: the middleware matcher excludes .webmanifest but not .json,
  // so /manifest.json must be explicitly public or anonymous visitors get 404.
  '/manifest.json',
  // Crawlers fetch these at the bare root.
  '/robots.txt',
  '/sitemap.xml',
  // The Google/OAuth flow returns here right after Better Auth set the session cookie; the
  // page itself decides where to send the visitor, so it must never be gated.
  '/sso-callback',
  // Email unsubscribe must work without login: List-Unsubscribe headers and
  // email footer links target /unsubscribe?token=..., and the page posts the
  // signed token to the API. Both are token-authorized, not session-authorized.
  '/unsubscribe',
  '/api/subscriptions/unsubscribe',
  '/api/webhooks(.*)',
  // Cron calls these without a user session. Every handler authorizes itself with
  // `Authorization: Bearer $CRON_SECRET` and fails closed (401) when the secret is missing,
  // so they must reach the handler instead of being gated.
  '/api/cron/(.*)',
  // Nickname check for the sign-up and first-sign-in forms, which run before the account
  // exists (no session). Rate-limited per IP, returns only a boolean.
  '/api/users/nickname-available',
  '/api/health',
  // Anonymous analytics beacon (app/api/t/route.ts): always 204, no cookies, handed to pp-collector.
  '/api/t',
  '/api/access(.*)',
  '/api/media-source/(.*)',
  '/api/videos/(.*)/playback-event',
  // Read-only tip minimums consumed by the public DonationBox.
  '/api/payment-settings',
  // Thumbnail proxy must be publicly reachable: the route enforces its own
  // policy (published = public, drafts = admin-only) and the Next image
  // optimizer fetches it without auth cookies.
  '/api/videos/(.*)/thumbnail',
  '/api/channel/sidebar',
  // User avatars shown next to public comments; the route hides deleted accounts itself.
  '/api/avatars/(.*)',
  // Channel banners shown on public channel pages; the route serves only publicly visible channels.
  '/api/channel-banners/(.*)',
  // Only GET comments is public if product requires it
  '/api/comments',
  '/api/comments/(.*)/replies',
  ...UI_ONLY_PUBLIC_ROUTES,
]);

// Exact top-level paths that must never get a /pl or /en prefix.
// - /manifest.json, /robots.txt, /sitemap.xml: static root files served from
//   /public. The matcher's static-extension exclusion skips most file types
//   but not .json, so /manifest.json falls through to this rewrite check.
// - /sso-callback and /reset-password: top-level routes with no [locale]-scoped counterpart
//   (the Google/OAuth return page and the password-reset e-mail link target). Without this
//   exemption the rewrite sent them to /pl/..., which has no matching page and 404s.
// - /unsubscribe: the target of every e-mail unsubscribe link and List-Unsubscribe header; the page
//   lives at the top level only.
const LOCALE_EXEMPT_PATHS = new Set(['/manifest.json', '/robots.txt', '/sitemap.xml', '/sso-callback', '/reset-password', '/unsubscribe']);

function shouldRewriteForPolish(pathname: string): boolean {
  if (LOCALE_EXEMPT_PATHS.has(pathname)) return false;
  // The embeddable player and the RSS feed have no language prefix: the player negotiates its own language (below).
  if (isEmbedPath(pathname) || isChannelFeedPath(pathname)) return false;

  // Check if pathname is already localized or is a route that should not be locale-prefixed.
  const startsWithLocaleOrSystemRoute = new RegExp(`^/(?:${SUPPORTED_LOCALES.join('|')}|api|\\.)(?:/|$)`).test(pathname);
  if (startsWithLocaleOrSystemRoute) return false;

  // All other paths should be rewritten (including "/")
  return true;
}

function rewriteForPolish(pathname: string, _search: string): string {
  return pathname === "/" ? "/pl" : `/pl${pathname}`;
}

/** The /pl-prefixed URL a bare (non-prefixed) path is served from, or null when no rewrite applies. */
function polishRewriteUrl(req: NextRequest): URL | null {
  const pathname = req.nextUrl.pathname;
  if (!shouldRewriteForPolish(pathname)) return null;
  const rewriteUrl = new URL(req.nextUrl);
  rewriteUrl.pathname = rewriteForPolish(pathname, "");
  return rewriteUrl;
}

/**
 * Optimistic gate: only checks that a session cookie exists (no database call in the proxy).
 * The cookie is not proof of identity; every handler and server component validates the
 * session for real (lib/auth/server.ts, lib/api/auth.ts).
 */
function requireSessionCookie(req: NextRequest): NextResponse | null {
  if (getSessionCookie(req, { cookiePrefix: SESSION_COOKIE_PREFIX })) return null;
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const target = new URL('/', req.url);
  target.searchParams.set('signin', '1');
  target.searchParams.set('next', pathname + search);
  return NextResponse.redirect(target);
}

export default async function middleware(req: NextRequest) {
  // The old admin is retired (docs/architecture/admin-phase5.md): its pages move permanently to the
  // panel and its API no longer exists. Answered before any session gate, so a signed-out visitor
  // holding an old bookmark lands on the panel's own login instead of the public sign-in.
  const legacyTarget = resolveLegacyAdminRedirect(req.nextUrl.pathname);
  if (legacyTarget) return NextResponse.redirect(legacyTarget, 308);
  if (isLegacyAdminApiPath(req.nextUrl.pathname)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  // Account mutations (nickname, avatar, language, deletion, ...) and the Studio API (channel, videos, uploads,
  // comments) get a cross-origin guard (lib/api/csrf.ts). Better Auth's own endpoints check the origin themselves.
  if (req.nextUrl.pathname.startsWith('/api/user/') || req.nextUrl.pathname.startsWith('/api/studio/')) {
    const csrf = checkAdminCsrf(req);
    if (csrf) return NextResponse.json(csrf.body, { status: csrf.status });
  }

  // Specific GET exception for comments (if product needs public comments).
  // Mutations are protected but still flow through the shared response setup
  // below so request IDs and security headers are attached consistently.
  if (req.nextUrl.pathname === '/api/comments' && req.method !== 'GET') {
    const blocked = requireSessionCookie(req);
    if (blocked) return blocked;
  } else if (!isPublicRoute(req.nextUrl.pathname)) {
    const blocked = requireSessionCookie(req);
    if (blocked) return blocked;
  }

  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-request-id', requestId);
  // The locale written in the URL, for <html lang> (lib/i18n/server-language.ts). Set only by this
  // proxy: a value sent by the client is dropped.
  const routeLocale = getRouteLocaleFromPathname(req.nextUrl.pathname);
  const embedded = isEmbedPath(req.nextUrl.pathname);
  if (embedded) {
    // The embed names its own language from the URL and two request headers only (?lang=, CF-IPCountry, Accept-Language):
    // the root layout then never reads a cookie or a session to render it.
    requestHeaders.set(ROUTE_LOCALE_HEADER, resolveEmbedLanguage({
      langParam: req.nextUrl.searchParams.get('lang'),
      country: req.headers.get('cf-ipcountry'),
      acceptLanguage: req.headers.get('accept-language'),
    }));
  } else if (routeLocale) requestHeaders.set(ROUTE_LOCALE_HEADER, routeLocale);
  else requestHeaders.delete(ROUTE_LOCALE_HEADER);

  // Bare paths ("/", "/regulamin", ...) are served from their /pl counterpart. The rewrite happens
  // here, after the gates above, so a rewritten page gets the same session gate, request id and
  // security headers as every other response.
  const handleTarget = handlePathRewrite(req.nextUrl.pathname);
  let rewriteUrl: URL | null;
  if (handleTarget) {
    rewriteUrl = new URL(req.nextUrl);
    rewriteUrl.pathname = handleTarget;
  } else {
    rewriteUrl = polishRewriteUrl(req);
  }
  const init = { request: { headers: requestHeaders } };
  const response = rewriteUrl ? NextResponse.rewrite(rewriteUrl, init) : NextResponse.next(init);

  response.headers.set('x-request-id', requestId);
  // Framing: only the embeddable player may be framed (by any site); everything else stays frame-ancestors 'none'.
  // The decision is made inside generateCSP (the one place); next.config.mjs leaves X-Frame-Options off /embed/* to match.
  response.headers.set('Content-Security-Policy', generateCSP({ embeddable: embedded }));
  // The embed is a playback surface, never a landing page: keep it out of search indexes whatever the site stage is.
  if (embedded) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files (vtt: caption files in public/subtitles)
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp3|m4a|ogg|wav|vtt)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
