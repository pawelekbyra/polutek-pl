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
}

interface TipSelectProps {
  label: string;
  value: string | null;
  options: TipSelectOption[];
  onChange: (value: string) => void;
  /** Greyed out and not openable (e.g. while the choice is locked). */
  disabled?: boolean;
  /** The checkout's field: 52 px tall, soft-blue, rounded, with a round symbol badge and a chevron button; looks interactive at a glance. */
  tile?: boolean;
  /** A short line under the field (what the choice affects); announced with the control. */
  hint?: string;
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
function measureList(trigger: HTMLElement): ListPosition {
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
      left: field.left - frame.left,
      width: field.width,
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
export function TipSelect({ label, value, options, onChange, disabled = false, tile, hint }: TipSelectProps) {
  const [position, setPosition] = useState<ListPosition | null>(null);
  const open = position !== null;
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const labelId = useId();
  const hintId = useId();
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

  const setOpen = (next: boolean) => setPosition(next && triggerRef.current ? measureList(triggerRef.current) : null);

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

  return (
    <div ref={rootRef} className="block">
      <span id={labelId} className={FIELD_LABEL_CLASS}>
        {label}
      </span>
      <div
        className={cn(
          tile
            ? "rounded-[14px] border-[1.5px] border-[var(--pass-blue-edge,#9fc3f5)] bg-[var(--pass-blue-soft,#e8f1ff)] shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_6px_14px_-10px_rgba(37,99,235,0.45)] transition-[border-color,box-shadow,background-color] duration-150 motion-reduce:transition-none"
            : "rounded-[16px] border-2 bg-[#d4e7ff] transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none",
          tile
            ? open
              ? "border-[var(--chan-blue,#2563eb)] bg-white shadow-[0_0_0_3px_rgba(37,99,235,0.16)]"
              : "hover:border-[var(--chan-blue,#2563eb)] hover:bg-white"
            : open
              ? "border-[var(--chan-ink)] shadow-[0_10px_24px_-14px_rgba(70,140,230,0.55)]"
              : "border-[#9fc3f5] hover:border-[var(--chan-ink)]",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-labelledby={labelId}
          aria-describedby={hint ? hintId : undefined}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? optionId(active) : undefined}
          disabled={disabled}
          onClick={toggle}
          onKeyDown={onKeyDown}
          className={cn(
            "flex w-full items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
            tile
              ? "min-h-[52px] rounded-[13px] px-3 focus-visible:ring-[var(--chan-blue,#2563eb)]"
              : "min-h-[52px] px-4 focus-visible:ring-[var(--chan-ink)]",
          )}
        >
          {SelectedIcon ? (
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center">
              <SelectedIcon className="h-6 w-6" />
            </span>
          ) : selectedIconStr ? (
            <span
              aria-hidden="true"
              className={cn(
                "flex shrink-0 items-center justify-center font-bold text-[var(--chan-ink)]",
                tile ? "h-8 w-8 rounded-full bg-[var(--pass-blue-fill,#d4e7ff)] text-[14px] shadow-[inset_0_0_0_1px_var(--pass-blue-edge,#9fc3f5)]" : "h-6 w-6 text-[15px]",
              )}
            >
              {selectedIconStr}
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-extrabold text-[var(--chan-ink)]">{selected?.title ?? "—"}</span>
            {selected?.hint && <span className="block truncate text-[12px] text-[var(--chan-body)]">{selected.hint}</span>}
          </span>
          {tile ? (
            <span
              aria-hidden="true"
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--pass-blue-edge,#9fc3f5)] bg-white text-[var(--chan-blue,#2563eb)] transition-transform duration-200 motion-reduce:transition-none",
                open && "rotate-180",
              )}
            >
              <SelectChevron className="h-4 w-4" />
            </span>
          ) : (
            <SelectChevron
              className={cn(
                "h-5 w-5 shrink-0 text-[var(--chan-blue)] transition-transform duration-200 motion-reduce:transition-none",
                open && "rotate-180",
              )}
            />
          )}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="mt-2 text-[12px] leading-[1.4] text-[var(--chan-muted)]">
          {hint}
        </p>
      )}
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
