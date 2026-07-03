"use client";

import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DonationLegalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  /** Route to the full legal document, e.g. /regulamin. */
  href?: string;
  hrefLabel?: string;
}

export default function DonationLegalDialog({ open, onOpenChange, title, body, href, hrefLabel }: DonationLegalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="border-b pb-4 text-2xl font-black uppercase tracking-tighter">{title}</DialogTitle>
        </DialogHeader>
        <div className="prose prose-sm prose-neutral max-w-none text-foreground">
          <p>{body}</p>
          {href && (
            <p>
              <Link href={href} className="font-bold underline hover:text-primary" target="_blank" rel="noopener noreferrer">
                {hrefLabel ?? href}
              </Link>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
