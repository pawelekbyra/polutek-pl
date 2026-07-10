"use client";

import React, { useState } from "react";
import { Feedback } from "./AccountSections";

interface NotificationPrefs {
  patronEnabled: boolean;
  commentEnabled: boolean;
  systemEnabled: boolean;
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-[12px] border border-[var(--chan-line)] px-3 py-2.5">
      <span className="text-[13px] font-bold text-[var(--chan-ink)]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={
          "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 " +
          (checked ? "bg-[#2563EB]" : "bg-[var(--chan-line)]")
        }
      >
        <span
          className={
            "absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform " +
            (checked ? "translate-x-[23px]" : "translate-x-[3px]")
          }
        />
      </button>
    </div>
  );
}

export function NotificationsSection({ isPl }: { isPl: boolean }) {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/user/notification-preferences")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setPrefs(data))
      .catch(() => setError(isPl ? "Nie udało się wczytać ustawień." : "Failed to load settings."))
      .finally(() => setLoading(false));
  }, [isPl]);

  const update = (patch: Partial<NotificationPrefs>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    fetch("/api/user/notification-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => setError(isPl ? "Nie udało się zapisać." : "Failed to save."));
  };

  if (loading) return <p className="text-[13px] text-[var(--chan-muted)]">{isPl ? "Ładowanie…" : "Loading…"}</p>;
  if (!prefs) return <Feedback error={error} info={null} />;

  return (
    <div className="space-y-3">
      <Feedback error={error} info={null} />
      <p className="text-[13px] leading-[1.5] text-[var(--chan-body)]">
        {isPl
          ? "Wybierz, jakie powiadomienia w aplikacji chcesz otrzymywać."
          : "Choose which in-app notifications you want to receive."}
      </p>
      <ToggleRow
        label={isPl ? "Status Patrona" : "Patron status"}
        checked={prefs.patronEnabled}
        onChange={(v) => update({ patronEnabled: v })}
      />
      <ToggleRow
        label={isPl ? "Reakcje na komentarze" : "Comment reactions"}
        checked={prefs.commentEnabled}
        onChange={(v) => update({ commentEnabled: v })}
      />
      <ToggleRow
        label={isPl ? "Wiadomości systemowe" : "System messages"}
        checked={prefs.systemEnabled}
        onChange={(v) => update({ systemEnabled: v })}
      />
    </div>
  );
}
