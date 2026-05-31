import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  '/',
  '/zrzutka',
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
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
