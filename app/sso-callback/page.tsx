"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

// Landing page for the Google/OAuth redirect. Clerk finalizes the sign-in here and then
// navigates back to the page the user started from (redirectUrl passed to signIn.sso()).
export default function SSOCallbackPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
