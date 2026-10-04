"use client";

import type React from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/routing";
import { filterLanguages, LANGUAGE_OPTIONS, normalizeLanguageQuery, type LanguageOption } from "./languages";

const NOTE_VISIBLE_MS = 4500;
const TYPEAHEAD_RESET_MS = 600;

type Options = {
  language: Locale;
  onSelect: (locale: Locale) => void;
  /** Inline lists have no search field: the list itself takes focus and typing jumps (type-ahead). */
  inline: boolean;
};

/**
 * State and keyboard model shared by both switcher variants. The list follows the WAI-ARIA
 * combobox/listbox pattern with aria-activedescendant: DOM focus stays on the search field (or on
 * the listbox when there is no field), arrows/Home/End move the active option, Enter picks it,
 * Escape closes and returns focus to the button.
 */
export function useLanguagePicker({ language, onSelect, inline }: Options) {
  const [open, setOpen] = useState(false);
  // A listed-but-untranslated language the user picked: shown in the button until reload.
  const [preview, setPreview] = useState<LanguageOption | null>(null);
  const [noteVisible, setNoteVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (option: LanguageOption) => `${baseId}-${option.code}`;

  const real = LANGUAGE_OPTIONS.find((o) => o.locale === language) ?? LANGUAGE_OPTIONS[0];
  const current = preview ?? real;
  const results = useMemo(() => filterLanguages(query), [query]);
  const active = activeIndex >= 0 ? results[activeIndex] : undefined;

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const toggle = () => {
    if (open) {
      close(false);
      return;
    }
    setQuery("");
    setActiveIndex(LANGUAGE_OPTIONS.findIndex((o) => o.code === current.code));
    setOpen(true);
  };

  const updateQuery = (value: string) => {
    setQuery(value);
    setActiveIndex(filterLanguages(value).length > 0 ? 0 : -1);
  };

  const pick = (option: LanguageOption) => {
    close(true);
    if (option.locale) {
      setPreview(null);
      setNoteVisible(false);
      onSelect(option.locale);
      return;
    }
    setPreview(option);
    setNoteVisible(true);
  };

  // Outside press closes without moving focus; Escape anywhere closes too.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  // Initial focus: the search field, except on touch screens, where it would pop up the on-screen
  // keyboard over the list before the user asked to type; there the list takes focus instead.
  useEffect(() => {
    if (!open) return;
    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (!inline && !coarse && inputRef.current) inputRef.current.focus();
    else listRef.current?.focus();
  }, [open, inline]);

  useEffect(() => {
    if (!open || !active) return;
    document.getElementById(`${baseId}-${active.code}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, baseId]);

  useEffect(() => {
    if (!noteVisible) return;
    const timer = window.setTimeout(() => setNoteVisible(false), NOTE_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [noteVisible]);

  const move = (to: number) => {
    if (results.length === 0) return;
    setActiveIndex((to + results.length) % results.length);
  };

  /** Type-ahead for lists without a search field: jump to the next name starting with the typed text. */
  const jumpTo = (char: string) => {
    const now = Date.now();
    const state = typeahead.current;
    state.text = now - state.at > TYPEAHEAD_RESET_MS ? char : state.text + char;
    state.at = now;
    const prefix = normalizeLanguageQuery(state.text);
    const order = results.map((_, i) => (activeIndex + 1 + i) % results.length);
    const hit = order.find(
      (i) => normalizeLanguageQuery(results[i].label).startsWith(prefix) || normalizeLanguageQuery(results[i].code).startsWith(prefix),
    );
    if (hit !== undefined) setActiveIndex(hit);
  };

  const onListKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const fromInput = event.currentTarget === inputRef.current;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        if (fromInput && event.key === "ArrowRight") return;
        event.preventDefault();
        move(activeIndex + 1);
        return;
      case "ArrowUp":
      case "ArrowLeft":
        if (fromInput && event.key === "ArrowLeft") return;
        event.preventDefault();
        move(activeIndex < 0 ? results.length - 1 : activeIndex - 1);
        return;
      case "Home":
        event.preventDefault();
        move(0);
        return;
      case "End":
        event.preventDefault();
        move(results.length - 1);
        return;
      case "Enter": {
        const target = active ?? results[0];
        if (!target) return;
        event.preventDefault();
        pick(target);
        return;
      }
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      case "Tab":
        if (!inline) close(false);
        return;
      default:
        if (fromInput || event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
        if (!inline && inputRef.current) {
          // Typing on the list goes to the search field (the character lands there).
          inputRef.current.focus();
          return;
        }
        event.preventDefault();
        jumpTo(event.key);
    }
  };

  return {
    open,
    query,
    results,
    active,
    current,
    real,
    noteVisible,
    listId,
    optionId,
    rootRef,
    triggerRef,
    inputRef,
    listRef,
    toggle,
    pick,
    updateQuery,
    setActiveIndex,
    onListKeyDown,
  };
}
