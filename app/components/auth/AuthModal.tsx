"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "../LanguageContext";
import type { AuthView } from "./AuthModalProvider";
import { Divider, Field, OAuthButtons, PrimaryButton } from "./AuthFormParts";
import { TurnstileWidget, useCaptchaRequired, type CaptchaState, type TurnstileHandle } from "./TurnstileWidget";
import { authClient, captchaFetchOptions } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/config";
import { rememberReturnPath } from "@/lib/auth/sso-return";

type InternalView = "sign-in" | "sign-up" | "verify-sent" | "forgot" | "forgot-sent" | "two-factor";

interface AuthModalProps {
  open: boolean;
  initialView: AuthView;
  onOpenChange: (open: boolean) => void;
}

function passwordMismatchMessage(isPl: boolean) {
  return isPl ? "Hasła nie są takie same." : "The passwords do not match.";
}

type OpError = { code?: string; message?: string; status?: number } | null | undefined;

export default function AuthModal({ open, initialView, onOpenChange }: AuthModalProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const isPl = language === "pl";
  const captchaRequired = useCaptchaRequired();
  const captchaRef = useRef<TurnstileHandle>(null);

  const [view, setView] = useState<InternalView>(initialView);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailTaken, setEmailTaken] = useState<"google" | "password" | null>(null);
  const [code, setCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaState, setCaptchaState] = useState<CaptchaState>("checking");

  useEffect(() => {
    if (open) {
      setView(initialView);
      setError(null);
      setInfo(null);
      setCode("");
      setConfirmPassword("");
      setEmailTaken(null);
      setLoading(false);
    }
  }, [open, initialView]);

  const captchaReady = !captchaRequired || Boolean(captchaToken);
  const returnTo = () => (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");

  function fail(err: OpError) {
    setError(authErrorMessage(err, isPl));
    setLoading(false);
    captchaRef.current?.reset();
  }

  function finishSignedIn() {
    setLoading(false);
    onOpenChange(false);
    router.refresh();
  }

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error: signInError } = await authClient.signIn.email({
      email,
      password,
      fetchOptions: captchaFetchOptions(captchaToken),
    });
    if (signInError) {
      if (signInError.code === "EMAIL_NOT_VERIFIED") {
        setInfo(isPl ? "Potwierdź adres e-mail. Wysłaliśmy nowy link." : "Please verify your email. We sent a new link.");
        setView("verify-sent");
        setLoading(false);
        captchaRef.current?.reset();
        return;
      }
      return fail(signInError);
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setView("two-factor");
      setLoading(false);
      return;
    }
    finishSignedIn();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) return setError(passwordMismatchMessage(isPl));
    setLoading(true);
    setError(null);
    setEmailTaken(null);
    // No nickname here: the server stores a placeholder name and the first-sign-in dialog asks for it.
    const { error: signUpError } = await authClient.signUp.email({
      email,
      password,
      name: email.split("@")[0] || "user",
      language: isPl ? "pl" : "en",
      callbackURL: returnTo(),
      fetchOptions: captchaFetchOptions(captchaToken),
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
    setLoading(false);
    captchaRef.current?.reset();
  }

  async function handleResend() {
    setLoading(true);
    setError(null);
    const { error: resendError } = await authClient.sendVerificationEmail({
      email,
      callbackURL: returnTo(),
      fetchOptions: captchaFetchOptions(captchaToken),
    });
    if (resendError) return fail(resendError);
    setInfo(isPl ? "Wysłaliśmy link ponownie." : "We sent the link again.");
    setLoading(false);
    captchaRef.current?.reset();
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: resetError } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
      fetchOptions: captchaFetchOptions(captchaToken),
    });
    if (resetError) return fail(resetError);
    // Always the same answer, so the form cannot be used to find out which addresses have accounts.
    setView("forgot-sent");
    setLoading(false);
    captchaRef.current?.reset();
  }

  async function handleTwoFactor(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode({ code: code.trim() })
      : await authClient.twoFactor.verifyTotp({ code: code.trim(), trustDevice: true });
    if (result.error) return fail(result.error);
    finishSignedIn();
  }

  async function handleOAuth(provider: "google") {
    setError(null);
    rememberReturnPath(returnTo());
    const { error: socialError } = await authClient.signIn.social({
      provider,
      callbackURL: "/sso-callback",
      newUserCallbackURL: "/sso-callback",
      errorCallbackURL: "/sso-callback?error=1",
    });
    if (socialError) fail(socialError);
  }

  const title = {
    "sign-in": isPl ? "Zaloguj się" : "Sign in",
    "sign-up": isPl ? "Załóż konto" : "Create account",
    "verify-sent": isPl ? "Sprawdź skrzynkę" : "Check your inbox",
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
  const captcha = <TurnstileWidget ref={captchaRef} onToken={setCaptchaToken} onStateChange={setCaptchaState} isPl={isPl} />;
  const waitingForCaptcha = !captchaReady;
  // Spinner on the button only while the invisible check is running; when the visitor has to act
  // (or it failed) the widget/message is shown instead and the button just stays disabled.
  const captchaChecking = waitingForCaptcha && captchaState === "checking";

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
            {error && emailTaken && view === "sign-up" && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                <button type="button" className="font-bold underline hover:text-[var(--chan-ink)]" onClick={() => switchView("sign-in")}>
                  {isPl ? "Zaloguj się" : "Sign in"}
                </button>
                <button type="button" className="font-bold underline hover:text-[var(--chan-ink)]" onClick={() => switchView("forgot")}>
                  {isPl ? "Nie pamiętam hasła" : "Forgot password"}
                </button>
                {emailTaken === "google" && (
                  <span className="text-[var(--chan-muted)]">
                    {isPl ? "Możesz też użyć przycisku Google." : "You can also use the Google button."}
                  </span>
                )}
              </div>
            )}
            {info && !error && (
              <p className="mt-3 rounded-lg bg-[var(--chan-blue-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--chan-blue)]">{info}</p>
            )}

            {view === "sign-in" && (
              <form onSubmit={handlePasswordSignIn} className="mt-5 space-y-3.5">
                <OAuthButtons onSelect={handleOAuth} isPl={isPl} />
                <Divider isPl={isPl} />
                <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" required />
                <Field label={isPl ? "Hasło" : "Password"} type="password" value={password} onChange={setPassword} autoComplete="current-password" revealLabels={revealLabels} required />
                {captcha}
                <PrimaryButton loading={loading} busy={captchaChecking} disabled={waitingForCaptcha} label={isPl ? "Zaloguj się" : "Sign in"} />
                <div className="flex items-center justify-between pt-1 text-[12px] text-[var(--chan-muted)]">
                  <button type="button" className="underline hover:text-[var(--chan-ink)]" onClick={() => switchView("forgot")}>
                    {isPl ? "Nie pamiętam hasła" : "Forgot password"}
                  </button>
                  <button type="button" className="underline hover:text-[var(--chan-ink)]" onClick={() => switchView("sign-up")}>
                    {isPl ? "Załóż konto" : "Create account"}
                  </button>
                </div>
              </form>
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
                  loading={loading}
                  busy={captchaChecking}
                  disabled={waitingForCaptcha || password.length < PASSWORD_MIN_LENGTH || password !== confirmPassword}
                  label={isPl ? "Załóż konto" : "Create account"}
                />
                <div className="pt-1 text-center text-[12px] text-[var(--chan-muted)]">
                  <button type="button" className="underline hover:text-[var(--chan-ink)]" onClick={() => switchView("sign-in")}>
                    {isPl ? "Masz już konto? Zaloguj się" : "Already have an account? Sign in"}
                  </button>
                </div>
              </form>
            )}

            {view === "verify-sent" && (
              <div className="mt-5 space-y-3.5">
                <p className="text-[13px] text-[var(--chan-body)]">
                  {isPl
                    ? "Jeśli możesz założyć konto na ten adres, wysłaliśmy tam link potwierdzający. Kliknij go, aby dokończyć. Sprawdź też spam."
                    : "If an account can be created for this address, we sent a confirmation link there. Click it to finish. Check your spam folder too."}
                </p>
                {captcha}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading || waitingForCaptcha}
                  className="text-[12px] font-bold underline hover:text-[var(--chan-ink)] disabled:opacity-50"
                >
                  {isPl ? "Wyślij link ponownie" : "Send the link again"}
                </button>
                <div>
                  <button type="button" className="text-[12px] text-[var(--chan-muted)] underline" onClick={() => switchView("sign-in")}>
                    {isPl ? "Wróć do logowania" : "Back to sign in"}
                  </button>
                </div>
              </div>
            )}

            {view === "forgot" && (
              <form onSubmit={handleForgot} className="mt-5 space-y-3.5">
                <p className="text-[13px] text-[var(--chan-body)]">
                  {isPl ? "Podaj e-mail — wyślemy link do ustawienia nowego hasła." : "Enter your email — we'll send a link to set a new password."}
                </p>
                <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" required />
                {captcha}
                <PrimaryButton loading={loading} busy={captchaChecking} disabled={waitingForCaptcha} label={isPl ? "Wyślij link" : "Send link"} />
                <div className="pt-1 text-center text-[12px] text-[var(--chan-muted)]">
                  <button type="button" className="underline hover:text-[var(--chan-ink)]" onClick={() => switchView("sign-in")}>
                    {isPl ? "Wróć do logowania" : "Back to sign in"}
                  </button>
                </div>
              </form>
            )}

            {view === "forgot-sent" && (
              <div className="mt-5 space-y-3.5">
                <p className="text-[13px] text-[var(--chan-body)]">
                  {isPl
                    ? "Jeśli to konto istnieje, wysłaliśmy link do ustawienia hasła. Działa przez godzinę."
                    : "If that account exists, we sent a link to set a password. It works for one hour."}
                </p>
                <button type="button" className="text-[12px] text-[var(--chan-muted)] underline" onClick={() => switchView("sign-in")}>
                  {isPl ? "Wróć do logowania" : "Back to sign in"}
                </button>
              </div>
            )}

            {view === "two-factor" && (
              <form onSubmit={handleTwoFactor} className="mt-5 space-y-3.5">
                <p className="text-[13px] text-[var(--chan-body)]">
                  {useBackupCode
                    ? (isPl ? "Wpisz jeden z kodów zapasowych." : "Enter one of your backup codes.")
                    : (isPl ? "Wpisz 6-cyfrowy kod z aplikacji uwierzytelniającej." : "Enter the 6-digit code from your authenticator app.")}
                </p>
                <Field
                  label={useBackupCode ? (isPl ? "Kod zapasowy" : "Backup code") : (isPl ? "Kod" : "Code")}
                  type="text"
                  value={code}
                  onChange={setCode}
                  inputMode={useBackupCode ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  required
                />
                <PrimaryButton loading={loading} label={isPl ? "Potwierdź" : "Verify"} />
                <button type="button" className="text-[12px] text-[var(--chan-muted)] underline" onClick={() => { setUseBackupCode(!useBackupCode); setCode(""); }}>
                  {useBackupCode ? (isPl ? "Użyj aplikacji" : "Use the app") : (isPl ? "Użyj kodu zapasowego" : "Use a backup code")}
                </button>
              </form>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
