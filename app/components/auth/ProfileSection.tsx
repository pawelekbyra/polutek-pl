"use client";

// "Profil" section of the account panel. The only name a user edits is the nickname
// ("Pseudonim"): the same rules and taken check as at sign-up (lib/auth/nickname.ts), saved to
// User.name through PATCH /api/user/nickname.

import React, { useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { Select } from "@base-ui/react/select";
import { useLanguage } from "../LanguageContext";
import { useSwitchLanguage } from "../useSwitchLanguage";
import LanguageFlag from "../language-switcher/LanguageFlag";
import { LANGUAGE_OPTIONS } from "../language-switcher/languages";
import type { Locale } from "@/lib/i18n/routing";
import {
  checkNicknameAvailability,
  isSameNickname,
  nicknameCheckMessage,
  nicknameProblemMessage,
  normalizeNickname,
  validateNickname,
} from "@/lib/auth/nickname";
import { Feedback, Field, Primary, useAccountUser } from "./AccountSections";
import { authErrorMessage } from "@/lib/auth/errors";
import { refreshSession } from "@/lib/auth/react";
import { avatarProblemMessage, validateAvatarFile } from "@/lib/auth/avatar";
import { fileToAvatarDataUrl } from "@/lib/auth/avatar-client";
import type { Tx } from "@/lib/i18n/ui";

function LanguageField({ tx }: { tx: Tx }) {
  const { language } = useLanguage();
  const switchLanguage = useSwitchLanguage();

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] px-4 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-[var(--chan-ink)]">{tx("Język", "Language")}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--chan-muted)]">
          {tx("Język interfejsu strony.", "Language used across the site.")}
        </p>
      </div>
      <Select.Root value={language} onValueChange={(value) => value && switchLanguage(value as Locale)}>
        <Select.Trigger
          aria-label={tx("Język interfejsu", "Interface language")}
          className="inline-flex h-9 min-w-[104px] shrink-0 items-center gap-1.5 rounded-lg border border-[var(--chan-line)] bg-[var(--chan-card)] px-2.5 text-[13px] font-semibold text-[var(--chan-ink)] outline-none transition-colors hover:bg-[var(--chan-surface)] focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
        >
          <Globe className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <Select.Value>
            {(value: Locale | null) => LANGUAGE_OPTIONS.find((option) => option.locale === value)?.label ?? "Polski"}
          </Select.Value>
          <Select.Icon><ChevronDown className="h-3.5 w-3.5 text-[var(--chan-muted)]" aria-hidden="true" /></Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner side="bottom" sideOffset={6} align="end" alignItemWithTrigger={false} className="z-[1200]">
            <Select.Popup className="max-h-(--available-height) min-w-[190px] overflow-hidden rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-1.5 text-[var(--chan-ink)] shadow-[0_20px_50px_rgba(15,23,42,0.2)]">
              <Select.List className="max-h-[min(60dvh,420px)] overflow-y-auto overscroll-contain">
                {LANGUAGE_OPTIONS.map((option) => (
                  <Select.Item
                    key={option.locale}
                    value={option.locale}
                    label={option.label}
                    lang={option.lang}
                    className="group flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-[13px] outline-none data-highlighted:bg-[var(--chan-surface)] data-selected:font-semibold data-selected:text-[var(--chan-blue)]"
                  >
                    <LanguageFlag option={option} size={22} />
                    <Select.ItemText className="min-w-0 flex-1 truncate">{option.label}</Select.ItemText>
                    <Select.ItemIndicator><Check className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" /></Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

export function ProfileSection({ tx }: { tx: Tx }) {
  const user = useAccountUser();
  const currentName = normalizeNickname(user.fullName ?? "");
  const [nickname, setNickname] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const validation = validateNickname(nickname);
    if (!validation.ok) return setError(nicknameProblemMessage(validation.reason, tx));

    setLoading(true);
    try {
      // The user's own current name would be reported as taken, so only a different name is checked.
      if (!isSameNickname(validation.value, currentName)) {
        const check = await checkNicknameAvailability(validation.value);
        if (!check.available) return setError(nicknameCheckMessage(check.reason, tx));
      }
      const response = await fetch("/api/user/nickname", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: validation.value }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        return setError(authErrorMessage({ code: body?.error, status: response.status }, tx));
      }
      setNickname(validation.value);
      await refreshSession();
      setInfo(tx("Zapisano.", "Saved."));
    } catch (err) {
      setError(authErrorMessage(null, tx));
    } finally {
      setLoading(false);
    }
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    const avatarProblem = validateAvatarFile(file);
    if (avatarProblem) return setError(avatarProblemMessage(avatarProblem, tx));
    setAvatarLoading(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch("/api/user/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: await fileToAvatarDataUrl(file) }),
      });
      if (!response.ok) throw new Error("avatar rejected");
      await refreshSession();
      setInfo(tx("Zdjęcie zaktualizowane.", "Photo updated."));
    } catch (err) {
      setError(authErrorMessage(null, tx));
    } finally {
      setAvatarLoading(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <Feedback error={error} info={info} />
      <Field label={tx("Pseudonim", "Nickname")} value={nickname} onChange={setNickname} autoComplete="nickname" />
      <p className="-mt-1 text-[12px] text-[var(--chan-muted)]">
        {tx("To nazwa widoczna na stronie, np. przy Twoich komentarzach.", "The name shown on the site, e.g. with your comments.")}
      </p>
      <div className="flex items-center gap-3">
        {/* Avatar is a small data URL or a local file; plain img avoids next/image config for the account panel. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.imageUrl}
          alt=""
          className="h-14 w-14 shrink-0 rounded-full border border-[var(--chan-line)] object-cover"
        />
        {/* A real button (reachable with Tab, Enter and Space) opens the hidden file input (WCAG 2.1.1, audit A07). */}
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          disabled={avatarLoading}
          className="cursor-pointer rounded text-[13px] font-bold text-[var(--chan-ink)] underline hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--chan-blue)] disabled:cursor-default disabled:opacity-60"
        >
          {avatarLoading ? (tx("Wgrywanie...", "Uploading...")) : (tx("Zmień zdjęcie", "Change photo"))}
        </button>
        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-hidden="true" onChange={onAvatar} disabled={avatarLoading} />
      </div>
      <LanguageField tx={tx} />
      <Primary loading={loading} label={tx("Zapisz", "Save")} />
    </form>
  );
}
