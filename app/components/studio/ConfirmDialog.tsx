"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Dialog, DialogOverlay, DialogPopup, DialogPortal } from "@/components/ui/dialog";
import { buttonClass, dangerButtonClass, ghostButtonClass } from "./ui";
import { useOptionalTx } from "@/lib/i18n/language-context";

/** A modal confirmation that isolates background content and exposes pending work to assistive technology. */
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
  const openerRef = useRef<HTMLElement | null>(null);
  const tx = useOptionalTx();

  useLayoutEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, []);

  useLayoutEffect(() => {
    if (busy) panelRef.current?.focus({ preventScroll: true });
  }, [busy]);

  const restoreFocus = () => {
    if (openerRef.current?.isConnected) return openerRef.current;
    const fallback = document.querySelector<HTMLElement>("main h1, [role='main'] h1, main, [role='main']");
    if (fallback) {
      fallback.tabIndex = 0;
      requestAnimationFrame(() => {
        if (fallback.isConnected && document.activeElement === fallback) fallback.tabIndex = -1;
      });
    }
    return fallback ?? document.body;
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // Escape and outside-click are intentionally ignored while a mutation is pending.
        if (!open && !busy) onCancel();
      }}
    >
      <DialogPortal>
        <DialogOverlay className="z-[80] bg-black/50" />
        <DialogPopup
          ref={panelRef}
          finalFocus={restoreFocus}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-body"
          aria-busy={busy}
          tabIndex={-1}
          className="fixed inset-x-4 bottom-4 z-[81] mx-auto grid w-full max-w-md gap-0 rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-5 text-left text-[var(--chan-ink)] shadow-xl outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2"
        >
          <h2 id="confirm-dialog-title" className="text-[17px] font-bold text-[var(--chan-ink)]">
            {title}
          </h2>
          <div id="confirm-dialog-body" className="mt-2 text-[14px] text-[var(--chan-muted)]">
            {children}
          </div>
          <p role="status" aria-live="polite" className="sr-only">
            {busy ? tx("Operacja w toku.", "Operation in progress.") : ""}
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" className={ghostButtonClass} disabled={busy} onClick={onCancel}>
              {cancelLabel}
            </button>
            <button type="button" className={danger ? dangerButtonClass : buttonClass} disabled={busy} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
