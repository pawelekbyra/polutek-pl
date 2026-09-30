import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { generateCSP } from "@/lib/utils/security";
import { checkAdminCsrf } from "@/lib/api/csrf";
import { checkAdminRateLimit, getAdminClientIp } from "@/lib/api/admin-rate-limit";
import { isHealthTokenAuthorized } from "@/lib/api/health-token";

const isPublicRoute = createRouteMatcher([
  '/',
  '/pl',
  '/pl/search',
  '/pl/watch/(.*)',
  '/pl/channel/(.*)',
  '/pl/regulamin',
  '/pl/polityka-prywatnosci',
  '/en',
  '/en/search',
  '/en/watch/(.*)',
  '/en/channel/(.*)',
  '/en/terms',
  '/en/privacy-policy',
  '/search',
  '/watch/(.*)',
  '/channel/(.*)',
  '/regulamin',
  '/polityka-prywatnosci',
  // PWA manifest: the middleware matcher excludes .webmanifest but not .json,
  // so /manifest.json must be explicitly public or anonymous visitors get 404.
  '/manifest.json',
  // Crawlers fetch these at the bare root; without an explicit public entry
  // they'd hit auth.protect() once locale-rewrite is skipped (see
  // LOCALE_EXEMPT_STATIC_PATHS), which previously made bots get 404s.
  '/robots.txt',
  '/sitemap.xml',
  // Google/OAuth redirect lands here mid-handshake, before the session is fully
  // established — auth.protect() gating this route bounces the visitor back to
  // sign-in instead of letting AuthenticateWithRedirectCallback finish the flow.
  // Most visible on mobile browsers with strict cross-site cookie policies
  // (e.g. iOS Safari ITP), which are less forgiving of an interrupted redirect
  // chain than desktop browsers with an existing Clerk cookie already in place.
  '/sso-callback',
  // Email unsubscribe must work without login: List-Unsubscribe headers and
  // email footer links target /unsubscribe?token=..., and the page posts the
  // signed token to the API. Both are token-authorized, not session-authorized.
  '/unsubscribe',
  '/api/subscriptions/unsubscribe',
  '/api/webhooks(.*)',
  // Vercel Cron calls these without a Clerk session. Every handler authorizes
  // itself with `Authorization: Bearer $CRON_SECRET` and fails closed (401) when
  // the secret is missing, so they must reach the handler instead of auth.protect().
  '/api/cron/(.*)',
  // Nickname check for the first-sign-in form on /sso-callback, which runs before the
  // sign-up is finalized (no session yet). Rate-limited per IP, returns only a boolean.
  '/api/users/nickname-available',
  '/api/health',
  '/api/__version',
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
  // Only GET comments is public if product requires it
  '/api/comments',
]);

const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)']);

// Break-glass diagnostics: this one route must stay reachable even when Clerk
// itself is broken (its whole purpose is diagnosing that), so it can't be
// gated behind Clerk's auth.protect() like every other /api/admin route. The
// route handler re-checks the same token itself — this only decides whether
// middleware lets the request through to it.
const CLERK_HEALTH_ROUTE = '/api/admin/health/clerk';

// Exact top-level paths that must never get a /pl or /en prefix.
// - /manifest.json, /robots.txt, /sitemap.xml: static root files served from
//   /public. The matcher's static-extension exclusion skips most file types
//   but not .json, so /manifest.json falls through to this rewrite check.
// - /sso-callback: the Google/OAuth redirect target (see AuthModal.tsx's
//   redirectCallbackUrl and app/sso-callback/page.tsx, a top-level route with
//   no [locale]-scoped counterpart). Without this exemption the rewrite sent
//   it to /pl/sso-callback, which has no matching page and 404s, breaking
//   OAuth sign-in entirely — most visible on mobile, where users are less
//   likely to already have an existing session from a prior desktop visit
//   masking the failure.
const LOCALE_EXEMPT_PATHS = new Set(['/manifest.json', '/robots.txt', '/sitemap.xml', '/sso-callback']);

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

function clerkMiddlewareWrapper(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Rewrite non-prefixed Polish routes to localized versions
  if (shouldRewriteForPolish(pathname)) {
    const rewriteUrl = new URL(req.nextUrl);
    rewriteUrl.pathname = rewriteForPolish(pathname, "");
    return NextResponse.rewrite(rewriteUrl);
  }

  return null;
}

export default clerkMiddleware(async (auth, req) => {
  // Handle Polish URL rewriting (non-prefixed to /pl-prefixed)
  const rewriteResponse = clerkMiddlewareWrapper(req);
  if (rewriteResponse) {
    return rewriteResponse;
  }

  // Specific GET exception for comments (if product needs public comments).
  // Mutations are protected but still flow through the shared response setup
  // below so request IDs and security headers are attached consistently.
  if (req.nextUrl.pathname === '/api/comments' && req.method !== 'GET') {
    await auth.protect();
  } else if (isAdminRoute(req)) {
    const isApiAdmin = req.nextUrl.pathname.startsWith('/api/admin');

    // CSRF is enforced here, once, for every mutating /api/admin request, so no
    // individual route can forget it (see lib/api/csrf.ts).
    if (isApiAdmin) {
      const csrf = checkAdminCsrf(req);
      if (csrf) return NextResponse.json(csrf.body, { status: csrf.status });
    }

    const isClerkHealthBreakGlass = req.nextUrl.pathname === CLERK_HEALTH_ROUTE && isHealthTokenAuthorized(req);
    if (!isClerkHealthBreakGlass) {
      await auth.protect();
    }

    // Rate limiting (per admin user + IP) runs after auth so the user id is
    // known; per-route limits live in lib/api/admin-rate-limit.ts.
    if (isApiAdmin) {
      const { userId } = await auth();
      const limited = await checkAdminRateLimit({
        pathname: req.nextUrl.pathname,
        method: req.method,
        userId: userId ?? null,
        ip: getAdminClientIp(req.headers),
      });
      if (limited.limited) {
        return NextResponse.json(
          { error: 'Too many requests', message: 'Rate limit exceeded. Try again shortly.' },
          { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
        );
      }
    }
  } else if (!isPublicRoute(req)) {
    await auth.protect();
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

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('x-request-id', requestId);
  response.headers.set('Content-Security-Policy', generateCSP());
  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp3|m4a|ogg|wav)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
