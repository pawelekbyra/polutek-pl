"use client";

// "Hasło" / "Security" tab of the account panel: password (change, or set one by e-mail link when
// the account only has Google), TOTP two-step verification and the list of signed-in devices.

import React, { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Feedback, Field, Primary, ReauthNotice, useAccountUser } from "./AccountSections";
import { TurnstileWidget, useCaptchaRequired, type TurnstileHandle } from "./TurnstileWidget";
import { authClient, captchaFetchOptions } from "@/lib/auth/client";
import { authErrorMessage, isSessionNotFresh } from "@/lib/auth/errors";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/config";
import { refreshSession } from "@/lib/auth/react";

type Msg = { error: string | null; info: string | null };
const EMPTY: Msg = { error: null, info: null };

function PasswordPart({ isPl, hasPassword }: { isPl: boolean; hasPassword: boolean }) {
  const user = useAccountUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<Msg>(EMPTY);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileHandle>(null);
  const captchaRequired = useCaptchaRequired();

  async function change(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(EMPTY);
    const { error } = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
    setLoading(false);
    if (error) return setMsg({ error: authErrorMessage(error, isPl), info: null });
    setCurrentPassword("");
    setNewPassword("");
    setMsg({ error: null, info: isPl ? "Hasło zmienione. Pozostałe urządzenia wylogowano." : "Password changed. Other devices were signed out." });
  }

  async function sendSetLink() {
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) return;
    setLoading(true);
    setMsg(EMPTY);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
      fetchOptions: captchaFetchOptions(captchaToken),
    });
    setLoading(false);
    captchaRef.current?.reset();
    if (error) return setMsg({ error: authErrorMessage(error, isPl), info: null });
    setMsg({ error: null, info: isPl ? "Wysłaliśmy link do ustawienia hasła na Twój e-mail." : "We sent a link to set a password to your email." });
  }

  if (!hasPassword) {
    return (
      <div className="space-y-3">
        <Feedback error={msg.error} info={msg.info} />
        <p className="text-[13px] text-[var(--chan-body)]">
          {isPl ? "Logujesz się przez Google i nie masz jeszcze hasła. Możesz je ustawić linkiem wysłanym na e-mail." : "You sign in with Google and have no password yet. You can set one with a link sent to your email."}
        </p>
        <TurnstileWidget ref={captchaRef} onToken={setCaptchaToken} isPl={isPl} />
        <button
          type="button"
          onClick={sendSetLink}
          disabled={loading || (captchaRequired && !captchaToken)}
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

function TwoFactorPart({ isPl, hasPassword }: { isPl: boolean; hasPassword: boolean }) {
  const user = useAccountUser();
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<{ uri: string; backupCodes: string[] } | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<Msg>(EMPTY);

  if (!hasPassword) {
    return (
      <p className="text-[13px] text-[var(--chan-muted)]">
        {isPl ? "Weryfikacja dwuetapowa wymaga hasła. Ustaw je powyżej." : "Two-step verification needs a password. Set one above."}
      </p>
    );
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(EMPTY);
    const { data, error } = await authClient.twoFactor.enable({ password });
    setLoading(false);
    if (error || !data || !("totpURI" in data)) return setMsg({ error: authErrorMessage(error, isPl), info: null });
    setSetup({ uri: data.totpURI, backupCodes: data.backupCodes });
    setPassword("");
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(EMPTY);
    const { error } = await authClient.twoFactor.verifyTotp({ code: code.trim() });
    setLoading(false);
    if (error) return setMsg({ error: authErrorMessage(error, isPl), info: null });
    setSetup(null);
    setCode("");
    await refreshSession();
    setMsg({ error: null, info: isPl ? "Weryfikacja dwuetapowa włączona." : "Two-step verification is on." });
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(EMPTY);
    const { error } = await authClient.twoFactor.disable({ password });
    setLoading(false);
    if (error) return setMsg({ error: authErrorMessage(error, isPl), info: null });
    setPassword("");
    await refreshSession();
    setMsg({ error: null, info: isPl ? "Weryfikacja dwuetapowa wyłączona." : "Two-step verification is off." });
  }

  if (setup) {
    return (
      <form onSubmit={confirm} className="space-y-3">
        <Feedback error={msg.error} info={msg.info} />
        <p className="text-[13px] text-[var(--chan-body)]">
          {isPl ? "Zeskanuj kod w aplikacji uwierzytelniającej, a potem wpisz 6-cyfrowy kod." : "Scan the code in an authenticator app, then enter the 6-digit code."}
        </p>
        <div className="flex justify-center rounded-lg bg-white p-3"><QRCodeSVG value={setup.uri} size={160} /></div>
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--chan-muted)]">{isPl ? "Kody zapasowe (zapisz je)" : "Backup codes (save them)"}</p>
          <p className="break-all rounded-lg bg-[var(--chan-surface)] px-3 py-2 font-mono text-[12px]">{setup.backupCodes.join("  ")}</p>
        </div>
        <Field label={isPl ? "Kod z aplikacji" : "Code from the app"} value={code} onChange={setCode} inputMode="numeric" autoComplete="one-time-code" />
        <Primary loading={loading} label={isPl ? "Włącz" : "Turn on"} />
      </form>
    );
  }

  return (
    <form onSubmit={user.twoFactorEnabled ? disable : start} className="space-y-3 border-t border-[var(--chan-line)] pt-3">
      <Feedback error={msg.error} info={msg.info} />
      <p className="text-[13px] font-bold text-[var(--chan-ink)]">
        {isPl ? "Weryfikacja dwuetapowa (TOTP)" : "Two-step verification (TOTP)"}: {user.twoFactorEnabled ? (isPl ? "włączona" : "on") : (isPl ? "wyłączona" : "off")}
      </p>
      <Field label={isPl ? "Hasło" : "Password"} type="password" value={password} onChange={setPassword} autoComplete="current-password" />
      <Primary loading={loading} label={user.twoFactorEnabled ? (isPl ? "Wyłącz" : "Turn off") : (isPl ? "Włącz" : "Turn on")} />
    </form>
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
    const [list, current] = await Promise.all([authClient.listSessions(), authClient.getSession()]);
    if (list.error) {
      setSessions([]);
      return report(list.error);
    }
    setNeedsReauth(false);
    setSessions((list.data as DeviceSession[] | null) ?? []);
    setCurrentToken(current.data?.session?.token ?? null);
  }

  useEffect(() => {
    void load();
  }, []);

  async function revoke(token: string) {
    const { error } = await authClient.revokeSession({ token });
    if (error) return report(error);
    await load();
  }

  async function revokeOthers() {
    const { error } = await authClient.revokeOtherSessions();
    if (error) return report(error);
    setMsg({ error: null, info: isPl ? "Wylogowano pozostałe urządzenia." : "Other devices were signed out." });
    await load();
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
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  useEffect(() => {
    void authClient.listAccounts().then(({ data }) => {
      setHasPassword(Boolean(data?.some((a: { providerId: string }) => a.providerId === "credential")));
    });
  }, []);

  if (hasPassword === null) return null;
  return (
    <div className="space-y-4">
      <PasswordPart isPl={isPl} hasPassword={hasPassword} />
      <TwoFactorPart isPl={isPl} hasPassword={hasPassword} />
      <SessionsPart isPl={isPl} />
    </div>
  );
}
