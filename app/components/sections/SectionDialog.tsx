"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useLanguage } from "@/app/components/LanguageContext";

/**
 * Small modal for the prototype pages: bottom sheet on phones, centered card on larger screens. Closes on Escape
 * and on a click outside, locks page scrolling, and gives focus back to the element that opened it.
 * z-[1100] keeps it above the section bar (900) and the top bar (1000).
 */
export default function SectionDialog({
  label,
  onClose,
  children,
  side = false,
  onKeyDown,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  /** Slides in from the right edge instead (cart drawer). */
  side?: boolean;
  onKeyDown?: (event: React.KeyboardEvent) => void;
}) {
  const { tx } = useLanguage();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[1100] flex bg-black/55 backdrop-blur-[2px] ${side ? "items-stretch justify-end" : "items-end justify-center sm:items-center sm:p-6"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
          onKeyDown?.(event);
        }}
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-[var(--chan-card)] text-[var(--chan-ink)] shadow-2xl outline-none ${
          side ? "max-h-none max-w-sm rounded-l-3xl" : "max-w-3xl rounded-t-3xl sm:rounded-3xl"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={tx("Zamknij", "Close")}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--chan-card)]/90 text-[var(--chan-ink)] shadow-sm transition hover:bg-[var(--chan-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-blue)]"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        {children}
      </div>
    </div>
  );
}
