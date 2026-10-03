"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Globe } from "lucide-react";
import type { Locale } from "@/lib/i18n/routing";

type LanguageOption = {
  code: string;
  label: string;
  /** Locale the site can really switch to today; null = listed, but no translation yet. */
  locale: Locale | null;
};

// Only PL and EN are real locales. The other languages are listed so the switcher looks complete:
// picking one shows its code in the pill and a short "translation in progress" note, and the site
// stays in the current language. To make one real, add it to lib/i18n/routing.ts, translate the
// UI/e-mails/legal documents, then set its `locale` here.
export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: "PL", label: "Polski", locale: "pl" },
  { code: "EN", label: "English", locale: "en" },
  { code: "DE", label: "Deutsch", locale: null },
  { code: "ES", label: "Español", locale: null },
  { code: "FR", label: "Français", locale: null },
  { code: "IT", label: "Italiano", locale: null },
  { code: "PT", label: "Português", locale: null },
  { code: "ZH", label: "中文", locale: null },
];

const NOTE_VISIBLE_MS = 4500;

type Props = {
  language: Locale;
  onSelect: (locale: Locale) => void;
  /**
   * "pill" (navbar): a globe pill that opens a single column of same-size, lighter pills with every language code.
   * "inline" (inside dialogs): a small "Language: EN" link that expands the same codes in the
   * page flow, so a scrolling card cannot clip it. Both show all codes at once: no scrolling,
   * no search.
   */
  variant?: "pill" | "inline";
};

/**
 * Navbar language switcher: one pill (globe, current code, chevron) that opens a panel with all
 * language codes (short, so they fit without scrolling or search).
 */
export default function LanguageSwitcher({ language, onSelect, variant = "pill" }: Props) {
  const inline = variant === "inline";
  const isPl = language === "pl";
  const [open, setOpen] = useState(false);
  // A listed-but-untranslated language the user picked: shown in the pill until reload.
  const [preview, setPreview] = useState<LanguageOption | null>(null);
  const [noteVisible, setNoteVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const real = LANGUAGE_OPTIONS.find((o) => o.locale === language) ?? LANGUAGE_OPTIONS[0];
  const current = preview ?? real;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!noteVisible) return;
    const timer = window.setTimeout(() => setNoteVisible(false), NOTE_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [noteVisible]);

  const pick = (option: LanguageOption) => {
    setOpen(false);
    if (option.locale) {
      setPreview(null);
      setNoteVisible(false);
      onSelect(option.locale);
      return;
    }
    setPreview(option);
    setNoteVisible(true);
  };

  const note = isPl
    ? `Tłumaczenie na ${current.code} jest w przygotowaniu. Na razie ${real.code}.`
    : `The ${current.code} translation is in progress. For now: ${real.code}.`;

  const triggerContent = inline ? (
    <>
      <Globe className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      <span>{isPl ? "Język" : "Language"}:</span>
      <span className="text-[var(--chan-ink)]">{current.code}</span>
      <ChevronDown
        className={"h-3 w-3 shrink-0 transition-transform duration-150 " + (open ? "rotate-180" : "")}
        strokeWidth={2}
        aria-hidden="true"
      />
    </>
  ) : (
    <>
      <Globe className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      <span className="text-[11px] font-extrabold uppercase tracking-[0.08em]">{current.code}</span>
      <ChevronDown
        className={"h-3.5 w-3.5 shrink-0 text-[var(--chan-muted)] transition-transform duration-150 " + (open ? "rotate-180" : "")}
        strokeWidth={2}
        aria-hidden="true"
      />
    </>
  );

  // One object: the trigger and the list share a single outline and shadow; horizontal hairlines
  // separate the rows, and there is no gap between the trigger and the first language.
  const triggerClass = inline
    ? "inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-semibold text-[var(--chan-muted)] transition-colors hover:text-[var(--chan-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] " +
      (open ? "w-full justify-center rounded-none" : "rounded-full hover:bg-[var(--chan-surface)]")
    : "flex h-[38px] items-center gap-1.5 border border-[var(--cm-line-84)] bg-[var(--cm-card-82-white)] pl-2.5 pr-2 text-[var(--chan-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition-[border-color,box-shadow] duration-160 hover:border-[var(--chan-blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] " +
      (open ? "w-full rounded-b-none rounded-t-[19px]" : "rounded-full hover:shadow-[0_4px_14px_rgba(37,99,235,0.08)]");

  const rootClass = inline
    ? "relative mx-auto " +
      (open ? "w-[148px] overflow-hidden rounded-2xl border border-[var(--cm-line-84)] bg-white shadow-[0_6px_18px_rgba(23,23,23,0.08)]" : "w-fit")
    : "relative shrink-0 " + (open ? "rounded-[19px] shadow-[0_14px_34px_rgba(23,23,23,0.16)]" : "");

  const statusNode = (
    <div role="status" aria-live="polite" className="contents">
      {noteVisible && !open ? (
          <div
            className={
              inline
                ? "relative mx-auto mt-1 max-w-[300px] text-center text-[11.5px] leading-snug text-[var(--chan-muted)]"
                : "absolute right-0 top-[calc(100%+8px)] z-[1100] w-[232px] rounded-2xl border border-[var(--cm-line-84)] bg-white px-3 py-2 text-left text-[12.5px] leading-snug text-[var(--chan-ink)] shadow-[0_12px_32px_rgba(23,23,23,0.14)]"
            }
          >
            {note}
          </div>
        ) : null}
      </div>
  );

  return (
    <div ref={rootRef} className={inline ? "w-full text-center" : "contents"}>
      <div className={rootClass}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-label={isPl ? `Język: ${current.label}. Zmień język` : `Language: ${current.label}. Change language`}
          onClick={() => setOpen((value) => !value)}
          className={triggerClass}
        >
          {triggerContent}
        </button>

        {open ? (
          <div
            id={menuId}
            role="menu"
            aria-label={isPl ? "Wybierz język" : "Choose language"}
            onKeyDown={(event) => {
              const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
              if (!keys.includes(event.key)) return;
              const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
              const index = items.indexOf(document.activeElement as HTMLButtonElement);
              const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
              event.preventDefault();
              items[(index + step + items.length) % items.length]?.focus();
            }}
            className={
              inline
                ? "relative flex w-full flex-col"
                : "absolute left-0 right-0 top-full z-[1100] flex flex-col rounded-b-[19px] border border-t-0 border-[var(--cm-line-84)] bg-white"
            }
          >
            {LANGUAGE_OPTIONS.map((option) => {
              const selected = option.code === current.code;
              return (
                <button
                  key={option.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  aria-label={option.label}
                  autoFocus={selected}
                  onClick={() => pick(option)}
                  className={
                    "flex w-full items-center justify-center border-t border-[var(--cm-line-84)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--chan-blue)] " +
                    (inline ? "h-8 text-[12px] font-semibold " : "h-[34px] text-[11px] font-extrabold uppercase tracking-[0.08em] last:rounded-b-[18px] ") +
                    (selected
                      ? "bg-[var(--chan-surface)] text-[var(--chan-ink)]"
                      : "text-[var(--chan-muted)] hover:bg-[var(--chan-surface)] hover:text-[var(--chan-ink)]")
                  }
                >
                  {option.code}
                </button>
              );
            })}
          </div>
        ) : null}
        {!inline ? statusNode : null}
      </div>
      {inline ? statusNode : null}
    </div>
  );
}
