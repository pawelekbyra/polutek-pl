import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { createRouteMatcher } from "@/lib/auth/route-matcher";
import { SESSION_COOKIE_PREFIX } from "@/lib/auth/config";
import { generateCSP } from "@/lib/utils/security";
import { checkAdminCsrf } from "@/lib/api/csrf";
import { checkAdminRateLimit, getAdminClientIp } from "@/lib/api/admin-rate-limit";

const isPublicRoute = createRouteMatcher([
  '/',
  // Better Auth endpoints (sign-in, sign-up, OAuth callback, session, ...): they authorize themselves.
  '/api/auth(.*)',
  // Landing page of the password-reset e-mail link (the token is the credential).
  '/reset-password',
  '/pl',
  '/pl/search',
  '/pl/watch/(.*)',
  '/pl/channel/(.*)',
  '/pl/regulamin',
  '/pl/polityka-prywatnosci',
  '/pl/terms',
  '/pl/privacy-policy',
  '/en',
  '/en/search',
  '/en/watch/(.*)',
  '/en/channel/(.*)',
  '/en/terms',
  '/en/privacy-policy',
  '/en/regulamin',
  '/en/polityka-prywatnosci',
  // Bare paths are served from their /pl counterpart (see polishRewriteUrl) and pass the same gate,
  // so every public page is listed here without a prefix too. Legal documents are always public.
  '/search',
  '/watch/(.*)',
  '/channel/(.*)',
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
  // Only GET comments is public if product requires it
  '/api/comments',
  '/api/comments/(.*)/replies',
]);

const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)']);

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

  // Check if pathname is already localized or is a route that should not be locale-prefixed.
  const startsWithLocaleOrSystemRoute = /^\/(?:pl|en|admin|api|\.)(?:\/|$)/.test(pathname);
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

async function sessionRateKey(req: NextRequest): Promise<string | null> {
  const cookie = getSessionCookie(req, { cookiePrefix: SESSION_COOKIE_PREFIX });
  if (!cookie) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cookie));
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `session:${hex.slice(0, 24)}`;
}

export default async function middleware(req: NextRequest) {
  // Account mutations (nickname, avatar, language, deletion, ...) get the same cross-origin guard
  // as the admin API. Better Auth's own endpoints check the origin themselves.
  if (req.nextUrl.pathname.startsWith('/api/user/')) {
    const csrf = checkAdminCsrf(req);
    if (csrf) return NextResponse.json(csrf.body, { status: csrf.status });
  }

  // Specific GET exception for comments (if product needs public comments).
  // Mutations are protected but still flow through the shared response setup
  // below so request IDs and security headers are attached consistently.
  if (req.nextUrl.pathname === '/api/comments' && req.method !== 'GET') {
    const blocked = requireSessionCookie(req);
    if (blocked) return blocked;
  } else if (isAdminRoute(req.nextUrl.pathname)) {
    const isApiAdmin = req.nextUrl.pathname.startsWith('/api/admin');

    // CSRF is enforced here, once, for every mutating /api/admin request, so no
    // individual route can forget it (see lib/api/csrf.ts).
    if (isApiAdmin) {
      const csrf = checkAdminCsrf(req);
      if (csrf) return NextResponse.json(csrf.body, { status: csrf.status });
    }

    const blocked = requireSessionCookie(req);
    if (blocked) return blocked;

    // Rate limiting (per admin session + IP) runs after the cookie check; per-route limits
    // live in lib/api/admin-rate-limit.ts.
    if (isApiAdmin) {
      const limited = await checkAdminRateLimit({
        pathname: req.nextUrl.pathname,
        method: req.method,
        userId: await sessionRateKey(req),
        ip: getAdminClientIp(req.headers),
      });
      if (limited.limited) {
        return NextResponse.json(
          { error: 'Too many requests', message: 'Rate limit exceeded. Try again shortly.' },
          { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
        );
      }
    }
  } else if (!isPublicRoute(req.nextUrl.pathname)) {
    const blocked = requireSessionCookie(req);
    if (blocked) return blocked;
  }

  if (req.method === 'GET' && req.nextUrl.pathname === '/admin/videos') {
    const editId = req.nextUrl.searchParams.get('edit');
    if (editId) {
      const targetUrl = new URL(`/admin/videos/${encodeURIComponent(editId)}/edit`, req.url);
      return NextResponse.redirect(targetUrl);
    }
  }

  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-request-id', requestId);

  // Bare paths ("/", "/regulamin", ...) are served from their /pl counterpart. The rewrite happens
  // here, after the gates above, so a rewritten page gets the same session gate, request id and
  // security headers as every other response.
  const rewriteUrl = polishRewriteUrl(req);
  const init = { request: { headers: requestHeaders } };
  const response = rewriteUrl ? NextResponse.rewrite(rewriteUrl, init) : NextResponse.next(init);

  response.headers.set('x-request-id', requestId);
  response.headers.set('Content-Security-Policy', generateCSP());
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
