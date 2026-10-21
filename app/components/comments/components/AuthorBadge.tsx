import React from "react";
import { cn } from "@/lib/utils";
import type { CommentBadgeKind } from "../types";
import type { Locale } from "@/lib/i18n/routing";
import { useOptionalTx } from "@/lib/i18n/language-context";

/** Small label next to the author's name (the video's creator), readable at 10.5 px. */
export function AuthorBadge({ kind, language }: { kind: CommentBadgeKind; language: Locale }) {
  const tx = useOptionalTx(language);
  const labels: Record<CommentBadgeKind, string> = { AUTHOR: tx("Twórca", "Creator") };
  return (
    <span
      className={cn(
        "inline-flex h-[17px] shrink-0 items-center whitespace-nowrap rounded-[5px] bg-[var(--cm-blue-14)] px-1.5 text-[10.5px] font-bold uppercase leading-none tracking-[0.06em] text-[var(--chan-blue)]",
      )}
    >
      {labels[kind]}
    </span>
  );
}
