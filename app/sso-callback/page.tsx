"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { readReturnPath, SSO_CALLBACK_TIMEOUT_MS } from "@/lib/auth/sso-return";
import { useAuth } from "@/lib/auth/react";
import { useLanguage } from "@/app/components/LanguageContext";

/**
 * Better Auth's OAuth error codes (`?error=<code>`) worth explaining; anything else gets the generic text.
 * Linking Google from the account panel ends here too (audit AUTH-09).
 */
const ERROR_MESSAGES: Record<string, { pl: string; en: string }> = {
  email_does_not_match: {
    pl: "To konto Google ma inny adres e-mail niż Twoje konto w serwisie, więc nie można go połączyć.",
    en: "This Google account has a different email address than your account here, so it can't be connected.",
  },
  account_already_linked_to_different_user: {
    pl: "To konto Google jest już połączone z innym kontem w serwisie.",
    en: "This Google account is already connected to another account here.",
  },
  unable_to_link_account: {
    pl: "Nie udało się połączyć konta Google. Spróbuj ponownie.",
    en: "Connecting the Google account failed. Please try again.",
  },
};

// Landing page of the Google sign-in (and "Connect Google") redirect. Better Auth has already set the
// session cookie by the time the browser gets here; this page sends the visitor back to where they
// started. A brand-new Google user then sees the first-sign-in dialog (nickname, avatar) on that page.
// It must never render blank: a stalled handshake shows a way out instead of a spinner, and an error
// is shown before any redirect (a signed-in user whose linking failed must see why).
function SsoCallback() {
  const { isLoaded, isSignedIn } = useAuth();
  const { language } = useLanguage();
  const searchParams = useSearchParams();
  const isPl = language === "pl";
  const [timedOut, setTimedOut] = useState(false);
  const errorCode = searchParams.get("error");
  const failed = errorCode !== null;

  useEffect(() => {
    if (!failed && isLoaded && isSignedIn) window.location.replace(readReturnPath());
  }, [failed, isLoaded, isSignedIn]);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), SSO_CALLBACK_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const known = errorCode ? ERROR_MESSAGES[errorCode] : undefined;
  const failedText = known
    ? (isPl ? known.pl : known.en)
    : (isPl ? "Nie udało się zalogować przez Google. Spróbuj ponownie." : "Signing in with Google failed. Please try again.");
  // A signed-in user (failed linking) goes back to the page they came from; everybody else to home.
  const backHref = failed && isSignedIn ? readReturnPath() : "/";

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      {failed || timedOut ? (
        <>
          <p className="text-sm text-muted-foreground" role="alert">
            {failed ? failedText : (isPl ? "Logowanie trwa dłużej niż zwykle." : "Signing in is taking longer than usual.")}
          </p>
          {/* Plain <a> on purpose: a full page load that resets client state, not a client-side <Link> navigation. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href={backHref} className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background">
            {backHref === "/" ? (isPl ? "Wróć na stronę główną" : "Back to home") : (isPl ? "Wróć" : "Go back")}
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
