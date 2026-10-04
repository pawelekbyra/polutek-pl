import React from "react";
import { cn } from "@/lib/utils";
import type { CommentBadgeKind } from "../types";

const BADGE_LABELS: Record<CommentBadgeKind, { pl: string; en: string }> = {
  AUTHOR: { pl: "Twórca", en: "Creator" },
  PATRON: { pl: "Patron", en: "Patron" },
};

/** Inline badge after the author's name, readable at 11 px. */
export function AuthorBadge({ kind, language }: { kind: CommentBadgeKind; language: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center rounded-md px-1.5 text-[11px] font-semibold leading-none",
        kind === "AUTHOR"
          ? "bg-[var(--chan-ink)] text-white"
          : "border border-[var(--cm-blue-35)] bg-[var(--chan-blue-soft)] text-[var(--chan-blue)]",
      )}
    >
      {BADGE_LABELS[kind][language === "pl" ? "pl" : "en"]}
    </span>
  );
}
