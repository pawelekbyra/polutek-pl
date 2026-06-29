import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateCSP } from "@/lib/utils/security";

const isPublicRoute = createRouteMatcher([
  '/',
  '/watch/(.*)',
  '/channel/(.*)',
  '/katalog',
  '/katalog2',
  '/katalog3',
  '/eksperyment1',
  '/eksperyment2',
  '/eksperyment3',
  '/eksperyment4',
  '/eksperyment5',
  '/eksperyment6',
  '/eksperyment7',
  '/eksperyment8',
  '/eksperyment9',
  '/eksperyment10',
  '/eksperyment11',
  '/eksperyment12',
  '/eksperyment13',
  '/eksperyment14',
  '/eksperyment15',
  '/eksperyment20',
  '/eksperyment21',
  '/regulamin',
  '/polityka-prywatnosci',
  '/api/webhooks(.*)',
  '/api/health',
  '/api/access(.*)',
  '/api/media-source/(.*)',
  '/api/videos/(.*)/playback-event',
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
