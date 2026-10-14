"use client";

import React from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import type { Locale } from "@/lib/i18n/routing";
import LanguageFlag from "./language-switcher/LanguageFlag";
import { warmFlags, type LanguageOption } from "./language-switcher/languages";
import { useLanguagePicker } from "./language-switcher/useLanguagePicker";
import styles from "./language-switcher/LanguageSwitcher.module.css";
import { useOptionalTx } from "@/lib/i18n/language-context";

type Props = {
  language: Locale;
  onSelect: (locale: Locale) => void;
  /**
   * "pill" (navbar): a globe pill with the current code that opens a floating, scrolling list.
   * "inline" (inside dialogs): a small "[globe] Language: English" link that expands a compact grid
   * of all languages (no frame) in the page flow, so a scrolling card cannot clip it. Its root is
   * `display: contents`, so in a wrapping flex row the list takes a full line. Flags appear only in
   * the list rows; the buttons keep the neutral globe (owner decision: flag colours clash there).
   * "icon" (navbar, signed-out visitors): the same floating list behind a round, globe-only button.
   */
  variant?: "pill" | "inline" | "icon";
};

type OptionProps = {
  option: LanguageOption;
  id: string;
  selected: boolean;
  active: boolean;
  compact: boolean;
  onPick: () => void;
  onHover: () => void;
};

function LanguageOptionRow({ option, id, selected, active, compact, onPick, onHover }: OptionProps) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      data-active={active || undefined}
      // Keep focus on the search field / list while clicking.
      onMouseDown={(event) => event.preventDefault()}
      onPointerMove={onHover}
      onClick={onPick}
      className={
        (compact
          ? "flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-left text-[12px] pointer-coarse:min-h-11 "
          : "flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-left text-[14px] sm:min-h-10 ") +
        "cursor-pointer select-none transition-colors duration-100 motion-reduce:transition-none " +
        (active ? "bg-[var(--chan-surface)] " : "") +
        (selected ? "font-semibold text-[var(--chan-blue)]" : "font-medium text-[var(--chan-ink)]")
      }
    >
      <LanguageFlag option={option} size={compact ? 18 : 24} />
      <span lang={option.lang} className="min-w-0 flex-1 truncate">
        {option.label}
      </span>
      {compact ? null : (
        <span aria-hidden="true" className="text-[11px] font-semibold tracking-[0.06em] text-[var(--chan-muted)]">
          {option.code}
        </span>
      )}
      {compact ? null : (
        <span className="flex w-4 shrink-0 justify-center" aria-hidden="true">
          {selected ? <Check className="h-4 w-4" strokeWidth={2.2} /> : null}
        </span>
      )}
    </div>
  );
}

/**
 * Language switcher. Both variants share one state/keyboard model (useLanguagePicker); only the
 * presentation differs. It grows to any number of languages without widening the navbar.
 */
export default function LanguageSwitcher({ language, onSelect, variant = "pill" }: Props) {
  const inline = variant === "inline";
  const tx = useOptionalTx(language);
  const {
    open, options, current, active, listId, optionId,
    rootRef, triggerRef, listRef, toggle, pick, setActiveIndex, onListKeyDown,
  } = useLanguagePicker({ language, onSelect, inline });

  const buttonLabel = tx("Język: {0}. Zmień język", "Language: {0}. Change language", current.label);
  const listLabel = tx("Języki", "Languages");

  const rows = (compact: boolean) =>
    options.map((option, index) => (
      <LanguageOptionRow
        key={option.code}
        option={option}
        id={optionId(option)}
        selected={option.code === current.code}
        active={option === active}
        compact={compact}
        onPick={() => pick(option)}
        onHover={() => setActiveIndex(index)}
      />
    ));

  const listboxProps = {
    id: listId,
    ref: listRef,
    role: "listbox",
    "aria-label": listLabel,
    "aria-activedescendant": active ? optionId(active) : undefined,
    onKeyDown: onListKeyDown,
    tabIndex: inline ? 0 : -1,
  } as const;

  const chevron = (className: string) => (
    <ChevronDown
      className={`${className} shrink-0 transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
      strokeWidth={2}
      aria-hidden="true"
    />
  );

  const triggerProps = {
    ref: triggerRef,
    type: "button",
    "aria-haspopup": "listbox",
    "aria-expanded": open,
    "aria-controls": open ? listId : undefined,
    "aria-label": buttonLabel,
    onClick: toggle,
    onPointerEnter: warmFlags,
    onFocus: warmFlags,
  } as const;

  return (
    <div ref={rootRef} className={inline ? "contents" : "relative shrink-0"}>
      {inline ? (
        <button
          {...triggerProps}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold text-[var(--chan-muted)] transition-colors hover:bg-[var(--chan-surface)] hover:text-[var(--chan-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] pointer-coarse:min-h-11"
        >
          <Globe className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <span>{tx("Język", "Language")}:</span>
          <span className="text-[var(--chan-ink)]">{current.label}</span>
          {chevron("h-3 w-3")}
        </button>
      ) : variant === "icon" ? (
        <button
          {...triggerProps}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-[var(--chan-ink)] transition-[background-color,box-shadow] duration-160 hover:bg-[var(--chan-surface)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
        >
          <Globe className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
        </button>
      ) : (
        <button
          {...triggerProps}
          className="flex h-[38px] items-center gap-1.5 rounded-full border border-[var(--cm-line-84)] bg-[var(--cm-card-82-white)] pl-2.5 pr-2 text-[var(--chan-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition-[border-color,box-shadow] duration-160 hover:border-[var(--chan-blue)] hover:shadow-[0_4px_14px_rgba(37,99,235,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
        >
          <Globe className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <span className="text-[11px] font-extrabold uppercase tracking-[0.08em]">{current.code}</span>
          {chevron("h-3.5 w-3.5 text-[var(--chan-muted)]")}
        </button>
      )}

      {open && inline ? (
        <div
          {...listboxProps}
          className="relative grid w-full basis-full grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-0.5 rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--chan-blue)]"
        >
          {rows(true)}
        </div>
      ) : null}

      {open && !inline ? (
        <div
          className={`${styles.panel} fixed left-2 right-2 top-[60px] z-[1100] flex flex-col overflow-hidden rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] font-sans text-[var(--chan-ink)] shadow-[0_20px_50px_rgba(15,23,42,0.14)] sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[256px]`}
        >
          <div
            {...listboxProps}
            className={`${styles.scroller} max-h-[calc(100dvh-72px)] overflow-y-auto overscroll-contain p-1.5 outline-none`}
          >
            {rows(false)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
