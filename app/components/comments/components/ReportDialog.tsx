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

/** Same limit as the report API (`note` max 500). */
export const REPORT_NOTE_MAX_LENGTH = 500;

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Resolves when the report is stored; rejects with a message to show otherwise. */
  onSubmit: (reason: CommentReportReasonDto, note?: string) => Promise<void>;
  language: string;
}

const REASON_LABELS: Record<CommentReportReasonDto, { pl: string; en: string }> = {
  SPAM: { pl: "Spam", en: "Spam" },
  HARASSMENT: { pl: "Nękanie", en: "Harassment" },
  HATE: { pl: "Mowa nienawiści", en: "Hate speech" },
  NSFW: { pl: "Treści nieodpowiednie", en: "Inappropriate content" },
  SPOILER: { pl: "Spoiler", en: "Spoiler" },
  OTHER: { pl: "Inne", en: "Other" },
};

export function ReportDialog({ isOpen, onClose, onSubmit, language }: ReportDialogProps) {
  const [reason, setReason] = useState<CommentReportReasonDto>("SPAM");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idPrefix = useId();
  const pl = language === "pl";

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
          : pl ? "Nie udało się wysłać zgłoszenia." : "Could not send the report.",
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
            {pl ? "Zgłoś komentarz" : "Report comment"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-reason`}>
              {pl ? "Powód" : "Reason"}
            </Label>
            <Select value={reason} onValueChange={(v) => setReason(v as CommentReportReasonDto)}>
              <SelectTrigger id={`${idPrefix}-reason`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(REASON_LABELS) as CommentReportReasonDto[]).map((value) => (
                  <SelectItem key={value} value={value}>{REASON_LABELS[value][pl ? "pl" : "en"]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-note`}>
              {pl ? "Opcjonalna notatka" : "Optional note"}
            </Label>
            <Textarea
              id={`${idPrefix}-note`}
              value={note}
              maxLength={REPORT_NOTE_MAX_LENGTH}
              aria-describedby={`${idPrefix}-note-count`}
              onChange={(e) => setNote(e.target.value)}
              placeholder={pl ? "Opisz problem..." : "Describe the issue..."}
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
            {pl ? "Anuluj" : "Cancel"}
          </Button>
          <Button onClick={() => void handleSubmit()} variant="destructive" disabled={isSubmitting}>
            {pl ? "Zgłoś" : "Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
