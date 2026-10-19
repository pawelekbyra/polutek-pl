"use client";

import { useState } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import { PLAYLIST_DESCRIPTION_MAX, PLAYLIST_TITLE_MAX, type PlaylistVisibilityValue } from "@/lib/modules/playlists/domain/playlist-rules";
import { StudioApiError } from "./studio-client";
import { CharCounter, Field, Notice, buttonClass, ghostButtonClass, inputClass } from "./ui";

/** Shared pieces of the playlist screens: the visibility texts, the error text and the title/description/visibility form. */

export function useVisibilityText() {
  const { tx } = useLanguage();
  const label: Record<PlaylistVisibilityValue, string> = {
    PUBLIC: tx("Publiczna", "Public"),
    UNLISTED: tx("Niepubliczna", "Unlisted"),
    PRIVATE: tx("Prywatna", "Private"),
  };
  const hint: Record<PlaylistVisibilityValue, string> = {
    PUBLIC: tx("Widoczna na kanale i dostępna z linkiem.", "Shown on your channel and reachable by link."),
    UNLISTED: tx("Dostępna tylko z linkiem, nie pokazuje się na kanale.", "Reachable only with the link; not shown on your channel."),
    PRIVATE: tx("Widzisz ją tylko Ty i zespół kanału.", "Only you and your channel team can see it."),
  };
  return { label, hint };
}

export function errorText(error: unknown, fallback: string): string {
  return error instanceof StudioApiError ? error.message : fallback;
}

export type FormValues = { title: string; description: string; visibility: PlaylistVisibilityValue };

export function PlaylistForm({
  initial,
  submitLabel,
  busyLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormValues;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (values: { title: string; description: string | null; visibility: PlaylistVisibilityValue }) => Promise<void>;
  onCancel?: () => void;
}) {
  const { tx } = useLanguage();
  const visibility = useVisibilityText();
  const [values, setValues] = useState<FormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await onSubmit({ title: values.title.trim(), description: values.description.trim() || null, visibility: values.visibility });
      setMessage({ kind: "success", text: tx("Zapisano.", "Saved.") });
    } catch (e) {
      setMessage({ kind: "error", text: errorText(e, tx("Nie udało się zapisać playlisty.", "Could not save the playlist.")) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-4">
      <Field label={tx("Tytuł", "Title")} htmlFor="playlist-title" counter={<CharCounter id="playlist-title-count" value={values.title} max={PLAYLIST_TITLE_MAX} />}>
        <input
          id="playlist-title"
          className={inputClass}
          value={values.title}
          maxLength={PLAYLIST_TITLE_MAX}
          required
          aria-describedby="playlist-title-count"
          onChange={(e) => setValues({ ...values, title: e.target.value })}
        />
      </Field>
      <Field label={tx("Opis", "Description")} htmlFor="playlist-description" counter={<CharCounter id="playlist-description-count" value={values.description} max={PLAYLIST_DESCRIPTION_MAX} />}>
        <textarea
          id="playlist-description"
          className={`${inputClass} min-h-24`}
          value={values.description}
          maxLength={PLAYLIST_DESCRIPTION_MAX}
          aria-describedby="playlist-description-count"
          onChange={(e) => setValues({ ...values, description: e.target.value })}
        />
      </Field>
      <Field label={tx("Widoczność", "Visibility")} htmlFor="playlist-visibility" hint={visibility.hint[values.visibility]}>
        <select
          id="playlist-visibility"
          className={inputClass}
          value={values.visibility}
          aria-describedby="playlist-visibility-hint"
          onChange={(e) => setValues({ ...values, visibility: e.target.value as PlaylistVisibilityValue })}
        >
          {(["PUBLIC", "UNLISTED", "PRIVATE"] as const).map((v) => (
            <option key={v} value={v}>
              {visibility.label[v]}
            </option>
          ))}
        </select>
      </Field>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={buttonClass} disabled={busy || values.title.trim().length === 0}>
          {busy ? busyLabel : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className={ghostButtonClass} disabled={busy} onClick={onCancel}>
            {tx("Anuluj", "Cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
