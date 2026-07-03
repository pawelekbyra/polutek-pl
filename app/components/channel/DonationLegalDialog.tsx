"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DonationLegalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
}

export default function DonationLegalDialog({ open, onOpenChange, title, body }: DonationLegalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="border-b pb-4 text-2xl font-black uppercase tracking-tighter">{title}</DialogTitle>
        </DialogHeader>
        <div className="prose prose-sm prose-neutral max-w-none text-foreground">
          <p>{body}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
