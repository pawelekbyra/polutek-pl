"use client";

import React, { useState } from "react";
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

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: CommentReportReasonDto, note?: string) => void;
  language: string;
}

export function ReportDialog({ isOpen, onClose, onSubmit, language }: ReportDialogProps) {
  const [reason, setReason] = useState<CommentReportReasonDto>("SPAM");
  const [note, setNote] = useState("");

  const handleSubmit = () => {
    onSubmit(reason, note);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {language === "pl" ? "Zgłoś komentarz" : "Report comment"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="reason">
              {language === "pl" ? "Powód" : "Reason"}
            </Label>
            <Select value={reason} onValueChange={(v) => setReason(v as CommentReportReasonDto)}>
              <SelectTrigger id="reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SPAM">{language === "pl" ? "Kijowy Komentarz" : "Spam"}</SelectItem>
                <SelectItem value="HARASSMENT">{language === "pl" ? "Nękanie" : "Harassment"}</SelectItem>
                <SelectItem value="HATE">{language === "pl" ? "Mowa nienawiści" : "Hate speech"}</SelectItem>
                <SelectItem value="NSFW">{language === "pl" ? "Treści nieodpowiednie" : "NSFW"}</SelectItem>
                <SelectItem value="SPOILER">{language === "pl" ? "Spoiler" : "Spoiler"}</SelectItem>
                <SelectItem value="OTHER">{language === "pl" ? "Inne" : "Other"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="note">
              {language === "pl" ? "Opcjonalna notatka" : "Optional note"}
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={language === "pl" ? "Opisz problem..." : "Describe the issue..."}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {language === "pl" ? "Anuluj" : "Cancel"}
          </Button>
          <Button onClick={handleSubmit} variant="destructive">
            {language === "pl" ? "Zgłoś" : "Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
