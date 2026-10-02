"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { readReturnPath, SSO_CALLBACK_TIMEOUT_MS } from "@/lib/auth/sso-return";
import { useAuth } from "@/lib/auth/react";
import { useLanguage } from "@/app/components/LanguageContext";

// Landing page of the Google sign-in redirect. Better Auth has already set the session cookie by
// the time the browser gets here; this page sends the visitor back to where they started. A
// brand-new Google user then sees the first-sign-in dialog (nickname, avatar) on that page.
// It must never render blank: a stalled handshake shows a way out instead of a spinner.
function SsoCallback() {
  const { isLoaded, isSignedIn } = useAuth();
  const { language } = useLanguage();
  const searchParams = useSearchParams();
  const isPl = language === "pl";
  const [timedOut, setTimedOut] = useState(false);
  const failed = searchParams.get("error") !== null;

  useEffect(() => {
    if (isLoaded && isSignedIn) window.location.replace(readReturnPath());
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), SSO_CALLBACK_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      {failed || timedOut ? (
        <>
          <p className="text-sm text-muted-foreground" role="alert">
            {failed
              ? (isPl ? "Nie udało się zalogować przez Google. Spróbuj ponownie." : "Signing in with Google failed. Please try again.")
              : (isPl ? "Logowanie trwa dłużej niż zwykle." : "Signing in is taking longer than usual.")}
          </p>
          {/* Plain <a> on purpose: a full page load that resets client state, not a client-side <Link> navigation. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background">
            {isPl ? "Wróć na stronę główną" : "Back to home"}
          </a>
        </>
      ) : (
        <div
          role="status"
          aria-label={isPl ? "Logowanie" : "Signing in"}
          className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
        />
      )}
    </div>
  );
}

export default function SSOCallbackPage() {
  return (
    <Suspense fallback={null}>
      <SsoCallback />
    </Suspense>
  );
}
