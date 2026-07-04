"use client";

// Account panel sections for AccountModal, split out to keep each module within the repo's
// file-size hotspot budget. All operations use Clerk's headless UserResource (useUser/user.*).

import React, { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Loader2 } from "../icons";
import { Frame, INK, BLUE } from "../najs/primitives";
import { OAUTH_PROVIDERS, useVisibleOAuthProviders, type OAuthStrategy } from "./oauth-providers";

function clerkErr(e: unknown, isPl: boolean): string {
  if (e && typeof e === "object" && "errors" in e) {
    const first = (e as { errors?: Array<{ longMessage?: string; message?: string }> }).errors?.[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }
  return isPl ? "Coś poszło nie tak. Spróbuj ponownie." : "Something went wrong. Please try again.";
}

function useAccountUser() {
  const { user } = useUser();
  return user!;
}

function Feedback({ error, info }: { error: string | null; info: string | null }) {
  if (error) return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-600">{error}</p>;
  if (info) return <p className="rounded-lg bg-blue-50 px-3 py-2 text-[13px] font-semibold text-blue-700">{info}</p>;
  return null;
}

export function ProfileSection({ isPl }: { isPl: boolean }) {
  const user = useAccountUser();
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      await user.update({ firstName, ...(username ? { username } : {}) });
      setInfo(isPl ? "Zapisano." : "Saved.");
    } catch (err) {
      setError(clerkErr(err, isPl));
    } finally {
      setLoading(false);
    }
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setAvatarLoading(true);
    setError(null);
    setInfo(null);
    try {
      await user.setProfileImage({ file });
      await user.reload();
      setInfo(isPl ? "Zdjęcie zaktualizowane." : "Photo updated.");
    } catch (err) {
      setError(clerkErr(err, isPl));
    } finally {
      setAvatarLoading(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <Feedback error={error} info={info} />
      <div className="flex items-center gap-3">
        {/* Clerk-hosted avatar; plain img avoids next/image host config for the account panel. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.imageUrl}
          alt=""
          className="h-14 w-14 shrink-0 rounded-full border border-[#171717]/20 object-cover"
        />
        <label className="cursor-pointer text-[13px] font-bold ink-text underline hover:opacity-70">
          {avatarLoading ? (isPl ? "Wgrywanie..." : "Uploading...") : (isPl ? "Zmień zdjęcie" : "Change photo")}
          <input type="file" accept="image/*" className="hidden" onChange={onAvatar} disabled={avatarLoading} />
        </label>
      </div>
      <Field label={isPl ? "Nazwa" : "Name"} value={firstName} onChange={setFirstName} />
      <Field label={isPl ? "Nazwa użytkownika" : "Username"} value={username} onChange={setUsername} />
      <Primary loading={loading} label={isPl ? "Zapisz" : "Save"} />
    </form>
  );
}

export function EmailSection({ isPl }: { isPl: boolean }) {
  const user = useAccountUser();
  const [newEmail, setNewEmail] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function addEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const created = await user.createEmailAddress({ email: newEmail });
      await created.prepareVerification({ strategy: "email_code" });
      setPendingId(created.id);
      setInfo(isPl ? "Wysłaliśmy kod na nowy adres." : "We sent a code to the new address.");
      setNewEmail("");
    } catch (err) {
      setError(clerkErr(err, isPl));
    } finally {
      setLoading(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingId) return;
    setLoading(true);
    setError(null);
    try {
      const target = user.emailAddresses.find((a) => a.id === pendingId);
      await target?.attemptVerification({ code });
      await user.reload();
      setPendingId(null);
      setCode("");
      setInfo(isPl ? "Adres potwierdzony." : "Address verified.");
    } catch (err) {
      setError(clerkErr(err, isPl));
    } finally {
      setLoading(false);
    }
  }

  async function makePrimary(id: string) {
    setError(null);
    try {
      await user.update({ primaryEmailAddressId: id });
      await user.reload();
    } catch (err) {
      setError(clerkErr(err, isPl));
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      const target = user.emailAddresses.find((a) => a.id === id);
      await target?.destroy();
      await user.reload();
    } catch (err) {
      setError(clerkErr(err, isPl));
    }
  }

  return (
    <div className="space-y-3">
      <Feedback error={error} info={info} />
      <ul className="space-y-2">
        {user.emailAddresses.map((addr) => {
          const isPrimary = addr.id === user.primaryEmailAddressId;
          const verified = addr.verification?.status === "verified";
          return (
            <li key={addr.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#171717]/15 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold">{addr.emailAddress}</p>
                <p className="text-[11px] text-[#7a7a7a]">
                  {isPrimary ? (isPl ? "Główny" : "Primary") : verified ? (isPl ? "Potwierdzony" : "Verified") : (isPl ? "Niepotwierdzony" : "Unverified")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[12px]">
                {!isPrimary && verified && (
                  <button type="button" onClick={() => makePrimary(addr.id)} className="font-bold underline hover:text-[var(--najs-ink)]">
                    {isPl ? "Ustaw główny" : "Make primary"}
                  </button>
                )}
                {!isPrimary && (
                  <button type="button" onClick={() => remove(addr.id)} className="font-bold text-red-600 hover:underline">
                    {isPl ? "Usuń" : "Remove"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {pendingId ? (
        <form onSubmit={verify} className="space-y-3 border-t border-[#171717]/10 pt-3">
          <Field label={isPl ? "Kod z e-maila" : "Email code"} value={code} onChange={setCode} inputMode="numeric" />
          <Primary loading={loading} label={isPl ? "Potwierdź" : "Verify"} />
        </form>
      ) : (
        <form onSubmit={addEmail} className="space-y-3 border-t border-[#171717]/10 pt-3">
          <Field label={isPl ? "Dodaj adres e-mail" : "Add email address"} type="email" value={newEmail} onChange={setNewEmail} />
          <Primary loading={loading} label={isPl ? "Dodaj" : "Add"} />
        </form>
      )}
    </div>
  );
}

export function ConnectionsSection({ isPl }: { isPl: boolean }) {
  const user = useAccountUser();
  const [error, setError] = useState<string | null>(null);

  async function connect(strategy: OAuthStrategy) {
    setError(null);
    try {
      const returnTo = window.location.pathname + window.location.search;
      const ext = await user.createExternalAccount({ strategy, redirectUrl: returnTo });
      const url = ext.verification?.externalVerificationRedirectURL;
      if (url) window.location.href = url.toString();
    } catch (err) {
      setError(clerkErr(err, isPl));
    }
  }

  async function disconnect(id: string) {
    setError(null);
    try {
      const acc = user.externalAccounts.find((a) => a.id === id);
      await acc?.destroy();
      await user.reload();
    } catch (err) {
      setError(clerkErr(err, isPl));
    }
  }

  const visibleProviders = useVisibleOAuthProviders();
  const connectable = visibleProviders.filter(
    (p) => !user.externalAccounts.some((a) => a.provider === p.provider),
  );

  return (
    <div className="space-y-3">
      <Feedback error={error} info={null} />
      <ul className="space-y-2">
        {user.externalAccounts.map((acc) => {
          const known = OAUTH_PROVIDERS.find((p) => p.provider === acc.provider);
          return (
            <li key={acc.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#171717]/15 px-3 py-2">
              <div className="flex items-center gap-2">
                {known && <known.Icon className="h-[18px] w-[18px]" />}
                <p className="text-[14px] font-semibold capitalize">{known?.label ?? acc.provider}</p>
              </div>
              <button type="button" onClick={() => disconnect(acc.id)} className="text-[12px] font-bold text-red-600 hover:underline">
                {isPl ? "Odłącz" : "Disconnect"}
              </button>
            </li>
          );
        })}
        {user.externalAccounts.length === 0 && (
          <li className="text-[13px] text-[#7a7a7a]">{isPl ? "Brak połączonych kont." : "No connected accounts."}</li>
        )}
      </ul>
      {connectable.map(({ strategy, label, Icon }) => (
        <button
          key={strategy}
          type="button"
          onClick={() => connect(strategy)}
          className="relative flex h-[42px] w-full items-center justify-center gap-2 text-[14px] font-bold ink-text active:scale-[0.98]"
        >
          <Frame radius={11} seed={9} stroke={INK} strokeWidth={1.2} fill="#f1ead9" />
          <Icon className="relative z-10 h-[18px] w-[18px]" />
          <span className="relative z-10">{isPl ? `Połącz z ${label}` : `Connect ${label}`}</span>
        </button>
      ))}
    </div>
  );
}

export function SecuritySection({ isPl }: { isPl: boolean }) {
  const user = useAccountUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      await user.updatePassword({ currentPassword, newPassword, signOutOfOtherSessions: true });
      setInfo(isPl ? "Hasło zmienione." : "Password changed.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setError(clerkErr(err, isPl));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <Feedback error={error} info={info} />
      <Field label={isPl ? "Obecne hasło" : "Current password"} type="password" value={currentPassword} onChange={setCurrentPassword} />
      <Field label={isPl ? "Nowe hasło" : "New password"} type="password" value={newPassword} onChange={setNewPassword} />
      <Primary loading={loading} label={isPl ? "Zmień hasło" : "Change password"} />
    </form>
  );
}

export function DangerSection({ isPl, onDeleted }: { isPl: boolean; onDeleted: () => void }) {
  const user = useAccountUser();
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const CONFIRM_WORD = isPl ? "USUŃ" : "DELETE";

  async function del(e: React.FormEvent) {
    e.preventDefault();
    if (confirm !== CONFIRM_WORD) return;
    setLoading(true);
    setError(null);
    try {
      await user.delete();
      onDeleted();
    } catch (err) {
      setError(clerkErr(err, isPl));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={del} className="space-y-3">
      <Feedback error={error} info={null} />
      <p className="text-[13px] leading-[1.5] text-[#4a4a4a]">
        {isPl
          ? "Usunięcie konta jest nieodwracalne. Wpisz USUŃ, aby potwierdzić."
          : "Deleting your account is permanent. Type DELETE to confirm."}
      </p>
      <Field label={`${isPl ? "Wpisz" : "Type"} ${CONFIRM_WORD}`} value={confirm} onChange={setConfirm} />
      <button
        type="submit"
        disabled={loading || confirm !== CONFIRM_WORD}
        className="relative flex h-[44px] w-full items-center justify-center text-[15px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
      >
        <Frame radius={11} seed={5} stroke={INK} strokeWidth={1.4} fill="#dc2626" showShadow />
        {loading ? <Loader2 className="relative z-10 h-4 w-4 animate-spin" /> : <span className="relative z-10">{isPl ? "Usuń konto na zawsze" : "Delete account permanently"}</span>}
      </button>
    </form>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  inputMode,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#7a7a7a]">{label}</span>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#171717]/25 paper-surface px-3 py-2 text-[15px] ink-text outline-none transition-colors focus:border-[var(--najs-blue)]"
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      />
    </label>
  );
}

function Primary({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="relative flex h-[44px] w-full items-center justify-center text-[15px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60"
    >
      <Frame radius={11} seed={5} stroke={INK} strokeWidth={1.4} fill={BLUE} showShadow />
      {loading ? <Loader2 className="relative z-10 h-4 w-4 animate-spin" /> : <span className="relative z-10">{label}</span>}
    </button>
  );
}
