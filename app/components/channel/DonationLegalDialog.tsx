"use client";

import React from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DonationLegalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** "Effective as of…" line in the document's language. */
  effectiveDate: string;
  /** Full legal document body (e.g. <RegulaminContent />). */
  children?: React.ReactNode;
  /** Route to the standalone full legal document, e.g. /regulamin. */
  href?: string;
  hrefLabel?: string;
}

export default function DonationLegalDialog({
  open,
  onOpenChange,
  title,
  effectiveDate,
  children,
  href,
  hrefLabel,
}: DonationLegalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto bg-background">
        <DialogHeader className="border-b-2 border-[var(--chan-ink)]/10 pb-4">
          <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-[var(--chan-ink)]">{title}</DialogTitle>
          <p className="mt-1 text-xs text-[var(--chan-muted)]">{effectiveDate}</p>
        </DialogHeader>

        <div className="pt-2 text-[var(--chan-ink)]">
          {children}
          {href && (
            <div className="mt-10 border-t border-[var(--chan-ink)]/10 pt-6">
              <Link
                href={href}
                className="text-sm font-bold underline hover:text-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                {hrefLabel ?? href}
              </Link>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
