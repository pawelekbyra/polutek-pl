"use client";

// "Powiadomienia" section of the account panel: the toggles of NotificationPreference, saved one at a
// time through PATCH /api/user/notification-preferences (validated there by zod). A toggle changes at
// once and goes back when the save fails.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "../icons";
import type { Tx } from "@/lib/i18n/ui";
import { Feedback } from "./AccountSections";

type Preferences = {
  newVideoInApp: boolean;
  newVideoEmail: boolean;
  commentEnabled: boolean;
  systemEnabled: boolean;
  emailConsent: boolean;
};

type ToggleKey = "newVideoInApp" | "newVideoEmail" | "commentEnabled" | "systemEnabled";

export function NotificationsSection({ tx }: { tx: Tx }) {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState<ToggleKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const response = await fetch("/api/user/notification-preferences", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setPrefs((await response.json()) as Preferences);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(key: ToggleKey, value: boolean) {
    if (!prefs) return;
    const before = prefs;
    setError(null);
    setSaving(key);
    setPrefs({ ...prefs, [key]: value });
    try {
      const response = await fetch("/api/user/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setPrefs((await response.json()) as Preferences);
    } catch {
      setPrefs(before);
      setError(tx("Nie udało się zapisać ustawienia. Spróbuj ponownie.", "Could not save the setting. Please try again."));
    } finally {
      setSaving(null);
    }
  }

  if (loadFailed) {
    return (
      <div role="alert" className="space-y-2 rounded-lg bg-red-50 px-3 py-2">
        <p className="text-[13px] font-semibold text-red-600">
          {tx("Nie udało się wczytać ustawień powiadomień.", "Could not load notification settings.")}
        </p>
        <button type="button" onClick={() => void load()} className="text-[12px] font-bold text-red-700 underline">
          {tx("Spróbuj ponownie", "Try again")}
        </button>
      </div>
    );
  }
  if (!prefs) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-[var(--chan-muted)]" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {tx("Ładowanie…", "Loading…")}
      </p>
    );
  }

  const rows: { key: ToggleKey; label: string; hint: string }[] = [
    {
      key: "newVideoInApp",
      label: tx("Nowe filmy (w serwisie)", "New videos (in the app)"),
      hint: tx("Powiadomienie w dzwonku, gdy kanał, który obserwujesz, opublikuje film.", "A bell notification when a channel you follow publishes a video."),
    },
    {
      key: "commentEnabled",
      label: tx("Komentarze", "Comments"),
      hint: tx("Reakcje i odpowiedzi na Twoje komentarze.", "Reactions and replies to your comments."),
    },
    {
      key: "systemEnabled",
      label: tx("Wiadomości serwisu", "Service messages"),
      hint: tx("Ogłoszenia i informacje od serwisu.", "Announcements and information from the service."),
    },
    {
      key: "newVideoEmail",
      label: tx("E-mail o nowych filmach", "E-mail about new videos"),
      hint: prefs.emailConsent
        ? tx("Wiadomość e-mail, gdy kanał, który obserwujesz, opublikuje film.", "An e-mail when a channel you follow publishes a video.")
        : tx(
            "Nie wyraziłeś/-aś zgody na e-maile o nowych treściach, więc nic nie wysyłamy. Zgodę włączysz przy obserwowaniu kanału.",
            "You have not agreed to e-mails about new content, so we send nothing. You can turn it on when you follow a channel.",
          ),
    },
  ];

  return (
    <div className="space-y-3">
      <Feedback error={error} info={null} />
      <ul className="space-y-2">
        {rows.map((row) => {
          const id = `notif-pref-${row.key}`;
          return (
            <li key={row.key} className="flex items-start justify-between gap-3 rounded-[12px] border border-[var(--chan-line)] px-3 py-2.5">
              <div className="min-w-0">
                <label htmlFor={id} className="block text-[13px] font-bold text-[var(--chan-ink)]">
                  {row.label}
                </label>
                <p id={`${id}-hint`} className="mt-0.5 text-[12px] text-[var(--chan-muted)]">
                  {row.hint}
                </p>
              </div>
              <input
                id={id}
                type="checkbox"
                role="switch"
                checked={prefs[row.key]}
                disabled={saving === row.key}
                aria-describedby={`${id}-hint`}
                onChange={(event) => void toggle(row.key, event.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[var(--chan-ink)] disabled:cursor-wait"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
