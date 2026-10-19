"use client";

import { useState } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import { VIDEO_CATEGORIES, type VideoCommentsModeValue } from "@/lib/video-metadata";
import { videoCategoryLabel } from "@/lib/video-category-label";
import { TAG_MAX_LENGTH, TAGS_MAX, addTagsFromInput, removeTag, tagCounterText, type TagInputProblem } from "./video-form";
import { Field, inputClass } from "./ui";

export interface MoreOptionsValue {
  tags: string[];
  category: string;
  commentsMode: VideoCommentsModeValue;
}

/**
 * "Więcej opcji": tags (chips; Enter or comma adds), category and comments mode. Shared by the upload wizard and
 * the editor. Limits and parsing live in `video-form.ts` (pure, tested); the server re-validates everything.
 */
export default function VideoMoreOptions({
  idPrefix,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string;
  value: MoreOptionsValue;
  onChange: (next: MoreOptionsValue) => void;
  disabled?: boolean;
}) {
  const { tx } = useLanguage();
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState<TagInputProblem | null>(null);

  const commit = (text: string) => {
    const result = addTagsFromInput(value.tags, text);
    setProblem(result.problem);
    setDraft(result.leftover);
    if (result.tags.length !== value.tags.length) onChange({ ...value, tags: result.tags });
  };

  const problemText =
    problem === "TOO_MANY"
      ? tx("Najwyżej {0} tagów.", "At most {0} tags.", TAGS_MAX)
      : problem === "TOO_LONG"
        ? tx("Tag może mieć najwyżej {0} znaków.", "A tag can be at most {0} characters.", TAG_MAX_LENGTH)
        : null;

  return (
    <details className="rounded-xl border border-[var(--chan-line)] p-3">
      <summary className="min-h-8 cursor-pointer text-[14px] font-semibold text-[var(--chan-ink)]">{tx("Więcej opcji", "More options")}</summary>
      <div className="mt-4 grid gap-4">
        <Field
          label={tx("Tagi", "Tags")}
          htmlFor={`${idPrefix}-tags`}
          hint={tx(
            "Wpisz tag i naciśnij Enter lub przecinek. Do {0} tagów, po {1} znaków.",
            "Type a tag and press Enter or a comma. Up to {0} tags of {1} characters.",
            TAGS_MAX,
            TAG_MAX_LENGTH,
          )}
          counter={
            <span className={`text-[12px] tabular-nums ${value.tags.length >= TAGS_MAX ? "font-semibold text-amber-700" : "text-[var(--chan-muted)]"}`}>
              {tagCounterText(value.tags)}
            </span>
          }
        >
          {value.tags.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label={tx("Dodane tagi", "Added tags")}>
              {value.tags.map((tag, index) => (
                <li key={tag} className="inline-flex items-center gap-1 rounded-full bg-[var(--chan-surface)] py-0.5 pl-3 pr-1 text-[13px] text-[var(--chan-ink)]">
                  <span>{tag}</span>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={tx("Usuń tag {0}", "Remove tag {0}", tag)}
                    className="inline-flex h-6 min-w-6 items-center justify-center rounded-full text-[14px] font-bold hover:bg-[var(--chan-line)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)] disabled:opacity-50"
                    onClick={() => {
                      setProblem(null);
                      onChange({ ...value, tags: removeTag(value.tags, index) });
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            id={`${idPrefix}-tags`}
            className={inputClass}
            value={draft}
            disabled={disabled}
            aria-describedby={`${idPrefix}-tags-hint`}
            aria-invalid={problem !== null}
            onChange={(e) => {
              const text = e.target.value;
              // A comma (typed or pasted) commits everything before it.
              if (/[,\n]/.test(text)) commit(text);
              else {
                setDraft(text);
                if (problem) setProblem(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit(draft);
              } else if (e.key === "Backspace" && draft === "" && value.tags.length > 0) {
                onChange({ ...value, tags: value.tags.slice(0, -1) });
              }
            }}
            onBlur={() => {
              if (draft.trim()) commit(draft);
            }}
          />
          <p role="status" className="min-h-4 text-[12px] font-semibold text-red-700">
            {problemText}
          </p>
        </Field>

        <Field label={tx("Kategoria", "Category")} htmlFor={`${idPrefix}-category`}>
          <select
            id={`${idPrefix}-category`}
            className={inputClass}
            value={value.category}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, category: e.target.value })}
          >
            <option value="">{tx("Brak", "None")}</option>
            {VIDEO_CATEGORIES.map((key) => (
              <option key={key} value={key}>
                {videoCategoryLabel(tx, key)}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label={tx("Komentarze", "Comments")}
          htmlFor={`${idPrefix}-comments`}
          hint={tx(
            "Wyłączenie komentarzy blokuje nowe komentarze; istniejące zostają. Wstrzymane komentarze czekają w zakładce Komentarze.",
            "Turning comments off blocks new comments; existing ones stay. Held comments wait in the Comments tab.",
          )}
        >
          <select
            id={`${idPrefix}-comments`}
            className={inputClass}
            value={value.commentsMode}
            disabled={disabled}
            aria-describedby={`${idPrefix}-comments-hint`}
            onChange={(e) => onChange({ ...value, commentsMode: e.target.value as VideoCommentsModeValue })}
          >
            <option value="ON">{tx("Włączone", "On")}</option>
            <option value="HELD">{tx("Wstrzymuj do przeglądu", "Hold for review")}</option>
            <option value="OFF">{tx("Wyłączone", "Off")}</option>
          </select>
        </Field>
      </div>
    </details>
  );
}
