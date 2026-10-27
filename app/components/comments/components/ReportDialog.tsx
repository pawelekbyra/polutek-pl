"use client";

import React, { useId, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CommentReportReasonDto } from "@/lib/modules/comments/domain/comment-frontend.dto";
import type { Locale } from "@/lib/i18n/routing";
import type { Tx } from "@/lib/i18n/ui";
import { useOptionalTx } from "@/lib/i18n/language-context";
import { commentErrorText } from "../comment-errors";

/** Same limit as the report API (`note` max 500). */
export const REPORT_NOTE_MAX_LENGTH = 500;

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Resolves when the report is stored; rejects with a message to show otherwise. */
  onSubmit: (reason: CommentReportReasonDto, note?: string) => Promise<void>;
  language: Locale;
}

const REASON_LABELS: Record<CommentReportReasonDto, (tx: Tx) => string> = {
  SPAM: (tx) => tx("Spam", "Spam"),
  HARASSMENT: (tx) => tx("Nękanie", "Harassment"),
  HATE: (tx) => tx("Mowa nienawiści", "Hate speech"),
  NSFW: (tx) => tx("Treści nieodpowiednie", "Inappropriate content"),
  SPOILER: (tx) => tx("Spoiler", "Spoiler"),
  OTHER: (tx) => tx("Inne", "Other"),
};

export function ReportDialog({ isOpen, onClose, onSubmit, language }: ReportDialogProps) {
  const [reason, setReason] = useState<CommentReportReasonDto>("SPAM");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idPrefix = useId();
  const tx = useOptionalTx(language);

  const close = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(reason, note.trim() || undefined);
      setNote("");
      onClose();
    } catch (submitError) {
      // Keep the dialog (and the typed note) so the viewer can retry.
      setError(commentErrorText(submitError, tx, tx("Nie udało się wysłać zgłoszenia.", "Could not send the report.")));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {tx("Zgłoś komentarz", "Report comment")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-sm font-medium leading-none">
              {tx("Powód", "Reason")}
            </legend>
            <div role="radiogroup" aria-label={tx("Powód", "Reason")} className="grid gap-1">
              {(Object.keys(REASON_LABELS) as CommentReportReasonDto[]).map((value) => {
                const selected = value === reason;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setReason(value)}
                    disabled={isSubmitting}
                    className={
                      "flex min-h-11 items-center gap-3 rounded-xl border px-3 text-left text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] " +
                      (selected
                        ? "border-[var(--chan-blue)] bg-[var(--chan-blue-soft)] font-semibold text-[var(--chan-ink)]"
                        : "border-[var(--chan-line)] text-[var(--chan-ink)] hover:bg-[var(--chan-surface)]")
                    }
                  >
                    <span
                      aria-hidden="true"
                      className={
                        "grid h-4 w-4 shrink-0 place-items-center rounded-full border " +
                        (selected ? "border-[var(--chan-blue)]" : "border-[var(--chan-muted-2)]")
                      }
                    >
                      {selected ? <span className="h-2 w-2 rounded-full bg-[var(--chan-blue)]" /> : null}
                    </span>
                    {REASON_LABELS[value](tx)}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-note`}>
              {tx("Opcjonalna notatka", "Optional note")}
            </Label>
            <Textarea
              id={`${idPrefix}-note`}
              value={note}
              maxLength={REPORT_NOTE_MAX_LENGTH}
              aria-describedby={`${idPrefix}-note-count`}
              onChange={(e) => setNote(e.target.value)}
              placeholder={tx("Opisz problem...", "Describe the issue...")}
            />
            <p id={`${idPrefix}-note-count`} className="text-right text-[11px] text-[var(--chan-muted)]">
              {note.length} / {REPORT_NOTE_MAX_LENGTH}
            </p>
          </div>
          {error && (
            <p role="alert" className="text-[13px] font-semibold text-red-700">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={isSubmitting}>
            {tx("Anuluj", "Cancel")}
          </Button>
          <Button onClick={() => void handleSubmit()} variant="destructive" disabled={isSubmitting}>
            {tx("Zgłoś", "Report")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
