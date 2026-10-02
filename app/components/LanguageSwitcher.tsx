"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Globe, Search } from "lucide-react";
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

/** Case- and accent-insensitive match ("francais" finds "Français"), on label or code. */
function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function filterLanguages(query: string): LanguageOption[] {
  const q = normalize(query);
  if (!q) return [...LANGUAGE_OPTIONS];
  return LANGUAGE_OPTIONS.filter((o) => normalize(o.label).includes(q) || normalize(o.code).includes(q));
}

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
  // A listed-but-untranslated language the user picked: shown in the pill until reload.
  const [preview, setPreview] = useState<LanguageOption | null>(null);
  const [noteVisible, setNoteVisible] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuId = useId();
  const real = LANGUAGE_OPTIONS.find((o) => o.locale === language) ?? LANGUAGE_OPTIONS[0];
  const current = preview ?? real;
  const results = filterLanguages(query);

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
    if (open) searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!noteVisible) return;
    const timer = window.setTimeout(() => setNoteVisible(false), NOTE_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [noteVisible]);

  const pick = (option: LanguageOption) => {
    setOpen(false);
    setQuery("");
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
    ? `Tłumaczenie na ${current.label} jest w przygotowaniu. Na razie ${real.label}.`
    : `The ${current.label} translation is in progress. For now: ${real.label}.`;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={isPl ? `Język: ${current.label}. Zmień język` : `Language: ${current.label}. Change language`}
        onClick={() => {
          setQuery("");
          setOpen((value) => !value);
        }}
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

      <div role="status" aria-live="polite" className="contents">
        {noteVisible && !open ? (
          <div className="absolute right-0 top-[calc(100%+8px)] z-[1100] w-[232px] rounded-2xl border border-[var(--cm-line-84)] bg-white px-3 py-2 text-[12.5px] leading-snug text-[var(--chan-ink)] shadow-[0_12px_32px_rgba(23,23,23,0.14)]">
            {note}
          </div>
        ) : null}
      </div>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[1100] w-[220px] overflow-hidden rounded-2xl border border-[var(--cm-line-84)] bg-white shadow-[0_12px_32px_rgba(23,23,23,0.14)]">
          <div className="flex items-center gap-2 border-b border-[var(--cm-line-84)] px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-[var(--chan-muted)]" strokeWidth={1.8} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && results[0]) {
                  event.preventDefault();
                  pick(results[0]);
                }
              }}
              placeholder={isPl ? "Szukaj języka" : "Search language"}
              aria-label={isPl ? "Szukaj języka" : "Search language"}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--chan-ink)] outline-none placeholder:text-[var(--chan-muted)]"
            />
          </div>
          <div
            id={menuId}
            role="menu"
            aria-label={isPl ? "Wybierz język" : "Choose language"}
            className="max-h-[min(264px,50vh)] overflow-y-auto overscroll-contain p-1.5"
          >
            {results.length === 0 ? (
              <p className="px-2.5 py-3 text-[13px] text-[var(--chan-muted)]">{isPl ? "Brak wyników" : "No results"}</p>
            ) : (
              results.map((option) => {
                const selected = option.code === current.code;
                return (
                  <button
                    key={option.code}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => pick(option)}
                    className={
                      "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[14px] transition-colors " +
                      (selected
                        ? "bg-[var(--chan-surface)] text-[var(--chan-blue)]"
                        : "text-[var(--chan-ink)] hover:bg-[var(--chan-surface)]")
                    }
                  >
                    <span className="w-6 text-[11px] font-extrabold tracking-[0.08em] text-[var(--chan-muted)]">{option.code}</span>
                    <span className="flex-1">{option.label}</span>
                    {selected ? <Check className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
