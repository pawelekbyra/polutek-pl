"use client";

import React, { useLayoutEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/routing";
import { useOptionalTx } from "@/lib/i18n/language-context";

interface DeleteCommentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  language: Locale;
}

/** Our own confirmation for deleting a comment (instead of the browser's system `confirm` box). */
export function DeleteCommentDialog({ isOpen, onClose, onConfirm, language }: DeleteCommentDialogProps) {
  const tx = useOptionalTx(language);
  const openerRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (isOpen) openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [isOpen]);

  const restoreFocus = () => {
    if (openerRef.current?.isConnected) return openerRef.current;
    return document.querySelector<HTMLElement>("main h1, [role='main'] h1, main, [role='main']") ?? document.body;
  };

  const focusMainFallback = () => {
    const waitForDialogToClose = () => {
      if (openerRef.current?.isConnected) return;
      if (document.querySelector('[data-slot="dialog-content"]')) {
        window.setTimeout(waitForDialogToClose, 50);
        return;
      }
      requestAnimationFrame(() => {
        const fallback = document.querySelector<HTMLElement>("main h1, [role='main'] h1, main, [role='main']");
        if (!fallback) return;
        fallback.tabIndex = 0;
        fallback.focus({ preventScroll: true });
        requestAnimationFrame(() => {
          if (fallback.isConnected && document.activeElement === fallback) fallback.tabIndex = -1;
        });
      });
    };
    window.setTimeout(waitForDialogToClose, 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent finalFocus={restoreFocus} className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{tx("Usunąć komentarz?", "Delete comment?")}</DialogTitle>
          <DialogDescription>
            {tx("Komentarz zniknie z rozmowy.", "The comment will disappear from the conversation.")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {tx("Anuluj", "Cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onClose();
              focusMainFallback();
            }}
          >
            {tx("Usuń", "Delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
