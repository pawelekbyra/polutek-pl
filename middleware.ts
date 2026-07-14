import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { generateCSP } from "@/lib/utils/security";

const isPublicRoute = createRouteMatcher([
  '/',
  '/pl',
  '/pl/search',
  '/pl/watch/(.*)',
  '/pl/channel/(.*)',
  '/pl/regulamin',
  '/pl/polityka-prywatnosci',
  '/pl/sklep',
  '/en',
  '/en/search',
  '/en/watch/(.*)',
  '/en/channel/(.*)',
  '/en/terms',
  '/en/privacy-policy',
  '/en/shop',
  '/search',
  '/watch/(.*)',
  '/channel/(.*)',
  '/regulamin',
  '/polityka-prywatnosci',
  '/sklep',
  // PWA manifest: the middleware matcher excludes .webmanifest but not .json,
  // so /manifest.json must be explicitly public or anonymous visitors get 404.
  '/manifest.json',
  // Email unsubscribe must work without login: List-Unsubscribe headers and
  // email footer links target /unsubscribe?token=..., and the page posts the
  // signed token to the API. Both are token-authorized, not session-authorized.
  '/unsubscribe',
  '/api/subscriptions/unsubscribe',
  '/api/webhooks(.*)',
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
  '/api/comments'
]);

const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)']);

// Static root files served from /public that must never get a /pl or /en
// prefix. The matcher's static-extension exclusion skips most file types but
// not .json, so /manifest.json falls through to this rewrite check.
const LOCALE_EXEMPT_STATIC_PATHS = new Set(['/manifest.json']);

function shouldRewriteForPolish(pathname: string): boolean {
  if (LOCALE_EXEMPT_STATIC_PATHS.has(pathname)) return false;

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
    await auth.protect();
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
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
