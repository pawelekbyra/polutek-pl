"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/config";
import { Field, PrimaryButton } from "@/app/components/auth/AuthFormParts";
import { useLanguage } from "@/app/components/LanguageContext";

// Target of the password-reset e-mail link: Better Auth validates the token and redirects here
// with `?token=...` (or `?error=INVALID_TOKEN` for an expired/used link).
function ResetPasswordForm() {
  const { language } = useLanguage();
  const { tx } = useLanguage();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const tokenError = searchParams.get("error");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const { error: resetError } = await authClient.resetPassword({ newPassword: password, token });
      if (resetError) return setError(authErrorMessage(resetError, tx));
      setDone(true);
    } catch {
      // The auth client throws on a dropped connection (audit AUTH-08).
      setError(authErrorMessage({ code: "NETWORK_ERROR" }, tx));
    } finally {
      setLoading(false);
    }
  }

  const invalidLink = !token || Boolean(tokenError);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] px-6 py-7 shadow-[0_20px_50px_rgba(23,23,23,0.10)]">
        <h1 className="font-brand text-xl font-bold text-[var(--chan-ink)]">{tx("Ustaw nowe hasło", "Set a new password")}</h1>
        {done ? (
          <>
            <p className="text-[13px] text-[var(--chan-body)]">
              {tx("Hasło zostało zmienione. Możesz się zalogować.", "Your password was changed. You can sign in now.")}
            </p>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/?signin=1" className="inline-block rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background">
              {tx("Zaloguj się", "Sign in")}
            </a>
          </>
        ) : invalidLink ? (
          <>
            <p role="alert" className="text-[13px] text-red-600">{authErrorMessage({ code: "INVALID_TOKEN" }, tx)}</p>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="inline-block rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background">
              {tx("Wróć na stronę główną", "Back to home")}
            </a>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-3.5">
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-600">{error}</p>}
            <Field
              label={tx("Nowe hasło (min. 10 znaków)", "New password (min. 10 characters)")}
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
            />
            <PrimaryButton loading={loading} label={tx("Ustaw hasło", "Set password")} />
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
