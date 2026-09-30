"use client";

import { useEffect, useState } from "react";
import { AuthenticateWithRedirectCallback, useAuth } from "@clerk/nextjs";
import { readReturnPath, SSO_CALLBACK_TIMEOUT_MS } from "@/lib/auth/sso-return";

// Landing page for the Google/OAuth redirect. Clerk finalizes the sign-in here and then
// navigates back to the page the user started from.
// It must never render blank: the callback component itself draws nothing, so without our
// own UI a slow or stalled handshake looked like a dead page until the user reloaded.
export default function SSOCallbackPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  // A session that already exists (handshake finished, or page reloaded) needs no callback.
  useEffect(() => {
    if (isLoaded && isSignedIn) window.location.replace(readReturnPath());
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), SSO_CALLBACK_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      {timedOut ? (
        <>
          <p className="text-sm text-muted-foreground" role="alert">
            Logowanie trwa dłużej niż zwykle. / Signing in is taking longer than usual.
          </p>
          {/* Plain <a> on purpose: this is the escape hatch for a stalled Clerk handshake, so it must do a full page load that resets client state, not a client-side <Link> navigation. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background">
            Wróć na stronę główną / Back to home
          </a>
        </>
      ) : (
        <div
          role="status"
          aria-label="Logowanie / Signing in"
          className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
        />
      )}
      {!(isLoaded && isSignedIn) && (
        <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/" />
      )}
    </div>
  );
}
