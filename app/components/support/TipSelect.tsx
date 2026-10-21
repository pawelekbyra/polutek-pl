"use client";

import React, { useEffect, useId, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "../icons";

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
}

interface ListPosition {
  container: HTMLElement;
  style: React.CSSProperties;
}

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
export function TipSelect({ label, value, options, onChange }: TipSelectProps) {
  const [position, setPosition] = useState<ListPosition | null>(null);
  const open = position !== null;
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const labelId = useId();
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
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return toggle();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + step + options.length) % options.length);
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
      <span id={labelId} className="mb-2 block text-[13px] leading-[1.55] text-[var(--chan-body)]">
        {label}
      </span>
      <div
        className={cn(
          "rounded-[16px] border-2 bg-[var(--chan-blue-soft)] transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none",
          open
            ? "border-[var(--chan-ink)] shadow-[0_10px_24px_-14px_var(--cm-blue-34)]"
            : "border-[var(--cm-blue-28)] hover:border-[var(--chan-ink)]",
        )}
      >
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-labelledby={labelId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
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
          <ChevronDown
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
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => choose(option.value)}
                  onPointerEnter={() => setActive(index)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 transition-colors",
                    index === active && "bg-[var(--chan-blue-soft)]",
                  )}
                >
                  {ItemIcon ? (
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--cm-blue-14)]">
                      <ItemIcon className="h-5 w-5" />
                    </span>
                  ) : itemIconStr ? (
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--cm-blue-14)] text-[14px] font-bold text-[var(--chan-ink)]">{itemIconStr}</span>
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
