"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { readReturnPath, SSO_CALLBACK_TIMEOUT_MS } from "@/lib/auth/sso-return";
import { useAuth } from "@/lib/auth/react";
import { useLanguage } from "@/app/components/LanguageContext";
import type { Tx } from "@/lib/i18n/ui";

/**
 * Better Auth's OAuth error codes (`?error=<code>`) worth explaining; anything else gets the generic text.
 * Linking Google from the account panel ends here too (audit AUTH-09).
 */
const ERROR_MESSAGES: Record<string, (tx: Tx) => string> = {
  email_does_not_match: (tx) => tx("To konto Google ma inny adres e-mail niż Twoje konto w serwisie, więc nie można go połączyć.", "This Google account has a different email address than your account here, so it can't be connected."),
  account_already_linked_to_different_user: (tx) => tx("To konto Google jest już połączone z innym kontem w serwisie.", "This Google account is already connected to another account here."),
  unable_to_link_account: (tx) => tx("Nie udało się połączyć konta Google. Spróbuj ponownie.", "Connecting the Google account failed. Please try again."),
};

// Landing page of the Google sign-in (and "Connect Google") redirect. Better Auth has already set the
// session cookie by the time the browser gets here; this page sends the visitor back to where they
// started. A brand-new Google user then sees the first-sign-in dialog (nickname, avatar) on that page.
// It must never render blank: a stalled handshake shows a way out instead of a spinner, and an error
// is shown before any redirect (a signed-in user whose linking failed must see why).
function SsoCallback() {
  const { isLoaded, isSignedIn } = useAuth();
  const searchParams = useSearchParams();
  const { tx } = useLanguage();
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
    ? known(tx)
    : (tx("Nie udało się zalogować przez Google. Spróbuj ponownie.", "Signing in with Google failed. Please try again."));
  // A signed-in user (failed linking) goes back to the page they came from; everybody else to home.
  const backHref = failed && isSignedIn ? readReturnPath() : "/";

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      {failed || timedOut ? (
        <>
          <p className="text-sm text-muted-foreground" role="alert">
            {failed ? failedText : (tx("Logowanie trwa dłużej niż zwykle.", "Signing in is taking longer than usual."))}
          </p>
          {/* Plain <a> on purpose: a full page load that resets client state, not a client-side <Link> navigation. */}
          <a href={backHref} className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background">
            {backHref === "/" ? (tx("Wróć na stronę główną", "Back to home")) : (tx("Wróć", "Go back"))}
          </a>
        </>
      ) : (
        <div
          role="status"
          aria-label={tx("Logowanie", "Signing in")}
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
