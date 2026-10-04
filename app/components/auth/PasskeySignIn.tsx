"use client";

// Passkey sign-in inside the sign-in modal: a "Sign in with a passkey" button and, where the browser
// supports it, passkeys offered in the e-mail field's autofill list (the field carries
// `autocomplete="username webauthn"`). Renders nothing where WebAuthn is missing. A passkey sign-in
// never asks for the TOTP code (decision in docs/architecture/auth-better-auth.md).

import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "../icons";
import { authClient } from "@/lib/auth/client";
import { isPasskeyCancelled, passkeyErrorMessage } from "@/lib/auth/errors";
import { isPasskeyAutofillAvailable, usePasskeySupport } from "@/lib/auth/passkey-support";

type ErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

/**
 * Autofill runs without a click, so only failures that follow the person picking a passkey are
 * shown; an options request that fails on its own (e.g. rate limit) stays silent.
 */
const AUTOFILL_REPORTED = new Set(["PASSKEY_NOT_FOUND", "PASSKEY_USER_VERIFICATION_REQUIRED", "AUTHENTICATION_FAILED", "ACCOUNT_DELETED"]);

function PasskeyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21v-1a6 6 0 0 1 9.5-4.9" />
      <circle cx="18" cy="13" r="2.5" />
      <path d="M18 15.5V21l1.5-1.5L18 18" />
    </svg>
  );
}

export function PasskeySignIn({
  active,
  isPl,
  onSignedIn,
  onError,
}: {
  /** The modal is open on the sign-in view. */
  active: boolean;
  isPl: boolean;
  onSignedIn: () => void;
  onError: (message: string | null) => void;
}) {
  const supported = usePasskeySupport();
  const [loading, setLoading] = useState(false);
  // The latest callbacks, so the autofill request (started once per opening) never calls stale ones.
  const handlers = useRef({ onSignedIn, onError, isPl });
  useEffect(() => {
    handlers.current = { onSignedIn, onError, isPl };
  });

  useEffect(() => {
    if (!active || !supported) return;
    let current = true;
    void (async () => {
      if (!(await isPasskeyAutofillAvailable()) || !current) return;
      const result = await authClient.signIn.passkey({ autoFill: true }).catch(() => null);
      if (!current || !result) return;
      const error = result.error as ErrorLike;
      if (!error) return handlers.current.onSignedIn();
      if (error.code && AUTOFILL_REPORTED.has(error.code)) handlers.current.onError(passkeyErrorMessage(error, handlers.current.isPl));
    })();
    return () => {
      current = false;
    };
  }, [active, supported]);

  async function signIn() {
    setLoading(true);
    onError(null);
    try {
      // Starting this ceremony aborts a pending autofill request (one WebAuthn call at a time).
      const { error } = await authClient.signIn.passkey();
      if (error) {
        if (!isPasskeyCancelled(error)) onError(passkeyErrorMessage(error, isPl));
        return;
      }
      onSignedIn();
    } catch {
      onError(passkeyErrorMessage({ code: "NETWORK_ERROR" }, isPl));
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={signIn}
      disabled={loading}
      aria-busy={loading || undefined}
      className="flex h-[44px] w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--chan-surface)] font-sans text-[14px] font-bold text-[var(--chan-ink)] transition-[background-color,box-shadow,transform] duration-160 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(23,23,23,0.08)] active:scale-[0.98] disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PasskeyIcon className="h-[18px] w-[18px]" />}
      <span>{isPl ? "Zaloguj się kluczem dostępu" : "Sign in with a passkey"}</span>
    </button>
  );
}
