"use client";

import React from "react";
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
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
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
            }}
          >
            {tx("Usuń", "Delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
