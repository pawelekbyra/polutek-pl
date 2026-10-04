import React from "react";
import { cn } from "@/lib/utils";
import type { CommentBadgeKind } from "../types";

const BADGE_LABELS: Record<CommentBadgeKind, { pl: string; en: string }> = {
  AUTHOR: { pl: "Twórca", en: "Creator" },
};

/** Inline badge after the author's name, readable at 11 px. */
export function AuthorBadge({ kind, language }: { kind: CommentBadgeKind; language: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center rounded-md bg-[var(--chan-ink)] px-1.5 text-[11px] font-semibold leading-none text-white",
      )}
    >
      {BADGE_LABELS[kind][language === "pl" ? "pl" : "en"]}
    </span>
  );
}
