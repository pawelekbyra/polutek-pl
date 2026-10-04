"use client";

// "Hasło" / "Security" tab of the account panel: password (change, or set one by e-mail link when
// the account only has Google), TOTP two-step verification and the list of signed-in devices.

import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Feedback, Field, Primary, ReauthNotice, useAccountUser, useHasPassword } from "./AccountSections";
import { useCaptchaGate } from "./useCaptchaGate";
import { authClient, captchaFetchOptions } from "@/lib/auth/client";
import { authErrorMessage, isSessionNotFresh } from "@/lib/auth/errors";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/config";
import { refreshSession } from "@/lib/auth/react";

type Msg = { error: string | null; info: string | null };
const EMPTY: Msg = { error: null, info: null };
const NETWORK_ERROR = { code: "NETWORK_ERROR" } as const;

/**
 * Runs one account action (audit AUTH-08): the spinner always stops, and a dropped connection (the auth
 * client throws on network errors) ends in a readable message instead of a button that spins for ever.
 */
async function guarded(
  setLoading: (value: boolean) => void,
  setMsg: (msg: Msg) => void,
  isPl: boolean,
  task: () => Promise<void>,
) {
  setLoading(true);
  setMsg(EMPTY);
  try {
    await task();
  } catch {
    setMsg({ error: authErrorMessage(NETWORK_ERROR, isPl), info: null });
  } finally {
    setLoading(false);
  }
}

function PasswordPart({ isPl, hasPassword }: { isPl: boolean; hasPassword: boolean }) {
  const user = useAccountUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<Msg>(EMPTY);
  const captchaGate = useCaptchaGate(isPl);

  function change(e: React.FormEvent) {
    e.preventDefault();
    return guarded(setLoading, setMsg, isPl, async () => {
      const { error } = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
      if (error) return setMsg({ error: authErrorMessage(error, isPl), info: null });
      setCurrentPassword("");
      setNewPassword("");
      setMsg({ error: null, info: isPl ? "Hasło zmienione. Pozostałe urządzenia wylogowano." : "Password changed. Other devices were signed out." });
    });
  }

  function sendSetLink() {
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email || !captchaGate.ready(sendSetLink)) return;
    return guarded(setLoading, setMsg, isPl, async () => {
      try {
        const { error } = await authClient.requestPasswordReset({
          email,
          redirectTo: "/reset-password",
          fetchOptions: captchaFetchOptions(captchaGate.token()),
        });
        if (error) return setMsg({ error: authErrorMessage(error, isPl), info: null });
        setMsg({ error: null, info: isPl ? "Wysłaliśmy link do ustawienia hasła na Twój e-mail." : "We sent a link to set a password to your email." });
      } finally {
        captchaGate.reset();
      }
    });
  }

  if (!hasPassword) {
    return (
      <div className="space-y-3">
        <Feedback error={msg.error} info={msg.info} />
        <p className="text-[13px] text-[var(--chan-body)]">
          {isPl ? "Logujesz się przez Google i nie masz jeszcze hasła. Możesz je ustawić linkiem wysłanym na e-mail." : "You sign in with Google and have no password yet. You can set one with a link sent to your email."}
        </p>
        {captchaGate.widget}
        <button
          type="button"
          onClick={sendSetLink}
          disabled={loading || captchaGate.waiting}
          className="flex h-[44px] w-full items-center justify-center rounded-[12px] bg-[var(--chan-blue)] font-brand text-[15px] font-bold text-white disabled:opacity-60"
        >
          {isPl ? "Wyślij link" : "Send link"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={change} className="space-y-3">
      <Feedback error={msg.error} info={msg.info} />
      <Field label={isPl ? "Obecne hasło" : "Current password"} type="password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
      <Field label={isPl ? `Nowe hasło (min. ${PASSWORD_MIN_LENGTH} znaków)` : `New password (min. ${PASSWORD_MIN_LENGTH} characters)`} type="password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
      <Primary loading={loading} label={isPl ? "Zmień hasło" : "Change password"} />
    </form>
  );
}

/** Backup codes with copy and download, shown right after they were generated (they cannot be read again). */
function BackupCodesBox({ codes, isPl }: { codes: string[]; isPl: boolean }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([`${text}\n`],{ type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "pawelperfect-backup-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--chan-muted)]">
        {isPl ? "Kody zapasowe (zapisz je, każdy działa raz)" : "Backup codes (save them, each works once)"}
      </p>
      <p className="break-all rounded-lg bg-[var(--chan-surface)] px-3 py-2 font-mono text-[12px]">{codes.join("  ")}</p>
      <div className="mt-2 flex gap-3 text-[12px] font-bold">
        <button type="button" onClick={copy} className="underline hover:text-[var(--chan-ink)]">
          {copied ? (isPl ? "Skopiowano" : "Copied") : (isPl ? "Kopiuj" : "Copy")}
        </button>
        <button type="button" onClick={download} className="underline hover:text-[var(--chan-ink)]">
          {isPl ? "Pobierz" : "Download"}
        </button>
      </div>
    </div>
  );
}

export function TwoFactorPart({ isPl, hasPassword }: { isPl: boolean; hasPassword: boolean }) {
  const user = useAccountUser();
  // One password field per action (audit AUTH-13): typing the password to get new backup codes and
  // pressing Enter must never turn two-step verification off.
  const [enablePassword, setEnablePassword] = useState("");
  const [codesPassword, setCodesPassword] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [setup, setSetup] = useState<{ uri: string; backupCodes: string[] } | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<Msg>(EMPTY);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  if (!hasPassword) {
    return (
      <p className="text-[13px] text-[var(--chan-muted)]">
        {isPl
          ? "Weryfikacja dwuetapowa dotyczy logowania hasłem. Ustaw hasło powyżej (link przyjdzie na e-mail), a potem będziesz mógł ją włączyć. Logowanie przez Google korzysta z zabezpieczeń Twojego konta Google."
          : "Two-step verification protects password sign-in. Set a password above (a link is sent to your email), then you can turn it on. Signing in with Google uses your Google account's own protection."}
      </p>
    );
  }

  function start(e: React.FormEvent) {
    e.preventDefault();
    return guarded(setLoading, setMsg, isPl, async () => {
      const { data, error } = await authClient.twoFactor.enable({ password: enablePassword });
      if (error || !data || !("totpURI" in data)) return setMsg({ error: authErrorMessage(error, isPl), info: null });
      setSetup({ uri: data.totpURI, backupCodes: data.backupCodes });
      setEnablePassword("");
    });
  }

  function confirm(e: React.FormEvent) {
    e.preventDefault();
    return guarded(setLoading, setMsg, isPl, async () => {
      const { error } = await authClient.twoFactor.verifyTotp({ code: code.trim() });
      if (error) return setMsg({ error: authErrorMessage(error, isPl), info: null });
      setSetup(null);
      setCode("");
      await refreshSession();
      setMsg({ error: null, info: isPl ? "Weryfikacja dwuetapowa włączona." : "Two-step verification is on." });
    });
  }

  function regenerateCodes(e: React.FormEvent) {
    e.preventDefault();
    return guarded(setLoading, setMsg, isPl, async () => {
      const { data, error } = await authClient.twoFactor.generateBackupCodes({ password: codesPassword });
      if (error || !data) return setMsg({ error: authErrorMessage(error, isPl), info: null });
      setCodesPassword("");
      setNewCodes(data.backupCodes);
      setMsg({ error: null, info: isPl ? "Wygenerowano nowe kody. Poprzednie przestały działać." : "New codes generated. The old ones no longer work." });
    });
  }

  function disable(e: React.FormEvent) {
    e.preventDefault();
    return guarded(setLoading, setMsg, isPl, async () => {
      const { error } = await authClient.twoFactor.disable({ password: disablePassword });
      if (error) return setMsg({ error: authErrorMessage(error, isPl), info: null });
      setDisablePassword("");
      setNewCodes(null);
      await refreshSession();
      setMsg({ error: null, info: isPl ? "Weryfikacja dwuetapowa wyłączona." : "Two-step verification is off." });
    });
  }

  if (setup) {
    return (
      <form onSubmit={confirm} className="space-y-3">
        <Feedback error={msg.error} info={msg.info} />
        <p className="text-[13px] text-[var(--chan-body)]">
          {isPl ? "Zeskanuj kod w aplikacji uwierzytelniającej, a potem wpisz 6-cyfrowy kod." : "Scan the code in an authenticator app, then enter the 6-digit code."}
        </p>
        <div className="flex justify-center rounded-lg bg-white p-3"><QRCodeSVG value={setup.uri} size={160} /></div>
        <BackupCodesBox codes={setup.backupCodes} isPl={isPl} />
        <Field label={isPl ? "Kod z aplikacji" : "Code from the app"} value={code} onChange={setCode} inputMode="numeric" autoComplete="one-time-code" />
        <Primary loading={loading} label={isPl ? "Włącz" : "Turn on"} />
      </form>
    );
  }

  const status = (
    <p className="text-[13px] font-bold text-[var(--chan-ink)]">
      {isPl ? "Weryfikacja dwuetapowa (TOTP)" : "Two-step verification (TOTP)"}: {user.twoFactorEnabled ? (isPl ? "włączona" : "on") : (isPl ? "wyłączona" : "off")}
    </p>
  );

  if (!user.twoFactorEnabled) {
    return (
      <form onSubmit={start} className="space-y-3 border-t border-[var(--chan-line)] pt-3">
        <Feedback error={msg.error} info={msg.info} />
        {status}
        <Field label={isPl ? "Hasło" : "Password"} type="password" value={enablePassword} onChange={setEnablePassword} autoComplete="current-password" />
        <Primary loading={loading} label={isPl ? "Włącz" : "Turn on"} />
      </form>
    );
  }

  return (
    <div className="space-y-3 border-t border-[var(--chan-line)] pt-3">
      <Feedback error={msg.error} info={msg.info} />
      {status}
      <form onSubmit={regenerateCodes} aria-label={isPl ? "Nowe kody zapasowe" : "New backup codes"} className="space-y-2">
        {newCodes && <BackupCodesBox codes={newCodes} isPl={isPl} />}
        <Field label={isPl ? "Hasło do nowych kodów zapasowych" : "Password for new backup codes"} type="password" value={codesPassword} onChange={setCodesPassword} autoComplete="current-password" />
        <Primary loading={loading} label={isPl ? "Wygeneruj nowe kody zapasowe" : "Generate new backup codes"} />
      </form>
      <form onSubmit={disable} aria-label={isPl ? "Wyłącz weryfikację dwuetapową" : "Turn off two-step verification"} className="space-y-2 border-t border-[var(--chan-line)] pt-3">
        <Field label={isPl ? "Hasło do wyłączenia weryfikacji" : "Password to turn verification off"} type="password" value={disablePassword} onChange={setDisablePassword} autoComplete="current-password" />
        <button
          type="submit"
          disabled={loading || !disablePassword}
          className="flex h-[44px] w-full items-center justify-center rounded-[12px] border border-red-600 font-brand text-[15px] font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          {isPl ? "Wyłącz weryfikację dwuetapową" : "Turn off two-step verification"}
        </button>
      </form>
    </div>
  );
}

type DeviceSession = { id: string; token: string; userAgent?: string | null; ipAddress?: string | null; updatedAt: Date | string };

function SessionsPart({ isPl }: { isPl: boolean }) {
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(EMPTY);
  const [needsReauth, setNeedsReauth] = useState(false);

  // Better Auth only lists/revokes devices for a session younger than `freshAge`; an older one gets
  // SESSION_NOT_FRESH and must sign in again (never a silently empty list).
  function report(error: { code?: string; message?: string; status?: number }) {
    if (isSessionNotFresh(error)) return setNeedsReauth(true);
    setMsg({ error: authErrorMessage(error, isPl), info: null });
  }

  async function load() {
    try {
      const [list, current] = await Promise.all([authClient.listSessions(), authClient.getSession()]);
      if (list.error) {
        setSessions([]);
        return report(list.error);
      }
      setNeedsReauth(false);
      setSessions((list.data as DeviceSession[] | null) ?? []);
      setCurrentToken(current.data?.session?.token ?? null);
    } catch {
      setSessions([]);
      report(NETWORK_ERROR);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function revoke(token: string) {
    try {
      const { error } = await authClient.revokeSession({ token });
      if (error) return report(error);
      await load();
    } catch {
      report(NETWORK_ERROR);
    }
  }

  async function revokeOthers() {
    try {
      const { error } = await authClient.revokeOtherSessions();
      if (error) return report(error);
      setMsg({ error: null, info: isPl ? "Wylogowano pozostałe urządzenia." : "Other devices were signed out." });
      await load();
    } catch {
      report(NETWORK_ERROR);
    }
  }

  return (
    <div className="space-y-2 border-t border-[var(--chan-line)] pt-3">
      <Feedback error={msg.error} info={msg.info} />
      {needsReauth && <ReauthNotice isPl={isPl} />}
      <p className="text-[13px] font-bold text-[var(--chan-ink)]">{isPl ? "Zalogowane urządzenia" : "Signed-in devices"}</p>
      <ul className="space-y-2">
        {(sessions ?? []).map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--chan-line)] px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{(s.userAgent || (isPl ? "Nieznane urządzenie" : "Unknown device")).slice(0, 60)}</p>
              <p className="text-[11px] text-[var(--chan-muted)]">
                {s.token === currentToken ? (isPl ? "To urządzenie" : "This device") : new Date(s.updatedAt).toLocaleString(isPl ? "pl-PL" : "en-GB")}
              </p>
            </div>
            {s.token !== currentToken && (
              <button type="button" onClick={() => revoke(s.token)} className="shrink-0 text-[12px] font-bold text-red-600 hover:underline">
                {isPl ? "Wyloguj" : "Sign out"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {sessions && sessions.length > 1 && (
        <button type="button" onClick={revokeOthers} className="text-[12px] font-bold underline hover:text-[var(--chan-ink)]">
          {isPl ? "Wyloguj pozostałe urządzenia" : "Sign out other devices"}
        </button>
      )}
    </div>
  );
}

export function SecuritySection({ isPl }: { isPl: boolean }) {
  const { hasPassword, failed, retry } = useHasPassword();

  if (failed) {
    return (
      <div role="alert" className="space-y-2 rounded-lg bg-red-50 px-3 py-2">
        <p className="text-[13px] font-semibold text-red-600">{authErrorMessage(NETWORK_ERROR, isPl)}</p>
        <button type="button" onClick={retry} className="text-[12px] font-bold text-red-700 underline">
          {isPl ? "Spróbuj ponownie" : "Try again"}
        </button>
      </div>
    );
  }
  if (hasPassword === null) return null;
  return (
    <div className="space-y-4">
      <PasswordPart isPl={isPl} hasPassword={hasPassword} />
      <TwoFactorPart isPl={isPl} hasPassword={hasPassword} />
      <SessionsPart isPl={isPl} />
    </div>
  );
}
