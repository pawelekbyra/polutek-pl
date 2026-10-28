"use client";

import React, { useEffect, useId, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Check } from "../icons";

function SelectChevron({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M5 9.5 10.6 14a2.25 2.25 0 0 0 2.8 0L19 9.5" />
    </svg>
  );
}

export interface TipSelectOption {
  value: string;
  title: string;
  hint?: string;
  icon?: ComponentType<{ className?: string }> | string;
  /** Short text for the compact trigger (e.g. "zł · PLN"). */
  short?: string;
}

interface TipSelectProps {
  label: string;
  value: string | null;
  options: TipSelectOption[];
  onChange: (value: string) => void;
  /** Greyed out and not openable (e.g. while the choice is locked). */
  disabled?: boolean;
  /** A small blue pill (28 px, hit area 44 px) instead of the full field; the label stays for screen readers only, the caller shows its own text beside it. */
  compact?: boolean;
}

interface ListPosition {
  container: HTMLElement;
  style: React.CSSProperties;
}

/** The one typography of a field label in the gate and the patron checkout (13 px, body colour, --field-label-gap above the field: 8 px in the gate, set once by the checkout); the checkout's own labels (legend, step heading) import it. */
/** Label weight: regular in the gate, the checkout sets --field-label-weight once (bold section labels). */
export const FIELD_LABEL_WEIGHT = "font-[weight:var(--field-label-weight,400)]";
export const FIELD_LABEL_CLASS = `mb-[var(--field-label-gap,8px)] block text-[13px] leading-[1.55] ${FIELD_LABEL_WEIGHT} text-[var(--chan-body)]`;

const LIST_GAP = 6;
const EDGE = 8;

/**
 * Where the floating list goes: portalled into the gate's dialog (so it stays inside the
 * modal and isn't clipped by the scrolling step body), below the field or above it when
 * there's more room there. Measured on open; the list closes on scroll/resize instead of
 * following the field.
 */
function measureList(trigger: HTMLElement, compact = false): ListPosition {
  const dialog = trigger.closest<HTMLElement>('[role="dialog"]');
  const container = dialog ?? document.body;
  const field = trigger.getBoundingClientRect();
  const box = dialog?.getBoundingClientRect();
  // Absolute offsets start inside the dialog's border.
  const frame = box
    ? { top: box.top + dialog!.clientTop, left: box.left + dialog!.clientLeft, bottom: box.bottom }
    : { top: 0, left: 0, bottom: window.innerHeight };
  const below = frame.bottom - field.bottom - LIST_GAP - EDGE;
  const above = field.top - frame.top - LIST_GAP - EDGE;
  void above;
  const openDown = true;
  return {
    container,
    style: {
      position: dialog ? "absolute" : "fixed",
      left: compact ? field.right - frame.left - Math.max(field.width, 230) : field.left - frame.left,
      width: compact ? Math.max(field.width, 230) : field.width,
      maxHeight: Math.max(120, openDown ? below : above),
      ...(openDown
        ? { top: field.bottom - frame.top + LIST_GAP }
        : { bottom: frame.bottom - field.top + LIST_GAP }),
    },
  };
}

/**
 * The gate's own dropdown (instead of the browser's system list): a warm field whose list
 * floats on top of the step, so nothing below it moves.
 */
export function TipSelect({ label, value, options, onChange, disabled = false, compact }: TipSelectProps) {
  const [position, setPosition] = useState<ListPosition | null>(null);
  const open = position !== null;
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const labelId = useId();
  const optionId = (index: number) => `${listId}-opt-${index}`;
  const typeahead = useRef({ text: "", at: 0 });
  const selected = options.find((option) => option.value === value) ?? null;
  const selectedIcon = selected?.icon;
  const SelectedIcon = typeof selectedIcon === "function" ? selectedIcon : null;
  const selectedIconStr = typeof selectedIcon === "string" ? selectedIcon : null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPosition(null);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !listRef.current?.contains(target)) close();
    };
    const onScroll = (event: Event) => {
      if (!listRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  // The active option follows the arrows with aria-activedescendant; keep it inside the scrolled list.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, listId]);

  const setOpen = (next: boolean) => setPosition(next && triggerRef.current ? measureList(triggerRef.current, !!compact) : null);

  const toggle = () => {
    if (!open) setActive(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(!open);
  };

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape" && open) {
      // Close only the list, not the whole gate.
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === "Tab" && open) {
      // Tab leaves the control and takes the list with it (no choice is made).
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return toggle();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + step + options.length) % options.length);
      return;
    }
    if ((event.key === "Home" || event.key === "End") && open) {
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : options.length - 1);
      return;
    }
    if (event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey && options.length > 0) {
      // Type-ahead: jump to the next option whose title starts with the typed text.
      const now = Date.now();
      const memory = typeahead.current;
      memory.text = now - memory.at > 700 ? event.key.toLowerCase() : memory.text + event.key.toLowerCase();
      memory.at = now;
      const from = open ? active : Math.max(0, options.findIndex((option) => option.value === value));
      for (let step = 0; step < options.length; step += 1) {
        const index = (from + (memory.text.length === 1 ? step + 1 : step)) % options.length;
        if (options[index].title.toLowerCase().startsWith(memory.text)) {
          if (!open) toggle();
          setActive(index);
          break;
        }
      }
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      const option = options[active];
      if (option) choose(option.value);
    }
  };

  if (compact) {
    return (
      <div ref={rootRef} className="inline-block">
        <span id={labelId} className="sr-only">
          {label}
        </span>
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-labelledby={labelId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? optionId(active) : undefined}
          disabled={disabled}
          onClick={toggle}
          onKeyDown={onKeyDown}
          className="relative inline-flex -mt-2 h-7 -translate-y-[3px] items-center gap-1.5 rounded-full bg-[var(--pass-blue-soft,var(--chan-blue-soft))] ring-1 ring-inset ring-[var(--pass-blue-line,var(--chan-line))] px-3 text-[13px] font-bold text-[var(--chan-ink)] before:absolute before:-bottom-1.5 before:-top-2.5 before:inset-x-0 before:content-[''] hover:bg-[var(--pass-blue-fill,var(--chan-blue-soft))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-ink)] disabled:opacity-50"
        >
          <span>{selected?.short ?? selected?.title ?? "—"}</span>
          <SelectChevron className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
        </button>
        {position &&
          createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-labelledby={labelId}
              style={position.style}
              className="tip-select-scroll z-50 m-0 list-none overflow-y-auto overscroll-contain rounded-[16px] border-2 border-[var(--chan-ink)] bg-white p-1.5 shadow-[0_18px_40px_-16px_rgba(23,23,23,0.35)]"
            >
              {options.map((option, index) => (
                <li
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => choose(option.value)}
                  onPointerEnter={() => setActive(index)}
                  className={cn("flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[12px] px-3 transition-colors", index === active && "bg-[#e6f0ff]")}
                >
                  <span className="min-w-0 flex-1 text-[14px] font-bold text-[var(--chan-ink)]">{option.title}</span>
                  {option.value === value && <Check className="h-4 w-4 shrink-0 text-[var(--chan-ink)]" />}
                </li>
              ))}
            </ul>,
            position.container,
          )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="block">
      <span id={labelId} className={FIELD_LABEL_CLASS}>
        {label}
      </span>
      <div
        className={cn(
          "rounded-[16px] border-2 bg-[#d4e7ff] transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none",
          open
            ? "border-[var(--chan-ink)] shadow-[0_10px_24px_-14px_rgba(70,140,230,0.55)]"
            : "border-[#9fc3f5] hover:border-[var(--chan-ink)]",
          disabled && "pointer-events-none opacity-50 hover:border-[#9fc3f5]",
        )}
      >
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-labelledby={labelId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? optionId(active) : undefined}
          disabled={disabled}
          onClick={toggle}
          onKeyDown={onKeyDown}
          className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--chan-ink)]"
        >
          {SelectedIcon ? (
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center">
              <SelectedIcon className="h-6 w-6" />
            </span>
          ) : selectedIconStr ? (
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center text-[15px] font-bold text-[var(--chan-ink)]">{selectedIconStr}</span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-extrabold text-[var(--chan-ink)]">{selected?.title ?? "—"}</span>
            {selected?.hint && <span className="block truncate text-[12px] text-[var(--chan-body)]">{selected.hint}</span>}
          </span>
          <SelectChevron
            className={cn(
              "h-4 w-4 shrink-0 text-[var(--chan-ink)] transition-transform duration-200 motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </button>
      </div>
      {position &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={labelId}
            style={position.style}
            className="tip-select-scroll z-50 m-0 list-none overflow-y-auto overscroll-contain rounded-[16px] border-2 border-[var(--chan-ink)] bg-white p-1.5 shadow-[0_18px_40px_-16px_rgba(23,23,23,0.35)] animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const itemIconRaw = option.icon;
              const ItemIcon = typeof itemIconRaw === "function" ? itemIconRaw : null;
              const itemIconStr = typeof itemIconRaw === "string" ? itemIconRaw : null;
              return (
                <li
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => choose(option.value)}
                  onPointerEnter={() => setActive(index)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 transition-colors",
                    index === active && "bg-[#e6f0ff]",
                  )}
                >
                  {ItemIcon ? (
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d4e7ff]">
                      <ItemIcon className="h-5 w-5" />
                    </span>
                  ) : itemIconStr ? (
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d4e7ff] text-[14px] font-bold text-[var(--chan-ink)]">{itemIconStr}</span>
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold text-[var(--chan-ink)]">{option.title}</span>
                    {option.hint && <span className="block text-[12px] text-[var(--chan-muted)]">{option.hint}</span>}
                  </span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-[var(--chan-ink)]" />}
                </li>
              );
            })}
          </ul>,
          position.container,
        )}
    </div>
  );
}
