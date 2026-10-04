"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "../LanguageContext";
import type { AuthNotice, AuthView } from "./AuthModalProvider";
import { TwoFactorView } from "./TwoFactorView";
import { LinkExpiredView } from "./LinkExpiredView";
import { Divider, EmailTakenActions, Field, NewHereNote, OAuthButtons, PasskeySignIn, PrimaryButton, SignInLinks } from "./AuthFormParts";
import { PasskeySignupView } from "./PasskeySignupView";
import CheckInboxView from "./CheckInboxView";
import SignUpFooter from "./SignUpFooter";
import { useCaptchaGate } from "./useCaptchaGate";
import { authClient, captchaFetchOptions } from "@/lib/auth/client";
import { useAuth } from "@/lib/auth/react";
import { authErrorMessage } from "@/lib/auth/errors";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/config";
import { clearReturnPath, peekReturnPath, rememberReturnPathIfNone, withQueryFlag } from "@/lib/auth/sso-return";

type InternalView = "sign-in" | "sign-up" | "passkey-signup" | "verify-sent" | "link-expired" | "forgot" | "forgot-sent" | "two-factor";

interface AuthModalProps {
  open: boolean;
  initialView: AuthView;
  /** Explains what happened when the modal opens after an e-mail link was clicked. */
  notice?: AuthNotice | null;
  onOpenChange: (open: boolean) => void;
}

function passwordMismatchMessage(isPl: boolean) {
  return isPl ? "Hasła nie są takie same." : "The passwords do not match.";
}

type OpError = { code?: string; message?: string; status?: number } | null | undefined;

export default function AuthModal({ open, initialView, notice = null, onOpenChange }: AuthModalProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const isPl = language === "pl";
  const { isSignedIn } = useAuth();
  // Bot check: runs in the background from the moment a form opens; the submit button never waits for it.
  const captchaGate = useCaptchaGate(isPl);

  const [view, setView] = useState<InternalView>(initialView);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailTaken, setEmailTaken] = useState<"google" | "password" | null>(null);
  const [code, setCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  // Opt-in: skip the code on this browser for a few days (off by default, shared computers).
  const [trustDevice, setTrustDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // After a wrong e-mail/password we hint at the other ways in (older accounts have no password yet).
  const [wrongCredentials, setWrongCredentials] = useState(false);

  useEffect(() => {
    setCode("");
    setConfirmPassword("");
    if (open) {
      setView(notice === "link-expired" ? "link-expired" : initialView);
      setError(null);
      setInfo(notice === "verified" ? (isPl ? "Adres e-mail potwierdzony. Zaloguj się." : "Email confirmed. Please sign in.") : null);
      setEmailTaken(null);
      setLoading(false);
      return;
    }
    // Shared computers (AUTH-04): the modal stays mounted for the whole visit, so whatever was typed is wiped
    // whenever it closes (sign-in, "×", Escape); the "Show password" toggle unmounts with the dialog content.
    setEmail("");
    setPassword("");
    setUseBackupCode(false);
    setTrustDevice(false);
    setWrongCredentials(false);
    // isPl is read only to localise the one-off notice text, not a reason to reset the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialView, notice]);

  // The confirmation link was opened in another tab or browser: the session appears here on focus,
  // so the "check your inbox" screen must not stay behind.
  useEffect(() => {
    if (open && isSignedIn && (view === "verify-sent" || view === "link-expired")) {
      onOpenChange(false);
      router.refresh();
    }
  }, [open, isSignedIn, view, onOpenChange, router]);

  const currentPath = () => (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");
  // Where the visitor ends up after signing in: the path the proxy asked for (`?next=`), else this page.
  // E-mail links (verification) bring the visitor back here with `?verified=1`, which shows a confirmation.
  const returnTo = () => withQueryFlag(peekReturnPath() ?? currentPath(), "verified", "1");

  function fail(err: OpError) {
    setWrongCredentials(err?.code === "INVALID_EMAIL_OR_PASSWORD");
    setError(authErrorMessage(err, isPl));
    setLoading(false);
    captchaGate.reset();
  }

  // Every auth call runs through here (AUTH-08): the spinner always stops, and a dropped connection
  // (the auth client throws on network errors) shows a readable message.
  async function run(task: () => Promise<void>) {
    setLoading(true);
    setError(null);
    try {
      await task();
    } catch {
      fail({ code: "NETWORK_ERROR" });
    } finally {
      setLoading(false);
    }
  }

  function finishSignedIn() {
    const next = peekReturnPath();
    clearReturnPath();
    onOpenChange(false);
    if (next && next !== currentPath()) router.push(next);
    router.refresh();
  }

  function handlePasswordSignIn(e?: React.FormEvent) {
    e?.preventDefault();
    if (!captchaGate.ready(handlePasswordSignIn)) return;
    return run(async () => {
      const { data, error: signInError } = await authClient.signIn.email({
        email,
        password,
        callbackURL: returnTo(),
        fetchOptions: captchaFetchOptions(captchaGate.token()),
      });
      if (signInError) {
        if (signInError.code === "EMAIL_NOT_VERIFIED") {
          setInfo(isPl ? "Potwierdź adres e-mail. Wysłaliśmy nowy link." : "Please verify your email. We sent a new link.");
          setView("verify-sent");
          captchaGate.reset();
          return;
        }
        return fail(signInError);
      }
      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
        setView("two-factor");
        return;
      }
      finishSignedIn();
    });
  }

  function handleSignUp(e?: React.FormEvent) {
    e?.preventDefault();
    if (password !== confirmPassword) return setError(passwordMismatchMessage(isPl));
    if (!captchaGate.ready(handleSignUp)) return;
    setEmailTaken(null);
    return run(async () => {
      // No nickname here: the server stores a placeholder name and the first-sign-in dialog asks for it.
      const { error: signUpError } = await authClient.signUp.email({
        email,
        password,
        name: email.split("@")[0] || "user",
        language: isPl ? "pl" : "en",
        callbackURL: returnTo(),
        fetchOptions: captchaFetchOptions(captchaGate.token()),
      });
      if (signUpError) {
        // Owner decision 2026-10-02: say plainly when the address already has an account (see docs).
        if (signUpError.code === "EMAIL_TAKEN" || signUpError.code === "EMAIL_TAKEN_GOOGLE") {
          setEmailTaken(signUpError.code === "EMAIL_TAKEN_GOOGLE" ? "google" : "password");
        }
        return fail(signUpError);
      }
      setInfo(null);
      setView("verify-sent");
      captchaGate.reset();
    });
  }

  function handleResend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!captchaGate.ready(handleResend)) return;
    return run(async () => {
      const { error: resendError } = await authClient.sendVerificationEmail({
        email,
        callbackURL: returnTo(),
        fetchOptions: captchaFetchOptions(captchaGate.token()),
      });
      if (resendError) return fail(resendError);
      setInfo(isPl ? "Wysłaliśmy link ponownie." : "We sent the link again.");
      captchaGate.reset();
    });
  }

  function handleForgot(e?: React.FormEvent) {
    e?.preventDefault();
    if (!captchaGate.ready(handleForgot)) return;
    return run(async () => {
      const { error: resetError } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
        fetchOptions: captchaFetchOptions(captchaGate.token()),
      });
      if (resetError) return fail(resetError);
      // Always the same answer, so the form cannot be used to find out which addresses have accounts.
      setView("forgot-sent");
      captchaGate.reset();
    });
  }

  function handleTwoFactor(e: React.FormEvent) {
    e.preventDefault();
    return run(async () => {
      const result = useBackupCode
        ? await authClient.twoFactor.verifyBackupCode({ code: code.trim() })
        : await authClient.twoFactor.verifyTotp({ code: code.trim(), trustDevice });
      if (result.error) return fail(result.error);
      finishSignedIn();
    });
  }

  function handleOAuth(provider: "google") {
    // Keep a path the proxy asked for (`next`); only fall back to the current page when none is stored.
    rememberReturnPathIfNone(currentPath());
    return run(async () => {
      const { error: socialError } = await authClient.signIn.social({
        provider,
        callbackURL: "/sso-callback",
        newUserCallbackURL: "/sso-callback",
        errorCallbackURL: "/sso-callback",
      });
      if (socialError) fail(socialError);
    });
  }

  const title = {
    "sign-in": isPl ? "Zaloguj się lub załóż konto" : "Sign in or create account",
    "sign-up": isPl ? "Załóż konto" : "Create account",
    "passkey-signup": isPl ? "Konto z kluczem dostępu" : "Account with a passkey",
    "verify-sent": isPl ? "Sprawdź skrzynkę" : "Check your inbox",
    "link-expired": isPl ? "Link wygasł" : "Link expired",
    forgot: isPl ? "Reset hasła" : "Reset password",
    "forgot-sent": isPl ? "Sprawdź skrzynkę" : "Check your inbox",
    "two-factor": isPl ? "Weryfikacja dwuetapowa" : "Two-step verification",
  }[view];

  function switchView(next: InternalView) {
    setError(null);
    setInfo(null);
    setEmailTaken(null);
    setConfirmPassword("");
    setView(next);
  }

  const revealLabels = isPl ? { show: "Pokaż", hide: "Ukryj" } : { show: "Show", hide: "Hide" };
  const captcha = captchaGate.widget;
  // A click before the token is there queues the request: same spinner as a running request.
  const busy = loading || captchaGate.waiting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!w-[calc(100vw-1rem)] !max-w-[390px] overflow-visible !rounded-none !border-0 !bg-transparent !p-0 !shadow-none !ring-0 sm:!w-[390px] sm:!max-w-[390px]"
      >
        <div className="relative isolate max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] px-5 py-6 shadow-[0_20px_50px_rgba(23,23,23,0.14)] sm:px-6 sm:py-7">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--chan-surface)] text-[18px] font-black leading-none text-[var(--chan-ink)] transition-colors hover:bg-[var(--chan-line)]"
            aria-label={isPl ? "Zamknij okno logowania" : "Close sign-in dialog"}
          >
            ×
          </button>
          <div>
            <DialogHeader className="text-center">
              <DialogTitle className="font-brand text-2xl font-bold tracking-tight text-[var(--chan-ink)]">{title}</DialogTitle>
            </DialogHeader>

            {error && (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-600">
                {error}
              </p>
            )}
            {error && wrongCredentials && view === "sign-in" && (
              <p className="mt-2 text-[12px] text-[var(--chan-muted)]">
                {isPl
                  ? "Masz starsze konto albo logowałeś się przez Google? Użyj przycisku Google albo „Nie pamiętam hasła”, żeby ustawić hasło."
                  : "Have an older account, or signed in with Google before? Use the Google button, or “Forgot password” to set a password."}
              </p>
            )}
            {error && emailTaken && (view === "sign-up" || view === "passkey-signup") && (
              <EmailTakenActions isPl={isPl} kind={emailTaken} onSignIn={() => switchView("sign-in")} onForgot={() => switchView("forgot")} />
            )}
            {info && !error && <p className="mt-3 rounded-lg bg-[var(--chan-blue-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--chan-blue)]">{info}</p>}

            {view === "sign-in" && (
              <form onSubmit={handlePasswordSignIn} className="mt-5 space-y-3.5">
                <OAuthButtons onSelect={handleOAuth} isPl={isPl} />
                <PasskeySignIn active={open && view === "sign-in"} isPl={isPl} onSignedIn={finishSignedIn} onError={setError} onNeedAccount={() => switchView("passkey-signup")} />
                <NewHereNote isPl={isPl} />
                <Divider isPl={isPl} />
                <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="username webauthn" required />
                <Field label={isPl ? "Hasło" : "Password"} type="password" value={password} onChange={setPassword} autoComplete="current-password" revealLabels={revealLabels} required />
                {captcha}
                <PrimaryButton loading={busy} label={isPl ? "Zaloguj się" : "Sign in"} />
                <SignInLinks isPl={isPl} onForgot={() => switchView("forgot")} onSignUp={() => switchView("sign-up")} />
              </form>
            )}

            {view === "passkey-signup" && (
              <PasskeySignupView
                isPl={isPl}
                email={email}
                onEmailChange={setEmail}
                callbackURL={returnTo()}
                captchaGate={captchaGate}
                onError={setError}
                onEmailTaken={setEmailTaken}
                onCreated={() => { setInfo(isPl ? "Klucz dostępu zapisany. Potwierdź e-mail linkiem z wiadomości, a zalogujemy Cię." : "Passkey saved. Confirm your email with the link we sent and you'll be signed in."); setView("verify-sent"); }}
                onBack={() => switchView("sign-in")}
              />
            )}

            {view === "sign-up" && (
              <form onSubmit={handleSignUp} className="mt-5 space-y-3.5">
                <OAuthButtons onSelect={handleOAuth} isPl={isPl} />
                <Divider isPl={isPl} />
                <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" required />
                <Field
                  label={isPl ? "Hasło (min. 10 znaków)" : "Password (min. 10 characters)"}
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  revealLabels={revealLabels}
                  required
                />
                <Field
                  label={isPl ? "Powtórz hasło" : "Repeat password"}
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  revealLabels={revealLabels}
                  required
                />
                {confirmPassword && password !== confirmPassword && (
                  <p role="alert" className="text-[12px] font-semibold text-red-600">{passwordMismatchMessage(isPl)}</p>
                )}
                {captcha}
                <PrimaryButton
                  loading={busy}
                  disabled={password.length < PASSWORD_MIN_LENGTH || password !== confirmPassword}
                  label={isPl ? "Załóż konto" : "Create account"}
                />
                <div className="pt-1 text-center text-[12px] text-[var(--chan-muted)]">
                  <button type="button" className="underline hover:text-[var(--chan-ink)]" onClick={() => switchView("sign-in")}>
                    {isPl ? "Masz już konto? Zaloguj się" : "Already have an account? Sign in"}
                  </button>
                </div>
              </form>
            )}
            {(view === "sign-in" || view === "sign-up" || view === "passkey-signup") && <SignUpFooter open={open} language={language} onSignedIn={finishSignedIn} />}

            {view === "verify-sent" && (
              <CheckInboxView
                isPl={isPl}
                kind="verify"
                email={email}
                onResend={() => void handleResend()}
                onChangeEmail={() => switchView("sign-up")}
                onBack={() => switchView("sign-in")}
                captcha={captcha}
                loading={busy}
              />
            )}

            {view === "link-expired" && (
              <LinkExpiredView
                isPl={isPl}
                email={email}
                onEmailChange={setEmail}
                onSubmit={handleResend}
                captcha={captcha}
                loading={busy}
                onBack={() => switchView("sign-in")}
              />
            )}

            {view === "forgot" && (
              <form onSubmit={handleForgot} className="mt-5 space-y-3.5">
                <p className="text-[13px] text-[var(--chan-body)]">
                  {isPl ? "Podaj e-mail — wyślemy link do ustawienia nowego hasła." : "Enter your email — we'll send a link to set a new password."}
                </p>
                <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" required />
                {captcha}
                <PrimaryButton loading={busy} label={isPl ? "Wyślij link" : "Send link"} />
                <div className="pt-1 text-center text-[12px] text-[var(--chan-muted)]">
                  <button type="button" className="underline hover:text-[var(--chan-ink)]" onClick={() => switchView("sign-in")}>
                    {isPl ? "Wróć do logowania" : "Back to sign in"}
                  </button>
                </div>
              </form>
            )}

            {view === "forgot-sent" && (
              <CheckInboxView isPl={isPl} kind="reset" email={email} onBack={() => switchView("sign-in")} />
            )}

            {view === "two-factor" && (
              <TwoFactorView
                isPl={isPl}
                code={code}
                onCodeChange={setCode}
                useBackupCode={useBackupCode}
                onToggleBackup={() => { setUseBackupCode(!useBackupCode); setCode(""); }}
                trustDevice={trustDevice}
                onTrustChange={setTrustDevice}
                loading={loading}
                onSubmit={handleTwoFactor}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
