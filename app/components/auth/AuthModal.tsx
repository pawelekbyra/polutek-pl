"use client";

import React, { useEffect, useState } from "react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "../icons";
import { Frame, INK, BLUE } from "../najs/primitives";
import { useLanguage } from "../LanguageContext";
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
  }

  async function handleGoogle() {
    if (!signIn) return;
    setError(null);
    const returnTo = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
    const { error: ssoError } = await signIn.sso({
      strategy: "oauth_google",
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
      <DialogContent className="max-w-md overflow-hidden border-none bg-transparent p-0 shadow-none">
        <div className="relative p-6 sm:p-7" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
          <Frame radius={18} seed={11} stroke={INK} strokeWidth={1.4} fill="#ffffff" />
          <div className="relative z-10">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight text-[#0f0f0f]">{title}</DialogTitle>
            </DialogHeader>

            {error && (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-600">
                {error}
              </p>
            )}
            {info && !error && (
              <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-[13px] font-semibold text-blue-700">{info}</p>
            )}

            {view === "sign-in" && (
              <form onSubmit={handlePasswordSignIn} className="mt-4 space-y-3">
                <GoogleButton onClick={handleGoogle} isPl={isPl} disabled={!ready} />
                <Divider isPl={isPl} />
                <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" required />
                <Field label={isPl ? "Hasło" : "Password"} type="password" value={password} onChange={setPassword} autoComplete="current-password" required />
                <PrimaryButton loading={loading} disabled={!ready} label={isPl ? "Zaloguj się" : "Sign in"} />
                <div className="flex items-center justify-between pt-1 text-[12px] text-[#7a7a7a]">
                  <button type="button" className="underline hover:text-[#0f0f0f]" onClick={() => switchView("forgot")}>
                    {isPl ? "Nie pamiętam hasła" : "Forgot password"}
                  </button>
                  <button type="button" className="underline hover:text-[#0f0f0f]" onClick={() => switchView("sign-up")}>
                    {isPl ? "Załóż konto" : "Create account"}
                  </button>
                </div>
              </form>
            )}

            {view === "sign-up" && (
              <form onSubmit={handleSignUp} className="mt-4 space-y-3">
                <GoogleButton onClick={handleGoogle} isPl={isPl} disabled={!ready} />
                <Divider isPl={isPl} />
                <Field label={isPl ? "Nazwa (opcjonalnie)" : "Name (optional)"} type="text" value={name} onChange={setName} autoComplete="name" />
                <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" required />
                <Field label={isPl ? "Hasło" : "Password"} type="password" value={password} onChange={setPassword} autoComplete="new-password" required />
                {/* Clerk bot protection renders into this element when Smart CAPTCHA is enabled. */}
                <div id="clerk-captcha" />
                <PrimaryButton loading={loading} disabled={!ready} label={isPl ? "Załóż konto" : "Create account"} />
                <div className="pt-1 text-center text-[12px] text-[#7a7a7a]">
                  <button type="button" className="underline hover:text-[#0f0f0f]" onClick={() => switchView("sign-in")}>
                    {isPl ? "Masz już konto? Zaloguj się" : "Already have an account? Sign in"}
                  </button>
                </div>
              </form>
            )}

            {view === "verify-email" && (
              <form onSubmit={handleVerifyEmail} className="mt-4 space-y-3">
                <p className="text-[13px] text-[#4a4a4a]">
                  {isPl ? "Wpisz kod, który wysłaliśmy na " : "Enter the code we sent to "}<strong>{email}</strong>.
                </p>
                <Field label={isPl ? "Kod z e-maila" : "Email code"} type="text" value={code} onChange={setCode} inputMode="numeric" required />
                <PrimaryButton loading={loading} disabled={!ready} label={isPl ? "Potwierdź" : "Verify"} />
              </form>
            )}

            {view === "forgot" && (
              <form onSubmit={handleForgot} className="mt-4 space-y-3">
                <p className="text-[13px] text-[#4a4a4a]">
                  {isPl ? "Podaj e-mail — wyślemy kod do zresetowania hasła." : "Enter your email — we'll send a reset code."}
                </p>
                <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" required />
                <PrimaryButton loading={loading} disabled={!ready} label={isPl ? "Wyślij kod" : "Send code"} />
                <div className="pt-1 text-center text-[12px] text-[#7a7a7a]">
                  <button type="button" className="underline hover:text-[#0f0f0f]" onClick={() => switchView("sign-in")}>
                    {isPl ? "Wróć do logowania" : "Back to sign in"}
                  </button>
                </div>
              </form>
            )}

            {view === "reset" && (
              <form onSubmit={handleReset} className="mt-4 space-y-3">
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
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#7a7a7a]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#171717]/25 bg-white px-3 py-2 text-[15px] text-[#0f0f0f] outline-none transition-colors focus:border-[#2563eb]"
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
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
      className="relative flex h-[44px] w-full items-center justify-center gap-2 text-[15px] font-bold text-white transition-all active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
    >
      <Frame radius={11} seed={5} stroke={INK} strokeWidth={1.4} fill={BLUE} showShadow />
      {loading ? <Loader2 className="relative z-10 h-4 w-4 animate-spin" aria-hidden="true" /> : <span className="relative z-10">{label}</span>}
    </button>
  );
}

function GoogleButton({ onClick, isPl, disabled }: { onClick: () => void; isPl: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="relative flex h-[44px] w-full items-center justify-center gap-2 text-[14px] font-bold text-[#0f0f0f] transition-all active:scale-[0.98] disabled:opacity-60"
    >
      <Frame radius={11} seed={9} stroke={INK} strokeWidth={1.2} fill="#ffffff" />
      <svg className="relative z-10 h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
        <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
      </svg>
      <span className="relative z-10">{isPl ? "Kontynuuj z Google" : "Continue with Google"}</span>
    </button>
  );
}

function Divider({ isPl }: { isPl: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-[#171717]/15" />
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#9a958b]">{isPl ? "lub" : "or"}</span>
      <span className="h-px flex-1 bg-[#171717]/15" />
    </div>
  );
}
