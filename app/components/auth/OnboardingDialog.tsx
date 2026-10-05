"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "../LanguageContext";
import LanguageSwitcher from "../LanguageSwitcher";
import { useSwitchLanguage } from "../useSwitchLanguage";
import { Field, PrimaryButton } from "./AuthFormParts";
import { signOutCompletely } from "@/lib/auth/sign-out";
import { refreshSession, useUser } from "@/lib/auth/react";
import { avatarProblemMessage, validateAvatarFile, AVATAR_ACCEPT, DEFAULT_AVATAR_URL } from "@/lib/auth/avatar";
import { fileToAvatarDataUrl } from "@/lib/auth/avatar-client";
import { authErrorMessage } from "@/lib/auth/errors";
import { checkNicknameAvailability, nicknameCheckMessage, nicknameProblemMessage, validateNickname } from "@/lib/auth/nickname";

/**
 * First sign-in with Google: the provider name is only a placeholder, so the new user picks the
 * nickname shown on the site (and optionally an avatar) before using the account. It cannot be
 * dismissed; the only other way out is signing out.
 */
export default function OnboardingDialog() {
  const { user } = useUser();
  const { language } = useLanguage();
  const router = useRouter();
  const switchLanguage = useSwitchLanguage();
  const { tx } = useLanguage();
  const [nickname, setNickname] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!user?.onboardingPending) return null;

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setAvatarDataUrl(null);
      return;
    }
    const avatarProblem = validateAvatarFile(file);
    if (avatarProblem) {
      e.target.value = "";
      setAvatarDataUrl(null);
      setProblem(avatarProblemMessage(avatarProblem, tx));
      return;
    }
    try {
      setProblem(null);
      setAvatarDataUrl(await fileToAvatarDataUrl(file));
    } catch {
      setProblem(avatarProblemMessage("type", tx));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateNickname(nickname);
    if (!validation.ok) return setProblem(nicknameProblemMessage(validation.reason, tx));
    setSaving(true);
    setProblem(null);
    const check = await checkNicknameAvailability(validation.value);
    if (!check.available) {
      setSaving(false);
      return setProblem(nicknameCheckMessage(check.reason, tx));
    }
    const response = await fetch("/api/user/first-sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: validation.value, avatarDataUrl, language }),
    }).catch(() => null);
    if (!response) {
      setSaving(false);
      return setProblem(authErrorMessage({ code: "NETWORK_ERROR" }, tx));
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setSaving(false);
      if (body?.error !== "ONBOARDING_DONE") {
        return setProblem(authErrorMessage({ code: body?.error, status: response.status }, tx));
      }
      // Finished in another tab: just pick up the session state instead of showing an error.
    }
    try {
      await refreshSession();
      router.refresh();
    } catch {
      // Saved on the server; only re-reading the session failed (audit AUTH-08). A reload picks it up.
      setSaving(false);
      setProblem(authErrorMessage({ code: "NETWORK_ERROR" }, tx));
    }
  }

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent showCloseButton={false} className="max-w-sm border-none bg-transparent p-0 shadow-none">
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] px-6 py-7 shadow-[0_20px_50px_rgba(23,23,23,0.14)]">
          <DialogHeader>
            <DialogTitle className="font-brand text-xl font-bold text-[var(--chan-ink)]">{tx("Witaj!", "Welcome!")}</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-[var(--chan-muted)]">
            {tx("Wybierz pseudonim. To nazwa widoczna na stronie, np. przy Twoich komentarzach.", "Choose a nickname. It is the name shown on the site, e.g. with your comments.")}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <span className="text-[12px] font-semibold text-[var(--chan-ink)]">
              {tx("Język strony i wiadomości e-mail", "Site and e-mail language")}
            </span>
            <LanguageSwitcher variant="inline" language={language} onSelect={switchLanguage} />
          </div>
          <Field label={tx("Pseudonim", "Nickname")} type="text" value={nickname} onChange={setNickname} autoComplete="nickname" required />
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarDataUrl ?? DEFAULT_AVATAR_URL} alt="" className="h-14 w-14 shrink-0 rounded-full border border-[var(--chan-line)] bg-black object-cover" />
            <label className="block flex-1 text-[12px] font-semibold text-[var(--chan-ink)]">
              {tx("Avatar (opcjonalnie)", "Avatar (optional)")}
              <input
                type="file"
                accept={AVATAR_ACCEPT}
                onChange={onAvatar}
                className="mt-1 block w-full text-xs font-normal file:mr-2 file:rounded-full file:border-0 file:bg-[var(--chan-surface)] file:px-3 file:py-1.5 file:text-xs file:font-semibold"
              />
            </label>
          </div>
          {problem && <p role="alert" className="text-xs text-red-600">{problem}</p>}
          <PrimaryButton loading={saving} label={tx("Zapisz i wejdź", "Save and continue")} />
          <button
            type="button"
            onClick={() => void signOutCompletely().then(() => router.refresh())}
            className="w-full text-center text-[12px] text-[var(--chan-muted)] underline"
          >
            {tx("Wyloguj się", "Sign out")}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
