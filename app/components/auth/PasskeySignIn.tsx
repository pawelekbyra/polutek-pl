"use client";

// "Use a passkey" in the sign-in window, working like "Continue with Google": somebody with a
// passkey of ours signs in; somebody without one (no key in the browser, nothing picked from the list,
// or a key that belongs to no account) is taken to "create an account with a passkey" (onNeedAccount),
// never to an error. Where the browser supports it, passkeys are also offered in the e-mail field's
// autofill (`autocomplete="username webauthn"`). Renders nothing where WebAuthn is missing. A passkey
// sign-in never asks for the TOTP code (decision in docs/architecture/auth-better-auth.md).

import React, { useEffect, useRef, useState } from "react";
import { Fingerprint } from "lucide-react";
import { Loader2 } from "../icons";
import { authClient } from "@/lib/auth/client";
import { isPasskeyCancelled, passkeyErrorMessage, passkeyNeedsAccount } from "@/lib/auth/errors";
import { isPasskeyAutofillAvailable, usePasskeySupport } from "@/lib/auth/passkey-support";
import type { Tx } from "@/lib/i18n/ui";

type ErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

/**
 * Autofill runs without a click, so only failures that follow the person picking a passkey are
 * shown; an options request that fails on its own (e.g. rate limit) stays silent.
 */
const AUTOFILL_REPORTED = new Set(["PASSKEY_USER_VERIFICATION_REQUIRED", "AUTHENTICATION_FAILED", "ACCOUNT_DELETED", "EMAIL_NOT_VERIFIED"]);

/** A fingerprint, the gesture the person actually makes (brand blue, so it reads as a real option next to Google). */
function PasskeyIcon({ className }: { className?: string }) {
  return <Fingerprint className={className} strokeWidth={2} aria-hidden="true" />;
}

export function PasskeySignIn({
  active,
  tx,
  onSignedIn,
  onError,
  onNeedAccount,
}: {
  /** The modal is open on the sign-in view. */
  active: boolean;
  tx: Tx;
  onSignedIn: () => void;
  onError: (message: string | null) => void;
  /** No passkey of ours was used: offer to create an account with one. */
  onNeedAccount: () => void;
}) {
  const supported = usePasskeySupport();
  const [loading, setLoading] = useState(false);
  // The latest callbacks, so the autofill request (started once per opening) never calls stale ones.
  const handlers = useRef({ onSignedIn, onError, onNeedAccount, tx });
  useEffect(() => {
    handlers.current = { onSignedIn, onError, onNeedAccount, tx };
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
      // A key picked from the autofill list that belongs to no account: same as the button.
      if (error.code === "PASSKEY_NOT_FOUND") return handlers.current.onNeedAccount();
      if (error.code && AUTOFILL_REPORTED.has(error.code)) handlers.current.onError(passkeyErrorMessage(error, handlers.current.tx));
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
      if (!error) return onSignedIn();
      if (passkeyNeedsAccount(error)) return onNeedAccount();
      if (!isPasskeyCancelled(error)) onError(passkeyErrorMessage(error, tx));
    } catch {
      onError(passkeyErrorMessage({ code: "NETWORK_ERROR" }, tx));
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
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PasskeyIcon className="h-[20px] w-[20px] text-[var(--chan-blue)]" />}
      <span>{tx("Użyj klucza dostępu", "Use a passkey")}</span>
    </button>
  );
}
