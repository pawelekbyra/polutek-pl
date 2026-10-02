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

export function useAccountUser() {
  const { user } = useUser();
  return user!;
}

export function Feedback({ error, info }: { error: string | null; info: string | null }) {
  if (error) return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-600">{error}</p>;
  if (info) return <p className="rounded-lg bg-[var(--chan-blue-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--chan-blue)]">{info}</p>;
  return null;
}

/**
 * Shown when Better Auth refuses a sensitive action because the session is older than `freshAge`.
 * Signing in again creates a fresh session and brings the visitor back to this page.
 */
export function ReauthNotice({ isPl }: { isPl: boolean }) {
  async function signInAgain() {
    await signOutCompletely().catch(() => undefined);
    const here = window.location.pathname + window.location.search;
    window.location.assign(`${window.location.pathname}?signin=1&next=${encodeURIComponent(here)}`);
  }
  return (
    <div role="alert" className="space-y-2 rounded-lg bg-red-50 px-3 py-2">
      <p className="text-[13px] font-semibold text-red-600">{authErrorMessage({ code: "SESSION_NOT_FRESH" }, isPl)}</p>
      <button type="button" onClick={signInAgain} className="text-[12px] font-bold text-red-700 underline">
        {isPl ? "Zaloguj się ponownie" : "Sign in again"}
      </button>
    </div>
  );
}

export function EmailSection({ isPl }: { isPl: boolean }) {
  const user = useAccountUser();
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const { error: changeError } = await authClient.changeEmail({
      newEmail,
      callbackURL: window.location.pathname + window.location.search,
    });
    setLoading(false);
    if (changeError) return setError(authErrorMessage(changeError, isPl));
    setNewEmail("");
    setInfo(
      isPl
        ? "Wysłaliśmy link potwierdzający na nowy adres. Zmiana nastąpi po kliknięciu w link."
        : "We sent a confirmation link to the new address. The change happens once you click it.",
    );
  }

  return (
    <div className="space-y-3">
      <Feedback error={error} info={info} />
      <div className="rounded-lg border border-[var(--chan-line)] px-3 py-2">
        <p className="truncate text-[14px] font-semibold">{user.primaryEmailAddress?.emailAddress}</p>
        <p className="text-[11px] text-[var(--chan-muted)]">
          {user.emailVerified ? (isPl ? "Potwierdzony" : "Verified") : (isPl ? "Niepotwierdzony" : "Unverified")}
        </p>
      </div>
      <form onSubmit={changeEmail} className="space-y-3 border-t border-[var(--chan-line)] pt-3">
        <Field label={isPl ? "Nowy adres e-mail" : "New email address"} type="email" value={newEmail} onChange={setNewEmail} autoComplete="email" />
        <Primary loading={loading} label={isPl ? "Zmień adres" : "Change address"} />
      </form>
    </div>
  );
}

type LinkedAccount = { id: string; providerId: string; accountId: string };

export function ConnectionsSection({ isPl }: { isPl: boolean }) {
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);

  async function load() {
    const { data } = await authClient.listAccounts();
    setAccounts((data as LinkedAccount[] | null) ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function connect(provider: "google") {
    setError(null);
    rememberReturnPath(window.location.pathname + window.location.search);
    const { error: linkError } = await authClient.linkSocial({ provider, callbackURL: "/sso-callback" });
    if (linkError) setError(authErrorMessage(linkError, isPl));
  }

  async function disconnect(account: LinkedAccount) {
    setError(null);
    setNeedsReauth(false);
    const { error: unlinkError } = await authClient.unlinkAccount({ accountId: account.id });
    if (unlinkError) {
      if (isSessionNotFresh(unlinkError)) return setNeedsReauth(true);
      return setError(authErrorMessage(unlinkError, isPl));
    }
    await load();
  }

  const external = (accounts ?? []).filter((a) => a.providerId !== "credential");
  const connectable = OAUTH_PROVIDERS.filter((p) => !external.some((a) => a.providerId === p.provider));

  return (
    <div className="space-y-3">
      <Feedback error={error} info={null} />
      {needsReauth && <ReauthNotice isPl={isPl} />}
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
                {isPl ? "Odłącz" : "Disconnect"}
              </button>
            </li>
          );
        })}
        {accounts && external.length === 0 && (
          <li className="text-[13px] text-[var(--chan-muted)]">{isPl ? "Brak połączonych kont." : "No connected accounts."}</li>
        )}
      </ul>
      {connectable.map(({ provider, label, Icon }) => (
        <button
          key={provider}
          type="button"
          onClick={() => connect(provider)}
          className="flex h-[42px] w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--chan-surface)] font-sans text-[14px] font-bold text-[var(--chan-ink)] transition-all hover:-translate-y-px active:scale-[0.98]"
        >
          <Icon className="h-[18px] w-[18px]" />
          <span>{isPl ? `Połącz z ${label}` : `Connect ${label}`}</span>
        </button>
      ))}
    </div>
  );
}

export function DangerSection({ isPl, onDeleted }: { isPl: boolean; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [needsGoogle, setNeedsGoogle] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const CONFIRM_WORD = isPl ? "USUŃ" : "DELETE";

  useEffect(() => {
    void authClient.listAccounts().then(({ data }) => {
      setHasPassword(Boolean(data?.some((a: { providerId: string }) => a.providerId === "credential")));
    });
  }, []);

  // Deleting is irreversible, so the server wants proof it is really the owner: the password, or (Google-only
  // accounts) a sign-in from the last few minutes.
  async function confirmWithGoogle() {
    rememberReturnPath(window.location.pathname + window.location.search);
    const { error: socialError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/sso-callback",
      errorCallbackURL: "/sso-callback?error=1",
    });
    if (socialError) setError(authErrorMessage(socialError, isPl));
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
    if (!response?.ok) {
      const body = (await response?.json().catch(() => null)) as { error?: string } | null;
      if (body?.error === "REAUTH_REQUIRED") setNeedsGoogle(true);
      setError(authErrorMessage({ code: body?.error, status: response?.status }, isPl));
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
      <p className="text-[13px] leading-[1.5] text-[var(--chan-body)]">
        {isPl
          ? "Usunięcie konta jest nieodwracalne. Wpisz USUŃ, aby potwierdzić."
          : "Deleting your account is permanent. Type DELETE to confirm."}
      </p>
      {hasPassword && (
        <Field label={isPl ? "Twoje hasło" : "Your password"} type="password" value={password} onChange={setPassword} autoComplete="current-password" />
      )}
      <Field label={`${isPl ? "Wpisz" : "Type"} ${CONFIRM_WORD}`} value={confirm} onChange={setConfirm} />
      {needsGoogle && (
        <button type="button" onClick={confirmWithGoogle} className="text-[12px] font-bold underline hover:text-[var(--chan-ink)]">
          {isPl ? "Potwierdź przez Google" : "Confirm with Google"}
        </button>
      )}
      <button
        type="submit"
        disabled={loading || confirm !== CONFIRM_WORD || hasPassword === null || (hasPassword && !password)}
        className="flex h-[44px] w-full items-center justify-center rounded-[12px] bg-red-600 font-brand text-[15px] font-bold text-white transition-all hover:-translate-y-px active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>{isPl ? "Usuń konto na zawsze" : "Delete account permanently"}</span>}
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
        className="w-full rounded-[12px] border border-[var(--chan-line)] bg-[var(--chan-surface)] px-3 py-2 font-sans text-[15px] text-[var(--chan-ink)] outline-none transition-colors focus-visible:border-[var(--chan-blue)] focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
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
