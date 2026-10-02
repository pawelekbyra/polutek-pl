"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import type { Locale } from "@/lib/i18n/routing";

type LanguageOption = {
  code: string;
  label: string;
  /** Locales we can switch to today. Others are listed as "coming soon" and cannot be picked. */
  locale: Locale | null;
};

// Italian is listed on purpose but does not work yet: it needs a full translation of the site
// (UI copy, e-mails, legal documents) and an `it` entry in lib/i18n/routing.ts before it can be a locale.
export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: "PL", label: "Polski", locale: "pl" },
  { code: "EN", label: "English", locale: "en" },
  { code: "IT", label: "Italiano", locale: null },
];

type Props = {
  language: Locale;
  onSelect: (locale: Locale) => void;
};

/**
 * Navbar language switcher: one pill (globe, current code, chevron) that opens a short list.
 * It grows to any number of languages without widening the navbar.
 */
export default function LanguageSwitcher({ language, onSelect }: Props) {
  const isPl = language === "pl";
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = LANGUAGE_OPTIONS.find((o) => o.locale === language) ?? LANGUAGE_OPTIONS[0];

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

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={isPl ? `Język: ${current.label}. Zmień język` : `Language: ${current.label}. Change language`}
        onClick={() => setOpen((value) => !value)}
        className="flex h-[38px] items-center gap-1.5 rounded-full border border-[var(--cm-line-84)] bg-[var(--cm-card-82-white)] pl-2.5 pr-2 text-[var(--chan-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition-[border-color,box-shadow] duration-160 hover:border-[var(--chan-blue)] hover:shadow-[0_4px_14px_rgba(37,99,235,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
      >
        <Globe className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
        <span className="text-[11px] font-extrabold uppercase tracking-[0.08em]">{current.code}</span>
        <ChevronDown
          className={"h-3.5 w-3.5 shrink-0 text-[var(--chan-muted)] transition-transform duration-150 " + (open ? "rotate-180" : "")}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={isPl ? "Wybierz język" : "Choose language"}
          className="absolute right-0 top-[calc(100%+8px)] z-[1100] min-w-[188px] rounded-2xl border border-[var(--cm-line-84)] bg-white p-1.5 shadow-[0_12px_32px_rgba(23,23,23,0.14)]"
        >
          {LANGUAGE_OPTIONS.map((option) => {
            const selectable = option.locale !== null;
            const selected = option.locale === language;
            return (
              <button
                key={option.code}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                aria-disabled={!selectable}
                disabled={!selectable}
                onClick={() => {
                  if (!option.locale) return;
                  setOpen(false);
                  onSelect(option.locale);
                }}
                className={
                  "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[14px] transition-colors " +
                  (selected
                    ? "bg-[var(--chan-surface)] text-[var(--chan-blue)]"
                    : selectable
                      ? "text-[var(--chan-ink)] hover:bg-[var(--chan-surface)]"
                      : "cursor-not-allowed text-[var(--chan-muted)] opacity-70")
                }
              >
                <span className="w-6 text-[11px] font-extrabold tracking-[0.08em] text-[var(--chan-muted)]">{option.code}</span>
                <span className="flex-1">{option.label}</span>
                {!selectable ? (
                  <span className="rounded-full bg-[var(--chan-surface)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]">
                    {isPl ? "wkrótce" : "soon"}
                  </span>
                ) : selected ? (
                  <Check className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
