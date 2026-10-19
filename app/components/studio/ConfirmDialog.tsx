"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { buttonClass, dangerButtonClass, ghostButtonClass } from "./ui";

/**
 * Our own confirmation dialog (the Studio does not use the browser's `window.confirm` for new features): a modal
 * `alertdialog` with the focus on "Cancel" (the safe choice), Tab kept inside, Esc and the backdrop cancel, and the
 * focus returned to whatever opened it.
 */
export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  busy = false,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => opener?.focus();
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (!busy) onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
        className="w-full max-w-md rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-5 shadow-xl"
      >
        <h2 id="confirm-dialog-title" className="text-[17px] font-bold text-[var(--chan-ink)]">
          {title}
        </h2>
        <div id="confirm-dialog-body" className="mt-2 text-[14px] text-[var(--chan-muted)]">
          {children}
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button ref={cancelRef} type="button" className={ghostButtonClass} disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={danger ? dangerButtonClass : buttonClass} disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
