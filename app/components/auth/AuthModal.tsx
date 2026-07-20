"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "../icons";
import { useLanguage } from "../LanguageContext";
import { useVisibleOAuthProviders, type OAuthStrategy } from "./oauth-providers";
import type { AuthView } from "./AuthModalProvider";

type InternalView = "sign-in" | "sign-up" | "verify-email" | "forgot" | "reset";

interface AuthModalProps {
  open: boolean;
  initialView: AuthView;
  onOpenChange: (open: boolean) => void;
}

type ClerkOpError = { message?: string; longMessage?: string; errors?: Array<{ longMessage?: string; message?: string }> } | null;

// Extract a human message from a Clerk headless error without leaking internals.
function errorMessage(error: ClerkOpError, isPl: boolean): string {
  if (error) {
    const nested = error.errors?.[0];
    return nested?.longMessage || nested?.message || error.longMessage || error.message ||
      (isPl ? "Coś poszło nie tak. Spróbuj ponownie." : "Something went wrong. Please try again.");
  }
  return isPl ? "Coś poszło nie tak. Spróbuj ponownie." : "Something went wrong. Please try again.";
}

export default function AuthModal({ open, initialView, onOpenChange }: AuthModalProps) {
  const router = useRouter();
  const { isPl } = useLanguageFlags();
  // Clerk's signals API: these hooks return the future resources directly.
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const [view, setView] = useState<InternalView>(initialView);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setView(initialView);
      setError(null);
      setInfo(null);
      setCode("");
      setNewPassword("");
      setLoading(false);
    }
  }, [open, initialView]);

  const ready = Boolean(signIn && signUp);

  function showError(err: ClerkOpError) {
    setError(errorMessage(err, isPl));
    setLoading(false);
  }

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) return;
    setLoading(true);
    setError(null);
    const { error: signInError } = await signIn.password({ identifier: email, password });
    if (signInError) return showError(signInError as ClerkOpError);
    // Turn the completed sign-in into the active session. ClerkLocalizationProvider then
    // refreshes session data in place; we simply close (no hard redirect — PWA note).
    const { error: finalizeError } = await signIn.finalize();
    if (finalizeError) return showError(finalizeError as ClerkOpError);
    onOpenChange(false);
    router.refresh();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setLoading(true);
    setError(null);
    const { error: createError } = await signUp.create({ emailAddress: email, password, ...(name ? { firstName: name } : {}) });
    if (createError) return showError(createError as ClerkOpError);
    const { error: sendError } = await signUp.verifications.sendEmailCode();
    if (sendError) return showError(sendError as ClerkOpError);
    setInfo(isPl ? "Wysłaliśmy kod na Twój e-mail." : "We sent a code to your email.");
    setView("verify-email");
    setLoading(false);
    router.refresh();
  }

  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setLoading(true);
    setError(null);
    const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code });
    if (verifyError) return showError(verifyError as ClerkOpError);
    const { error: finalizeError } = await signUp.finalize();
    if (finalizeError) return showError(finalizeError as ClerkOpError);
    onOpenChange(false);
    router.refresh();
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) return;
    setLoading(true);
    setError(null);
    // Establish a sign-in context for the identifier, then send the reset code.
    const { error: createError } = await signIn.create({ identifier: email });
    if (createError) return showError(createError as ClerkOpError);
    const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
    if (sendError) return showError(sendError as ClerkOpError);
    setInfo(isPl ? "Wysłaliśmy kod resetujący na Twój e-mail." : "We sent a reset code to your email.");
    setView("reset");
    setLoading(false);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) return;
    setLoading(true);
    setError(null);
    const { error: verifyError } = await signIn.resetPasswordEmailCode.verifyCode({ code });
    if (verifyError) return showError(verifyError as ClerkOpError);
    const { error: submitError } = await signIn.resetPasswordEmailCode.submitPassword({ password: newPassword });
    if (submitError) return showError(submitError as ClerkOpError);
    const { error: finalizeError } = await signIn.finalize();
    if (finalizeError) return showError(finalizeError as ClerkOpError);
    onOpenChange(false);
    router.refresh();
  }

  async function handleOAuth(strategy: OAuthStrategy) {
    if (!signIn) return;
    setError(null);
    const returnTo = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
    const { error: ssoError } = await signIn.sso({
      strategy,
      redirectUrl: returnTo,
      redirectCallbackUrl: "/sso-callback",
    });
    if (ssoError) showError(ssoError as ClerkOpError);
  }

  const title = {
    "sign-in": isPl ? "Zaloguj się" : "Sign in",
    "sign-up": isPl ? "Załóż konto" : "Create account",
    "verify-email": isPl ? "Potwierdź e-mail" : "Verify your email",
    forgot: isPl ? "Reset hasła" : "Reset password",
    reset: isPl ? "Ustaw nowe hasło" : "Set a new password",
  }[view];

  function switchView(next: InternalView) {
    setError(null);
    setInfo(null);
    setView(next);
  }

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
            {info && !error && (
              <p className="mt-3 rounded-lg bg-[var(--chan-blue-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--chan-blue)]">{info}</p>
            )}

            {view === "sign-in" && (
              <form onSubmit={handlePasswordSignIn} className="mt-5 space-y-3.5">
                <OAuthButtons onSelect={handleOAuth} isPl={isPl} disabled={!ready} />
                <Divider isPl={isPl} />
                <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" required />
                <Field label={isPl ? "Hasło" : "Password"} type="password" value={password} onChange={setPassword} autoComplete="current-password" required />
                <PrimaryButton loading={loading} disabled={!ready} label={isPl ? "Zaloguj się" : "Sign in"} />
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
                <OAuthButtons onSelect={handleOAuth} isPl={isPl} disabled={!ready} />
                <Divider isPl={isPl} />
                <Field label={isPl ? "Nazwa (opcjonalnie)" : "Name (optional)"} type="text" value={name} onChange={setName} autoComplete="name" />
                <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" required />
                <Field label={isPl ? "Hasło" : "Password"} type="password" value={password} onChange={setPassword} autoComplete="new-password" required />
                {/* Clerk bot protection renders into this element when Smart CAPTCHA is enabled. */}
                <div id="clerk-captcha" />
                <PrimaryButton loading={loading} disabled={!ready} label={isPl ? "Załóż konto" : "Create account"} />
                <div className="pt-1 text-center text-[12px] text-[var(--chan-muted)]">
                  <button type="button" className="underline hover:text-[var(--chan-ink)]" onClick={() => switchView("sign-in")}>
                    {isPl ? "Masz już konto? Zaloguj się" : "Already have an account? Sign in"}
                  </button>
                </div>
              </form>
            )}

            {view === "verify-email" && (
              <form onSubmit={handleVerifyEmail} className="mt-5 space-y-3.5">
                <p className="text-[13px] text-[var(--chan-body)]">
                  {isPl ? "Wpisz kod, który wysłaliśmy na " : "Enter the code we sent to "}<strong>{email}</strong>.
                </p>
                <Field label={isPl ? "Kod z e-maila" : "Email code"} type="text" value={code} onChange={setCode} inputMode="numeric" required />
                <PrimaryButton loading={loading} disabled={!ready} label={isPl ? "Potwierdź" : "Verify"} />
              </form>
            )}

            {view === "forgot" && (
              <form onSubmit={handleForgot} className="mt-5 space-y-3.5">
                <p className="text-[13px] text-[var(--chan-body)]">
                  {isPl ? "Podaj e-mail — wyślemy kod do zresetowania hasła." : "Enter your email — we'll send a reset code."}
                </p>
                <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" required />
                <PrimaryButton loading={loading} disabled={!ready} label={isPl ? "Wyślij kod" : "Send code"} />
                <div className="pt-1 text-center text-[12px] text-[var(--chan-muted)]">
                  <button type="button" className="underline hover:text-[var(--chan-ink)]" onClick={() => switchView("sign-in")}>
                    {isPl ? "Wróć do logowania" : "Back to sign in"}
                  </button>
                </div>
              </form>
            )}

            {view === "reset" && (
              <form onSubmit={handleReset} className="mt-5 space-y-3.5">
                <Field label={isPl ? "Kod z e-maila" : "Email code"} type="text" value={code} onChange={setCode} inputMode="numeric" required />
                <Field label={isPl ? "Nowe hasło" : "New password"} type="password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" required />
                <PrimaryButton loading={loading} disabled={!ready} label={isPl ? "Ustaw hasło" : "Set password"} />
              </form>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function useLanguageFlags() {
  const { language } = useLanguage();
  return { isPl: language === "pl" };
}

function Field({
  label,
  type,
  value,
  onChange,
  ...rest
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  inputMode?: "numeric" | "text";
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--chan-muted)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[12px] border border-[var(--chan-line)] bg-[var(--chan-surface)] px-3 py-2 font-sans text-[15px] text-[var(--chan-ink)] outline-none transition-colors focus:border-[var(--chan-blue)]"
        {...rest}
      />
    </label>
  );
}

function PrimaryButton({ loading, disabled, label }: { loading: boolean; disabled?: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--chan-blue)] font-brand text-[15px] font-bold text-white transition-[background-color,box-shadow,transform] duration-160 hover:-translate-y-px hover:shadow-[0_8px_20px_color-mix(in_srgb,var(--chan-blue)_25%,transparent)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <span>{label}</span>}
    </button>
  );
}

function OAuthButtons({
  onSelect,
  isPl,
  disabled,
}: {
  onSelect: (strategy: OAuthStrategy) => void;
  isPl: boolean;
  disabled?: boolean;
}) {
  const providers = useVisibleOAuthProviders();

  return (
    <div className="space-y-2">
      {providers.map(({ strategy, label, Icon }) => (
        <button
          key={strategy}
          type="button"
          onClick={() => onSelect(strategy)}
          disabled={disabled}
          className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--chan-surface)] font-sans text-[14px] font-bold text-[var(--chan-ink)] transition-[background-color,box-shadow,transform] duration-160 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(23,23,23,0.08)] active:scale-[0.98] disabled:opacity-60"
        >
          <Icon className="h-[18px] w-[18px]" />
          <span>{isPl ? `Kontynuuj z ${label}` : `Continue with ${label}`}</span>
        </button>
      ))}
    </div>
  );
}

function Divider({ isPl }: { isPl: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-[var(--chan-line)]" />
      <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--chan-muted)]">{isPl ? "lub" : "or"}</span>
      <span className="h-px flex-1 bg-[var(--chan-line)]" />
    </div>
  );
}
