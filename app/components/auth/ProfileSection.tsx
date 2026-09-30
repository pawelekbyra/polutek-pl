"use client";

// "Profil" section of the account panel. The only name a user edits is the nickname
// ("Pseudonim"): the same rules and taken check as at sign-up (lib/auth/nickname.ts), saved as the
// Clerk first name with the last name cleared. The Clerk username is technical (generated from the
// nickname at sign-up) and is not shown here.

import React, { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "../LanguageContext";
import { appendQueryString, switchLocalePath, type Locale } from "@/lib/i18n/routing";
import {
  checkNicknameAvailability,
  isSameNickname,
  nicknameCheckMessage,
  nicknameProblemMessage,
  normalizeNickname,
  validateNickname,
} from "@/lib/auth/nickname";
import { Feedback, Field, Primary, clerkErr, useAccountUser } from "./AccountSections";

function LanguageField({ isPl }: { isPl: boolean }) {
  const { language, setLanguage } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const switchLanguage = (locale: Locale) => {
    if (locale === language) return;
    setLanguage(locale);
    router.push(appendQueryString(switchLocalePath(pathname || "/", locale), searchParams));
  };

  return (
    <div className="flex items-center justify-between rounded-[12px] border border-[var(--chan-line)] px-3 py-2.5">
      <span className="text-[13px] font-bold text-[var(--chan-ink)]">{isPl ? "Język" : "Language"}</span>
      <div className="flex gap-1">
        {(["pl", "en"] as const).map((locale) => (
          <button
            key={locale}
            type="button"
            onClick={() => switchLanguage(locale)}
            className={
              "rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wide transition-colors " +
              (language === locale
                ? "bg-[var(--chan-ink)] text-white"
                : "text-[var(--chan-muted)] hover:bg-[var(--chan-surface)]")
            }
          >
            {locale}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProfileSection({ isPl }: { isPl: boolean }) {
  const user = useAccountUser();
  // Older accounts may still have a first + last name; they show (and save) as one nickname.
  const currentName = normalizeNickname([user.firstName, user.lastName].filter(Boolean).join(" "));
  const [nickname, setNickname] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const validation = validateNickname(nickname);
    if (!validation.ok) return setError(nicknameProblemMessage(validation.reason, isPl));

    setLoading(true);
    try {
      // The user's own current name would be reported as taken, so only a different name is checked.
      if (!isSameNickname(validation.value, currentName)) {
        const check = await checkNicknameAvailability(validation.value);
        if (!check.available) return setError(nicknameCheckMessage(check.reason, isPl));
      }
      await user.update({ firstName: validation.value, lastName: "" });
      setNickname(validation.value);
      // The Clerk webhook (user.updated) also syncs it; this makes the local User.name follow at once.
      void fetch("/api/user/sync", { cache: "no-store" }).catch(() => undefined);
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
      <LanguageField isPl={isPl} />
      <div className="flex items-center gap-3">
        {/* Clerk-hosted avatar; plain img avoids next/image host config for the account panel. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.imageUrl}
          alt=""
          className="h-14 w-14 shrink-0 rounded-full border border-[var(--chan-line)] object-cover"
        />
        <label className="cursor-pointer text-[13px] font-bold text-[var(--chan-ink)] underline hover:opacity-70">
          {avatarLoading ? (isPl ? "Wgrywanie..." : "Uploading...") : (isPl ? "Zmień zdjęcie" : "Change photo")}
          <input type="file" accept="image/*" className="hidden" onChange={onAvatar} disabled={avatarLoading} />
        </label>
      </div>
      <Field label={isPl ? "Pseudonim" : "Nickname"} value={nickname} onChange={setNickname} autoComplete="nickname" />
      <p className="-mt-1 text-[12px] text-[var(--chan-muted)]">
        {isPl ? "To nazwa widoczna na stronie, np. przy Twoich komentarzach." : "The name shown on the site, e.g. with your comments."}
      </p>
      <Primary loading={loading} label={isPl ? "Zapisz" : "Save"} />
    </form>
  );
}
