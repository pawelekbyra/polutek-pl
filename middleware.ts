import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateCSP } from "@/lib/utils/security";

const isPublicRoute = createRouteMatcher([
  '/',
  '/pl',
  '/en',
  '/pl/search',
  '/en/search',
  '/pl/watch/(.*)',
  '/en/watch/(.*)',
  '/pl/channel/(.*)',
  '/en/channel/(.*)',
  '/pl/regulamin',
  '/en/terms',
  '/pl/polityka-prywatnosci',
  '/en/privacy-policy',
  '/pl/sklep',
  '/en/shop',
  '/sklep',
  '/shop',
  '/search',
  '/watch/(.*)',
  '/channel/(.*)',
  '/regulamin',
  '/polityka-prywatnosci',
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

export default clerkMiddleware(async (auth, req) => {
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
