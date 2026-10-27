"use client";

// Account panel sections for AccountModal, split out to keep each module within the repo's
// file-size hotspot budget (profile: ProfileSection.tsx, password/2FA/sessions: SecuritySection.tsx).
// All operations go through the Better Auth client (lib/auth/client.ts) or our own /api/user routes.

import React, { useEffect, useState } from "react";
import { Loader2 } from "../icons";
import { OAUTH_PROVIDERS } from "./oauth-providers";
import { authClient } from "@/lib/auth/client";
import { signOutCompletely } from "@/lib/auth/sign-out";
import { authErrorMessage, isSessionNotFresh } from "@/lib/auth/errors";
import { rememberReturnPath } from "@/lib/auth/sso-return";
import { useUser } from "@/lib/auth/react";
import type { Tx } from "@/lib/i18n/ui";

const NETWORK_ERROR = { code: "NETWORK_ERROR" } as const;

export function useAccountUser() {
  const { user } = useUser();
  return user!;
}

/**
 * Whether the account has a password (a `credential` account). A failed lookup is reported as
 * `failed` (audit AUTH-36), never read as "no password": that would hide the password field from
 * an account that needs it.
 */
export function useHasPassword() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    authClient
      .listAccounts()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) return setFailed(true);
        setHasPassword(data.some((a: { providerId: string }) => a.providerId === "credential"));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setFailed(false);
    setAttempt((n) => n + 1);
  };
  return { hasPassword, failed, retry };
}

export function Feedback({ error, info }: { error: string | null; info: string | null }) {
  if (error) return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-600">{error}</p>;
  if (info) return <p className="rounded-lg bg-[var(--chan-blue-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--chan-blue)]">{info}</p>;
  return null;
}

/**
 * Shown when the server refuses a sensitive action because the session is not recent enough
 * (`SESSION_NOT_FRESH`, or `REAUTH_REQUIRED` for a Google-only account). Signing in again creates a
 * fresh session and brings the visitor back to this page.
 */
export function ReauthNotice({ tx }: { tx: Tx }) {
  async function signInAgain() {
    await signOutCompletely().catch(() => undefined);
    const here = window.location.pathname + window.location.search;
    window.location.assign(`${window.location.pathname}?signin=1&next=${encodeURIComponent(here)}`);
  }
  return (
    <div role="alert" className="space-y-2 rounded-lg bg-red-50 px-3 py-2">
      <p className="text-[13px] font-semibold text-red-600">{authErrorMessage({ code: "SESSION_NOT_FRESH" }, tx)}</p>
      <button type="button" onClick={signInAgain} className="text-[12px] font-bold text-red-700 underline">
        {tx("Zaloguj się ponownie", "Sign in again")}
      </button>
    </div>
  );
}

function RetryNotice({ tx, onRetry }: { tx: Tx; onRetry: () => void }) {
  return (
    <div role="alert" className="space-y-2 rounded-lg bg-red-50 px-3 py-2">
      <p className="text-[13px] font-semibold text-red-600">{authErrorMessage(NETWORK_ERROR, tx)}</p>
      <button type="button" onClick={onRetry} className="text-[12px] font-bold text-red-700 underline">
        {tx("Spróbuj ponownie", "Try again")}
      </button>
    </div>
  );
}

/**
 * Changing the sign-in address (audit AUTH-02): the server wants the password (or, for a Google-only
 * account, a sign-in from the last few minutes), then the CURRENT address must approve the change
 * before the new one is confirmed. The password goes in the same request body as the new address.
 */
export function EmailSection({ tx }: { tx: Tx }) {
  const user = useAccountUser();
  const { hasPassword, failed, retry } = useHasPassword();
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    setNeedsReauth(false);
    try {
      const { error: changeError } = await authClient.$fetch<{ status: boolean }>("/change-email", {
        method: "POST",
        body: {
          newEmail,
          callbackURL: window.location.pathname + window.location.search,
          ...(hasPassword ? { password } : {}),
        },
      });
      if (changeError) {
        const code = (changeError as { code?: string }).code;
        if (code === "REAUTH_REQUIRED" || isSessionNotFresh(changeError)) return setNeedsReauth(true);
        return setError(authErrorMessage(changeError, tx));
      }
      setNewEmail("");
      setPassword("");
      setInfo(
        tx("Wysłaliśmy wiadomość na Twój obecny adres. Zatwierdź w niej zmianę, a potem kliknij link, który przyjdzie na nowy adres.", "We sent a message to your current address. Approve the change there, then click the link we send to the new address."),
      );
    } catch {
      setError(authErrorMessage(NETWORK_ERROR, tx));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Feedback error={error} info={info} />
      {needsReauth && <ReauthNotice tx={tx} />}
      <div className="rounded-lg border border-[var(--chan-line)] px-3 py-2">
        <p className="truncate text-[14px] font-semibold">{user.primaryEmailAddress?.emailAddress}</p>
        <p className="text-[11px] text-[var(--chan-muted)]">
          {user.emailVerified ? (tx("Potwierdzony", "Verified")) : (tx("Niepotwierdzony", "Unverified"))}
        </p>
      </div>
      {failed && <RetryNotice tx={tx} onRetry={retry} />}
      {hasPassword !== null && (
        <form onSubmit={changeEmail} className="space-y-3 border-t border-[var(--chan-line)] pt-3">
          <Field label={tx("Nowy adres e-mail", "New email address")} type="email" value={newEmail} onChange={setNewEmail} autoComplete="email" />
          {hasPassword && (
            <Field label={tx("Twoje hasło", "Your password")} type="password" value={password} onChange={setPassword} autoComplete="current-password" />
          )}
          <Primary loading={loading} label={tx("Zmień adres", "Change address")} />
        </form>
      )}
    </div>
  );
}

type LinkedAccount = { id: string; providerId: string; accountId: string };

export function ConnectionsSection({ tx }: { tx: Tx }) {
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);

  async function load() {
    setLoadFailed(false);
    try {
      const { data, error: listError } = await authClient.listAccounts();
      if (listError || !data) return setLoadFailed(true);
      setAccounts(data as LinkedAccount[]);
    } catch {
      setLoadFailed(true);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function connect(provider: "google") {
    setError(null);
    rememberReturnPath(window.location.pathname + window.location.search);
    try {
      // Errors (another e-mail in Google, account already linked elsewhere) come back to /sso-callback?error=<code>,
      // which explains them before sending the user back here (audit AUTH-09).
      const { error: linkError } = await authClient.linkSocial({ provider, callbackURL: "/sso-callback", errorCallbackURL: "/sso-callback" });
      if (linkError) setError(authErrorMessage(linkError, tx));
    } catch {
      setError(authErrorMessage(NETWORK_ERROR, tx));
    }
  }

  async function disconnect(account: LinkedAccount) {
    setError(null);
    setNeedsReauth(false);
    try {
      const { error: unlinkError } = await authClient.unlinkAccount({ accountId: account.id });
      if (unlinkError) {
        if (isSessionNotFresh(unlinkError)) return setNeedsReauth(true);
        return setError(authErrorMessage(unlinkError, tx));
      }
      await load();
    } catch {
      setError(authErrorMessage(NETWORK_ERROR, tx));
    }
  }

  const external = (accounts ?? []).filter((a) => a.providerId !== "credential");
  const connectable = OAUTH_PROVIDERS.filter((p) => !external.some((a) => a.providerId === p.provider));

  return (
    <div className="space-y-3">
      <Feedback error={error} info={null} />
      {needsReauth && <ReauthNotice tx={tx} />}
      {loadFailed && <RetryNotice tx={tx} onRetry={() => void load()} />}
      <ul className="space-y-2">
        {external.map((acc) => {
          const known = OAUTH_PROVIDERS.find((p) => p.provider === acc.providerId);
          return (
            <li key={acc.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--chan-line)] px-3 py-2">
              <div className="flex items-center gap-2">
                {known && <known.Icon className="h-[18px] w-[18px]" />}
                <p className="text-[14px] font-semibold capitalize">{known?.label ?? acc.providerId}</p>
              </div>
              <button type="button" onClick={() => disconnect(acc)} className="text-[12px] font-bold text-red-600 hover:underline">
                {tx("Odłącz", "Disconnect")}
              </button>
            </li>
          );
        })}
        {accounts && external.length === 0 && (
          <li className="text-[13px] text-[var(--chan-muted)]">{tx("Brak połączonych kont.", "No connected accounts.")}</li>
        )}
      </ul>
      {accounts && connectable.map(({ provider, label, Icon }) => (
        <button
          key={provider}
          type="button"
          onClick={() => connect(provider)}
          className="flex h-[42px] w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--chan-surface)] font-sans text-[14px] font-bold text-[var(--chan-ink)] transition-all hover:-translate-y-px active:scale-[0.98]"
        >
          <Icon className="h-[18px] w-[18px]" />
          <span>{tx("Połącz z {0}", "Connect {0}", label)}</span>
        </button>
      ))}
    </div>
  );
}

export function DangerSection({ tx, onDeleted }: { tx: Tx; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const { hasPassword, failed, retry } = useHasPassword();
  const [needsGoogle, setNeedsGoogle] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const CONFIRM_WORD = tx("USUŃ", "DELETE");

  // Deleting is irreversible, so the server wants proof it is really the owner: the password, or (Google-only
  // accounts) a sign-in from the last few minutes.
  async function confirmWithGoogle() {
    rememberReturnPath(window.location.pathname + window.location.search);
    try {
      const { error: socialError } = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/sso-callback",
        errorCallbackURL: "/sso-callback",
      });
      if (socialError) setError(authErrorMessage(socialError, tx));
    } catch {
      setError(authErrorMessage(NETWORK_ERROR, tx));
    }
  }

  async function del(e: React.FormEvent) {
    e.preventDefault();
    if (confirm !== CONFIRM_WORD) return;
    setLoading(true);
    setError(null);
    setNeedsGoogle(false);
    const response = await fetch("/api/user/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hasPassword ? { password } : {}),
    }).catch(() => null);
    if (!response) {
      setError(authErrorMessage(NETWORK_ERROR, tx));
      setLoading(false);
      return;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (body?.error === "REAUTH_REQUIRED") setNeedsGoogle(true);
      setError(authErrorMessage({ code: body?.error, status: response.status }, tx));
      setLoading(false);
      return;
    }
    // Every session was dropped server-side; clear the local state and reload.
    await signOutCompletely().catch(() => undefined);
    onDeleted();
    window.location.assign("/");
  }

  return (
    <form onSubmit={del} className="space-y-3">
      <Feedback error={error} info={null} />
      {failed && <RetryNotice tx={tx} onRetry={retry} />}
      <p className="text-[13px] leading-[1.5] text-[var(--chan-body)]">
        {tx("Usunięcie konta jest nieodwracalne. Wpisz USUŃ, aby potwierdzić.", "Deleting your account is permanent. Type DELETE to confirm.")}
      </p>
      <p className="text-[13px] leading-[1.5] text-[var(--chan-body)]">
        {tx("Najpierw możesz pobrać swoje dane:", "You can download your data first:")}{" "}
        <a href="/api/user/export" download className="font-bold underline hover:text-[var(--chan-ink)]">
          {tx("Pobierz moje dane (JSON)", "Download my data (JSON)")}
        </a>
      </p>
      {hasPassword && (
        <Field label={tx("Twoje hasło", "Your password")} type="password" value={password} onChange={setPassword} autoComplete="current-password" />
      )}
      <Field label={`${tx("Wpisz", "Type")} ${CONFIRM_WORD}`} value={confirm} onChange={setConfirm} />
      {needsGoogle && (
        <button type="button" onClick={confirmWithGoogle} className="text-[12px] font-bold underline hover:text-[var(--chan-ink)]">
          {tx("Potwierdź przez Google", "Confirm with Google")}
        </button>
      )}
      <button
        type="submit"
        disabled={loading || confirm !== CONFIRM_WORD || hasPassword === null || (hasPassword && !password)}
        className="flex h-[44px] w-full items-center justify-center rounded-[12px] bg-red-600 font-brand text-[15px] font-bold text-white transition-all hover:-translate-y-px active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>{tx("Usuń konto na zawsze", "Delete account permanently")}</span>}
      </button>
    </form>
  );
}

export function Field({
  label,
  type = "text",
  value,
  onChange,
  inputMode,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "numeric" | "text";
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--chan-muted)]">{label}</span>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[12px] border border-[var(--chan-control-border)] bg-[var(--chan-surface)] px-3 py-2 font-sans text-[15px] text-[var(--chan-ink)] outline-none transition-colors focus-visible:border-[var(--chan-blue)] focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
      />
    </label>
  );
}

export function Primary({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex h-[44px] w-full items-center justify-center rounded-[12px] bg-[var(--chan-blue)] font-brand text-[15px] font-bold text-white transition-all hover:-translate-y-px active:scale-[0.98] disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>{label}</span>}
    </button>
  );
}
