"use client";

// "Klucze dostępu" / "Passkeys" tab of the account panel: list, add and remove passkeys (WebAuthn).
// Adding and removing need a fresh session (Better Auth freshAge); an older one gets SESSION_NOT_FRESH
// and the "sign in again" notice. A new account is never created by a passkey: it is added here,
// after signing in with a password or Google.

import React, { useEffect, useState } from "react";
import { Feedback, Field, Primary, ReauthNotice } from "./AccountSections";
import { authClient } from "@/lib/auth/client";
import { isPasskeyCancelled, isSessionNotFresh, passkeyErrorMessage } from "@/lib/auth/errors";
import { defaultPasskeyName, usePasskeySupport } from "@/lib/auth/passkey-support";
import { PASSKEY_NAME_MAX_LENGTH } from "@/lib/auth/config";

type PasskeyRow = { id: string; name?: string | null; createdAt?: Date | string | null };
type Msg = { error: string | null; info: string | null };
type ErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

const EMPTY: Msg = { error: null, info: null };
const NETWORK_ERROR = { code: "NETWORK_ERROR" } as const;

function formatDate(value: PasskeyRow["createdAt"], isPl: boolean) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(isPl ? "pl-PL" : "en-GB");
}

export function PasskeysSection({ isPl }: { isPl: boolean }) {
  const supported = usePasskeySupport();
  const [passkeys, setPasskeys] = useState<PasskeyRow[] | null>(null);
  // Only rendered in the browser (inside the open account dialog), so navigator is available.
  const [name, setName] = useState(() => (typeof navigator === "undefined" ? "" : defaultPasskeyName(navigator.userAgent)));
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<Msg>(EMPTY);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function report(error: ErrorLike) {
    if (isSessionNotFresh(error)) return setNeedsReauth(true);
    if (isPasskeyCancelled(error)) return;
    setMsg({ error: passkeyErrorMessage(error, isPl), info: null });
  }

  const [listVersion, setListVersion] = useState(0);
  const load = () => setListVersion((n) => n + 1);

  useEffect(() => {
    let current = true;
    authClient.passkey
      .listUserPasskeys()
      .then(({ data, error }) => {
        if (!current) return;
        if (error) return report(error);
        setPasskeys((data as PasskeyRow[] | null) ?? []);
      })
      .catch(() => {
        if (current) report(NETWORK_ERROR);
      });
    return () => {
      current = false;
    };
    // `report` only reads isPl for the message text; a reload is driven by listVersion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listVersion]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(EMPTY);
    setNeedsReauth(false);
    try {
      const { error } = await authClient.passkey.addPasskey({ name: name.trim() || undefined });
      if (error) return report(error);
      setMsg({ error: null, info: isPl ? "Klucz dostępu dodany. Możesz nim logować się bez hasła." : "Passkey added. You can now sign in with it, no password needed." });
      load();
    } catch {
      report(NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    setMsg(EMPTY);
    setNeedsReauth(false);
    setConfirmId(null);
    try {
      const { error } = await authClient.passkey.deletePasskey({ id });
      if (error) return report(error);
      setMsg({ error: null, info: isPl ? "Klucz dostępu usunięty." : "Passkey removed." });
      load();
    } catch {
      report(NETWORK_ERROR);
    }
  }

  return (
    <div className="space-y-3">
      <Feedback error={msg.error} info={msg.info} />
      {needsReauth && <ReauthNotice isPl={isPl} />}
      <p className="text-[13px] leading-[1.5] text-[var(--chan-body)]">
        {isPl
          ? "Klucz dostępu (passkey) to logowanie odciskiem palca, twarzą albo PIN-em urządzenia, bez hasła i bez kodu z aplikacji. Klucz prywatny nie opuszcza Twojego urządzenia."
          : "A passkey lets you sign in with your fingerprint, face or device PIN, with no password and no app code. The private key never leaves your device."}
      </p>

      {passkeys && (
        <ul className="space-y-2" aria-label={isPl ? "Twoje klucze dostępu" : "Your passkeys"}>
          {passkeys.map((p) => {
            const added = formatDate(p.createdAt, isPl);
            const label = p.name?.trim() || (isPl ? "Klucz dostępu" : "Passkey");
            return (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--chan-line)] px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{label}</p>
                  {added && <p className="text-[11px] text-[var(--chan-muted)]">{isPl ? `Dodano ${added}` : `Added ${added}`}</p>}
                </div>
                {confirmId === p.id ? (
                  <span className="flex shrink-0 gap-3">
                    <button type="button" onClick={() => void remove(p.id)} className="text-[12px] font-bold text-red-600 hover:underline">
                      {isPl ? "Tak, usuń" : "Yes, remove"}
                    </button>
                    <button type="button" onClick={() => setConfirmId(null)} className="text-[12px] font-bold text-[var(--chan-muted)] hover:underline">
                      {isPl ? "Anuluj" : "Cancel"}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(p.id)}
                    aria-label={isPl ? `Usuń klucz ${label}` : `Remove passkey ${label}`}
                    className="shrink-0 text-[12px] font-bold text-red-600 hover:underline"
                  >
                    {isPl ? "Usuń" : "Remove"}
                  </button>
                )}
              </li>
            );
          })}
          {passkeys.length === 0 && (
            <li className="text-[13px] text-[var(--chan-muted)]">{isPl ? "Nie masz jeszcze klucza dostępu." : "You have no passkeys yet."}</li>
          )}
        </ul>
      )}

      {supported === false && (
        <p className="text-[13px] text-[var(--chan-muted)]">
          {isPl ? "Ta przeglądarka nie obsługuje kluczy dostępu." : "This browser does not support passkeys."}
        </p>
      )}
      {supported && (
        <form onSubmit={add} className="space-y-3 border-t border-[var(--chan-line)] pt-3">
          <Field
            label={isPl ? "Nazwa urządzenia (opcjonalnie)" : "Device name (optional)"}
            value={name}
            onChange={(value) => setName(value.slice(0, PASSKEY_NAME_MAX_LENGTH))}
            autoComplete="off"
          />
          <Primary loading={loading} label={isPl ? "Dodaj klucz dostępu" : "Add a passkey"} />
        </form>
      )}
    </div>
  );
}
