"use client";

import type React from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/routing";
import { LANGUAGE_OPTIONS, startsWithTyped, type LanguageOption } from "./languages";

const NOTE_VISIBLE_MS = 4500;
const TYPEAHEAD_RESET_MS = 600;

type Options = {
  language: Locale;
  onSelect: (locale: Locale) => void;
  /** Inline lists stay open in the page flow when Tab leaves them; the floating panel closes. */
  inline: boolean;
};

/**
 * State and keyboard model shared by both switcher variants. The list follows the WAI-ARIA
 * listbox pattern with aria-activedescendant: on open, focus goes to the list with the current
 * language active; arrows/Home/End move, typing a letter jumps to the next name starting with it,
 * Enter picks, Escape closes and returns focus to the button.
 */
export function useLanguagePicker({ language, onSelect, inline }: Options) {
  const [open, setOpen] = useState(false);
  // A listed-but-untranslated language the user picked: shown in the button until reload.
  const [preview, setPreview] = useState<LanguageOption | null>(null);
  const [noteVisible, setNoteVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (option: LanguageOption) => `${baseId}-${option.code}`;

  const real = LANGUAGE_OPTIONS.find((o) => o.locale === language) ?? LANGUAGE_OPTIONS[0];
  const current = preview ?? real;
  const options = LANGUAGE_OPTIONS;
  const active = activeIndex >= 0 ? options[activeIndex] : undefined;

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setActiveIndex(-1);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const toggle = () => {
    if (open) {
      close(false);
      return;
    }
    setActiveIndex(options.findIndex((o) => o.code === current.code));
    setOpen(true);
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

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || !active) return;
    document.getElementById(`${baseId}-${active.code}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, baseId]);

  useEffect(() => {
    if (!noteVisible) return;
    const timer = window.setTimeout(() => setNoteVisible(false), NOTE_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [noteVisible]);

  const move = (to: number) => setActiveIndex((to + options.length) % options.length);

  /** Type-ahead: jump to the next language whose name or code starts with the typed letters. */
  const jumpTo = (char: string) => {
    const now = Date.now();
    const state = typeahead.current;
    state.text = now - state.at > TYPEAHEAD_RESET_MS ? char : state.text + char;
    state.at = now;
    const order = options.map((_, i) => (activeIndex + 1 + i) % options.length);
    const hit = order.find((i) => startsWithTyped(options[i], state.text));
    if (hit !== undefined) setActiveIndex(hit);
  };

  const onListKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        move(activeIndex + 1);
        return;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        move(activeIndex < 0 ? options.length - 1 : activeIndex - 1);
        return;
      case "Home":
        event.preventDefault();
        move(0);
        return;
      case "End":
        event.preventDefault();
        move(options.length - 1);
        return;
      case "Enter":
      case " ":
        if (!active) return;
        event.preventDefault();
        pick(active);
        return;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      case "Tab":
        if (!inline) close(false);
        return;
      default:
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
        event.preventDefault();
        jumpTo(event.key);
    }
  };

  return {
    open,
    options,
    active,
    current,
    real,
    noteVisible,
    listId,
    optionId,
    rootRef,
    triggerRef,
    listRef,
    toggle,
    pick,
    setActiveIndex,
    onListKeyDown,
  };
}
