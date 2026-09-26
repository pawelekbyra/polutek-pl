"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "../icons";

export interface TipSelectOption {
  value: string;
  title: string;
  hint?: string;
  icon?: string;
}

interface TipSelectProps {
  label: string;
  value: string | null;
  options: TipSelectOption[];
  onChange: (value: string) => void;
}

/**
 * The gate's own dropdown (instead of the browser's system list): a warm field that expands in
 * place, so it never gets clipped by the fixed-size frame and the footer button stays put.
 */
export function TipSelect({ label, value, options, onChange }: TipSelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const labelId = useId();
  const selected = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

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
      <span id={labelId} className="mb-1.5 block text-[12px] font-bold text-[var(--chan-body)]">
        {label}
      </span>
      <div
        className={cn(
          "overflow-hidden rounded-[16px] border-2 bg-[var(--chan-amber-soft)] transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none",
          open
            ? "border-[var(--chan-amber)] shadow-[0_10px_24px_-14px_var(--cm-amber-62)]"
            : "border-[var(--cm-amber-38)] hover:border-[var(--chan-amber)]",
        )}
      >
        <button
          type="button"
          role="combobox"
          aria-labelledby={labelId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={toggle}
          onKeyDown={onKeyDown}
          className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--chan-blue)]"
        >
          {selected?.icon && (
            <span aria-hidden="true" className="text-[20px] leading-none">
              {selected.icon}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-extrabold text-[var(--chan-ink)]">{selected?.title ?? "—"}</span>
            {selected?.hint && <span className="block truncate text-[12px] text-[var(--chan-body)]">{selected.hint}</span>}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-[var(--chan-amber-ink)] transition-transform duration-200 motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </button>
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-labelledby={labelId}
            className="m-0 list-none border-t border-[var(--cm-amber-38)] bg-white p-1.5 animate-in fade-in slide-in-from-top-1 duration-150 motion-reduce:animate-none"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => choose(option.value)}
                  onPointerEnter={() => setActive(index)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 transition-colors",
                    index === active && "bg-[var(--chan-amber-soft)]",
                  )}
                >
                  {option.icon && (
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--chan-surface)] text-[17px]">
                      {option.icon}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold text-[var(--chan-ink)]">{option.title}</span>
                    {option.hint && <span className="block text-[12px] text-[var(--chan-muted)]">{option.hint}</span>}
                  </span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-[var(--chan-amber-ink)]" />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
