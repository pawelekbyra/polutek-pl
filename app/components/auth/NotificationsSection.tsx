"use client";

// "Powiadomienia" section of the account panel: the toggles of NotificationPreference, saved one at a
// time through PATCH /api/user/notification-preferences (validated there by zod). A toggle changes at
// once and goes back when the save fails.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "../icons";
import type { Tx } from "@/lib/i18n/ui";
import { Feedback } from "./AccountSections";

type Preferences = {
  newVideoInApp: boolean;
  commentEnabled: boolean;
  systemEnabled: boolean;
};

type ToggleKey = keyof Preferences;

async function requestPreferences(options: RequestInit = {}): Promise<Preferences> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("/api/user/notification-preferences", { cache: "no-store", ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as Preferences;
    if ([data.newVideoInApp, data.commentEnabled, data.systemEnabled].some((value) => typeof value !== "boolean")) {
      throw new Error("Invalid notification preferences");
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}


export function NotificationsSection({ tx }: { tx: Tx }) {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState<ToggleKey | null>(null);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      setPrefs(await requestPreferences());
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(key: ToggleKey, value: boolean) {
    if (!prefs || savingRef.current) return;
    savingRef.current = true;
    const before = prefs;
    setError(null);
    setSaving(key);
    setPrefs({ ...prefs, [key]: value });
    try {
      const saved = await requestPreferences({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      setPrefs(saved);
    } catch {
      setPrefs(before);
      setError(tx("Nie udało się zapisać ustawienia. Spróbuj ponownie.", "Could not save the setting. Please try again."));
    } finally {
      savingRef.current = false;
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
                disabled={saving !== null}
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
