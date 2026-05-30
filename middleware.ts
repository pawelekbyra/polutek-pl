import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ADMIN_EMAIL } from "@/lib/constants";

const isPublicRoute = createRouteMatcher(['/', '/zrzutka', '/api/webhooks(.*)', '/api/access(.*)', '/api/comments(.*)', '/api/subscriptions(.*)', '/api/checkout(.*)', '/channel/(.*)', '/regulamin', '/polityka-prywatnosci']);
const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) {
    const { sessionClaims } = await auth();
    const email = (sessionClaims as any)?.primaryEmailAddress || (sessionClaims as any)?.email;

    if (!ADMIN_EMAIL || email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      // Redirect non-admins trying to access admin routes to home
      const url = new URL('/', req.url);
      return NextResponse.redirect(url);
    }

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
