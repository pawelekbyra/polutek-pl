"use client";

// "Create an account with a passkey" step of the sign-in window (passkey-first sign-up, see
// lib/auth/passkey-signup.ts): e-mail + Turnstile -> signed sign-up token -> the browser creates the
// passkey -> the server creates the account and mails the verification link. The account signs in
// when that link is clicked; the first-sign-in dialog then asks for nickname, avatar and language.

import React, { useState } from "react";
import { Field, PrimaryButton } from "./AuthFormParts";
import { authClient, captchaFetchOptions } from "@/lib/auth/client";
import { isPasskeyCancelled, passkeyErrorMessage } from "@/lib/auth/errors";
import { defaultPasskeyName } from "@/lib/auth/passkey-support";

type ErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

export function PasskeySignupView({
  isPl,
  email,
  onEmailChange,
  callbackURL,
  captcha,
  captchaToken,
  captchaBusy,
  captchaReady,
  resetCaptcha,
  onError,
  onEmailTaken,
  onCreated,
  onBack,
}: {
  isPl: boolean;
  email: string;
  onEmailChange: (value: string) => void;
  /** Where the verification link brings the person back (same-site path). */
  callbackURL: string;
  captcha: React.ReactNode;
  captchaToken: string | null;
  captchaBusy: boolean;
  captchaReady: boolean;
  resetCaptcha: () => void;
  onError: (message: string | null) => void;
  /** The address already has an account: the window offers sign-in / password reset. */
  onEmailTaken: (kind: "google" | "password") => void;
  onCreated: () => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);

  function fail(error: ErrorLike) {
    if (error?.code === "EMAIL_TAKEN" || error?.code === "EMAIL_TAKEN_GOOGLE") {
      onEmailTaken(error.code === "EMAIL_TAKEN_GOOGLE" ? "google" : "password");
    }
    onError(passkeyErrorMessage(error, isPl));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    onError(null);
    try {
      const start = await authClient.$fetch<{ token: string }>("/passkey-signup/start", {
        method: "POST",
        body: { email, language: isPl ? "pl" : "en", callbackURL },
        ...captchaFetchOptions(captchaToken),
      });
      resetCaptcha();
      if (start.error || !start.data?.token) return fail(start.error as ErrorLike);
      const name = typeof navigator === "undefined" ? undefined : defaultPasskeyName(navigator.userAgent);
      const { error } = await authClient.passkey.addPasskey({ name, context: start.data.token });
      if (error) {
        if (isPasskeyCancelled(error)) {
          return onError(isPl ? "Klucza nie utworzono. Spróbuj ponownie, gdy będziesz gotowy." : "No passkey was created. Try again when you are ready.");
        }
        return fail(error);
      }
      onCreated();
    } catch {
      fail({ code: "NETWORK_ERROR" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3.5">
      <p className="text-[13px] leading-[1.5] text-[var(--chan-body)]">
        {isPl
          ? "Nie znaleźliśmy Twojego klucza dostępu. Podaj e-mail, a założymy konto z nowym kluczem: zalogujesz się odciskiem palca, twarzą albo PIN-em urządzenia, bez hasła."
          : "We did not find a passkey of yours. Enter your email and we'll create an account with a new passkey: you'll sign in with your fingerprint, face or device PIN, no password."}
      </p>
      <Field label="E-mail" type="email" value={email} onChange={onEmailChange} autoComplete="email" required />
      {captcha}
      <PrimaryButton
        loading={loading}
        busy={captchaBusy}
        disabled={!captchaReady}
        label={isPl ? "Utwórz konto z kluczem" : "Create account with a passkey"}
      />
      <div className="pt-1 text-center text-[12px] text-[var(--chan-muted)]">
        <button type="button" className="underline hover:text-[var(--chan-ink)]" onClick={onBack}>
          {isPl ? "Wróć do logowania" : "Back to sign in"}
        </button>
      </div>
    </form>
  );
}
