"use client";

import React, { useEffect, useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "../icons";
import { Frame, INK, BLUE } from "../najs/primitives";
import { useLanguage } from "../LanguageContext";

interface AccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}

type Section = "profile" | "email" | "connections" | "security" | "danger";

function clerkErr(e: unknown, isPl: boolean): string {
  if (e && typeof e === "object" && "errors" in e) {
    const first = (e as { errors?: Array<{ longMessage?: string; message?: string }> }).errors?.[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }
  return isPl ? "Coś poszło nie tak. Spróbuj ponownie." : "Something went wrong. Please try again.";
}

export default function AccountModal({ open, onOpenChange, isAdmin }: AccountModalProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { language } = useLanguage();
  const isPl = language === "pl";
  const [section, setSection] = useState<Section>("profile");

  useEffect(() => {
    if (open) setSection("profile");
  }, [open]);

  if (!user) return null;

  const sections: { id: Section; label: string }[] = [
    { id: "profile", label: isPl ? "Profil" : "Profile" },
    { id: "email", label: "E-mail" },
    { id: "connections", label: isPl ? "Konta" : "Connections" },
    { id: "security", label: isPl ? "Hasło" : "Security" },
    { id: "danger", label: isPl ? "Usuń" : "Delete" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden border-none bg-transparent p-0 shadow-none">
        <div className="relative p-6 sm:p-7" style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}>
          <Frame radius={18} seed={17} stroke={INK} strokeWidth={1.4} fill="#ffffff" />
          <div className="relative z-10">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight text-[#0f0f0f]">
                {isPl ? "Moje konto" : "My account"}
              </DialogTitle>
            </DialogHeader>

            <div className="mt-4 flex flex-wrap gap-1.5 border-b border-[#171717]/10 pb-3">
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSection(s.id)}
                  className={
                    "rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wide transition-colors " +
                    (section === s.id ? "bg-[#171717] text-white" : "text-[#7a7a7a] hover:bg-[#171717]/5")
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
              {section === "profile" && <ProfileSection isPl={isPl} />}
              {section === "email" && <EmailSection isPl={isPl} />}
              {section === "connections" && <ConnectionsSection isPl={isPl} />}
              {section === "security" && <SecuritySection isPl={isPl} />}
              {section === "danger" && <DangerSection isPl={isPl} onDeleted={() => onOpenChange(false)} />}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[#171717]/10 pt-4">
              {isAdmin ? (
                <a href="/admin" className="text-[13px] font-bold underline hover:text-[#0f0f0f]">
                  {isPl ? "Zarządzaj kanałem" : "Manage channel"}
                </a>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  void signOut();
                }}
                className="text-[13px] font-bold text-red-600 hover:underline"
              >
                {isPl ? "Wyloguj się" : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
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

function ProfileSection({ isPl }: { isPl: boolean }) {
  const user = useAccountUser();
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [loading, setLoading] = useState(false);
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

  return (
    <form onSubmit={save} className="space-y-3">
      <Feedback error={error} info={info} />
      <Field label={isPl ? "Nazwa" : "Name"} value={firstName} onChange={setFirstName} />
      <Field label={isPl ? "Nazwa użytkownika" : "Username"} value={username} onChange={setUsername} />
      <Primary loading={loading} label={isPl ? "Zapisz" : "Save"} />
    </form>
  );
}

function EmailSection({ isPl }: { isPl: boolean }) {
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
                  <button type="button" onClick={() => makePrimary(addr.id)} className="font-bold underline hover:text-[#0f0f0f]">
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

function ConnectionsSection({ isPl }: { isPl: boolean }) {
  const user = useAccountUser();
  const [error, setError] = useState<string | null>(null);

  async function connectGoogle() {
    setError(null);
    try {
      const returnTo = window.location.pathname + window.location.search;
      const ext = await user.createExternalAccount({ strategy: "oauth_google", redirectUrl: returnTo });
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

  const hasGoogle = user.externalAccounts.some((a) => a.provider === "google");

  return (
    <div className="space-y-3">
      <Feedback error={error} info={null} />
      <ul className="space-y-2">
        {user.externalAccounts.map((acc) => (
          <li key={acc.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#171717]/15 px-3 py-2">
            <p className="text-[14px] font-semibold capitalize">{acc.provider}</p>
            <button type="button" onClick={() => disconnect(acc.id)} className="text-[12px] font-bold text-red-600 hover:underline">
              {isPl ? "Odłącz" : "Disconnect"}
            </button>
          </li>
        ))}
        {user.externalAccounts.length === 0 && (
          <li className="text-[13px] text-[#7a7a7a]">{isPl ? "Brak połączonych kont." : "No connected accounts."}</li>
        )}
      </ul>
      {!hasGoogle && (
        <button
          type="button"
          onClick={connectGoogle}
          className="relative flex h-[42px] w-full items-center justify-center text-[14px] font-bold text-[#0f0f0f] active:scale-[0.98]"
        >
          <Frame radius={11} seed={9} stroke={INK} strokeWidth={1.2} fill="#ffffff" />
          <span className="relative z-10">{isPl ? "Połącz z Google" : "Connect Google"}</span>
        </button>
      )}
    </div>
  );
}

function SecuritySection({ isPl }: { isPl: boolean }) {
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

function DangerSection({ isPl, onDeleted }: { isPl: boolean; onDeleted: () => void }) {
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
        className="w-full rounded-lg border border-[#171717]/25 bg-white px-3 py-2 text-[15px] text-[#0f0f0f] outline-none transition-colors focus:border-[#2563eb]"
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
