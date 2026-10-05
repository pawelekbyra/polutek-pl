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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommentReportReasonDto } from "@/lib/modules/comments/domain/comment-frontend.dto";
import type { Locale } from "@/lib/i18n/routing";
import type { Tx } from "@/lib/i18n/ui";
import { useOptionalTx } from "@/lib/i18n/language-context";

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
      setError(
        submitError instanceof Error && submitError.message
          ? submitError.message
          : tx("Nie udało się wysłać zgłoszenia.", "Could not send the report."),
      );
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
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-reason`}>
              {tx("Powód", "Reason")}
            </Label>
            <Select value={reason} onValueChange={(v) => setReason(v as CommentReportReasonDto)}>
              <SelectTrigger id={`${idPrefix}-reason`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(REASON_LABELS) as CommentReportReasonDto[]).map((value) => (
                  <SelectItem key={value} value={value}>{REASON_LABELS[value](tx)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
