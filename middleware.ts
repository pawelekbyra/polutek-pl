import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  '/',
  '/channel/(.*)',
  '/regulamin',
  '/polityka-prywatnosci',
  '/api/webhooks(.*)',
  '/api/health',
  '/api/access(.*)',
  // Only GET comments is public if product requires it
  '/api/comments'
]);

const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // Specific GET exception for comments (if product needs public comments)
  if (req.nextUrl.pathname === '/api/comments' && req.method !== 'GET') {
    (await auth()).protect();
    return;
  }

  if (isAdminRoute(req)) {
    (await auth()).protect();
  } else if (!isPublicRoute(req)) {
    (await auth()).protect();
  }

  const response = NextResponse.next();
  response.headers.set(
    'Content-Security-Policy-Report-Only',
    "default-src 'self'; " +
    "script-src 'self' https://clerk.com https://*.clerk.accounts.dev https://js.stripe.com 'unsafe-inline' 'unsafe-eval'; " +
    "script-src-elem 'self' https://clerk.com https://*.clerk.accounts.dev https://js.stripe.com 'unsafe-inline'; " +
    "connect-src 'self' https://*.clerk.accounts.dev https://clerk.com https://api.stripe.com https://*.r2.dev https://*.vercel-storage.com https://fonts.googleapis.com; " +
    "frame-src https://js.stripe.com https://*.clerk.accounts.dev; " +
    "img-src 'self' data: blob: https://*.clerk.com https://img.clerk.com https://images.unsplash.com https://www.dicebear.com https://*.r2.dev https://*.vercel-storage.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' data: https://fonts.gstatic.com; " +
    "worker-src 'self' blob:; " +
    "media-src 'self' blob: https://*.r2.dev https://*.vercel-storage.com;"
  );
  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
