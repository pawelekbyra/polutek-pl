"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth, useSignIn, useSignUp } from "@clerk/nextjs";
import { readReturnPath, SSO_CALLBACK_TIMEOUT_MS } from "@/lib/auth/sso-return";
import { generateUsername } from "@/lib/auth/generate-username";

// Landing page for the Google/OAuth redirect. Clerk finalizes the sign-in here and then
// navigates back to the page the user started from.
// It must never render blank: a slow or stalled handshake used to look like a dead page until
// the user reloaded.
export default function SSOCallbackPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [timedOut, setTimedOut] = useState(false);
  const started = useRef(false);

  // A session that already exists (handshake finished, or page reloaded) needs no callback.
  useEffect(() => {
    if (isLoaded && isSignedIn) window.location.replace(readReturnPath());
  }, [isLoaded, isSignedIn]);

  // The sign-in was started with the signals API (`signIn.sso`), so it has to be finished with
  // it too. A returning user has a complete sign-in; a brand-new Google user comes back as a
  // "transferable" sign-in that must be turned into a sign-up, otherwise no account is created.
  useEffect(() => {
    if (!isLoaded || isSignedIn || !signIn || !signUp || started.current) return;
    const finish = async () => {
      if (signIn.status === "complete") {
        started.current = true;
        const { error } = await signIn.finalize();
        if (!error) window.location.replace(readReturnPath());
      } else if (signIn.isTransferable) {
        started.current = true;
        const { error: createError } = await signUp.create({ transfer: true });
        if (createError) return;
        // Clerk requires a username for new accounts; Google doesn't provide one, so add it here.
        if (signUp.status === "missing_requirements" && signUp.missingFields.includes("username")) {
          const { error: updateError } = await signUp.update({ username: generateUsername(signUp.emailAddress) });
          if (updateError) return;
        }
        if (signUp.status === "complete") {
          const { error } = await signUp.finalize();
          if (!error) window.location.replace(readReturnPath());
        }
      }
    };
    void finish();
  }, [isLoaded, isSignedIn, signIn, signUp]);

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
    </div>
  );
}
