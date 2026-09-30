"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth, useSignIn, useSignUp } from "@clerk/nextjs";
import { readReturnPath, SSO_CALLBACK_TIMEOUT_MS } from "@/lib/auth/sso-return";
import { usernameFromNickname } from "@/lib/auth/generate-username";
import { checkNicknameAvailability, nicknameCheckMessage, nicknameProblemMessage, validateNickname } from "@/lib/auth/nickname";
import { useLanguage } from "@/app/components/LanguageContext";

// Landing page for the Google/OAuth redirect. Clerk finalizes the sign-in here and then
// navigates back to the page the user started from.
// It must never render blank: a slow or stalled handshake used to look like a dead page until
// the user reloaded.
function describeError(error: unknown): string {
  const e = error as { code?: string; message?: string; longMessage?: string } | null;
  return [e?.code, e?.longMessage || e?.message].filter(Boolean).join(": ") || "unknown error";
}

export default function SSOCallbackPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  // The language the visitor had picked on the site: this page, the new account and its emails use it.
  const { language } = useLanguage();
  const isPl = language === "pl";
  const [timedOut, setTimedOut] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [captchaShown, setCaptchaShown] = useState(false);
  const captchaRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  // First sign-in of a new Google user: we ask only for a nickname before finishing. It becomes
  // the Clerk first name (last name cleared), so it is the name shown everywhere on the site;
  // the username Clerk requires is derived from it and never shown.
  const [profileStep, setProfileStep] = useState(false);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);

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
        if (error) setProblem(describeError(error));
        else window.location.replace(readReturnPath());
      } else if (signIn.isTransferable) {
        started.current = true;
        const { error: createError } = await signUp.create({ transfer: true });
        if (createError) return setProblem(describeError(createError));
        // Clerk requires a username for new accounts and Google doesn't provide one: show the
        // first-sign-in screen where the new user picks a nickname.
        if (signUp.status === "missing_requirements" && signUp.missingFields.includes("username")) {
          setProfileStep(true);
          return;
        }
        if (signUp.status === "complete") {
          const { error } = await signUp.finalize();
          if (error) setProblem(describeError(error));
          else window.location.replace(readReturnPath());
        } else {
          setProblem(`sign-up: ${signUp.status}; missing: ${signUp.missingFields.join(",")}`);
        }
      }
    };
    void finish();
  }, [isLoaded, isSignedIn, signIn, signUp]);

  async function submitProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    const validation = validateNickname(nickname);
    if (!validation.ok) return setProblem(nicknameProblemMessage(validation.reason, isPl));
    setSaving(true);
    setProblem(null);
    const check = await checkNicknameAvailability(validation.value);
    if (!check.available) {
      setSaving(false);
      return setProblem(nicknameCheckMessage(check.reason, isPl));
    }
    const { error: updateError } = await signUp.update({
      username: usernameFromNickname(validation.value),
      firstName: validation.value,
      lastName: "",
      unsafeMetadata: { ...(signUp.unsafeMetadata ?? {}), language },
    });
    if (updateError) {
      setSaving(false);
      return setProblem(describeError(updateError));
    }
    if (signUp.status !== "complete") {
      setSaving(false);
      return setProblem(`sign-up: ${signUp.status}; missing: ${signUp.missingFields.join(",")}`);
    }
    const { error } = await signUp.finalize();
    if (error) {
      setSaving(false);
      return setProblem(describeError(error));
    }
    window.location.replace(readReturnPath());
  }

  // When Clerk shows its bot check, tell the visitor what to do instead of "taking longer".
  useEffect(() => {
    const el = captchaRef.current;
    if (!el) return;
    const sync = () => setCaptchaShown(el.childElementCount > 0);
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(el, { childList: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), SSO_CALLBACK_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      {/* Clerk's bot protection needs this element to render its challenge when the transfer creates the account. */}
      <div id="clerk-captcha" ref={captchaRef} />
      {profileStep ? (
        <form onSubmit={submitProfile} className="w-full max-w-sm space-y-4 rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] px-6 py-7 text-left shadow-[0_20px_50px_rgba(23,23,23,0.10)]">
          <div>
            <h1 className="text-lg font-bold text-[var(--chan-ink)]">{isPl ? "Witaj!" : "Welcome!"}</h1>
            <p className="mt-1 text-[13px] text-[var(--chan-muted)]">
              {isPl ? "Wybierz pseudonim. To nazwa widoczna na stronie, np. przy Twoich komentarzach." : "Choose a nickname. It is the name shown on the site, e.g. with your comments."}
            </p>
          </div>
          <label className="block text-[12px] font-semibold text-[var(--chan-ink)]">
            {isPl ? "Pseudonim" : "Nickname"}
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoComplete="nickname"
              autoFocus
              required
              className="mt-1 block w-full rounded-lg border border-[var(--chan-line)] bg-background px-3 py-2 text-sm font-normal"
            />
          </label>
          {problem && <p role="alert" className="text-xs text-red-600">{problem}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-60"
          >
            {saving ? (isPl ? "Zapisuję…" : "Saving…") : isPl ? "Zapisz i wejdź" : "Save and continue"}
          </button>
        </form>
      ) : timedOut ? (
        <>
          <p className="text-sm text-muted-foreground" role="alert">
            {captchaShown
              ? (isPl ? "Potwierdź powyżej, że jesteś człowiekiem, aby dokończyć logowanie." : "Confirm above that you are human to finish signing in.")
              : (isPl ? "Logowanie trwa dłużej niż zwykle." : "Signing in is taking longer than usual.")}
          </p>
          {problem && <p className="max-w-sm break-words text-xs text-muted-foreground/70">{problem}</p>}
          {/* Plain <a> on purpose: this is the escape hatch for a stalled Clerk handshake, so it must do a full page load that resets client state, not a client-side <Link> navigation. */}
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
