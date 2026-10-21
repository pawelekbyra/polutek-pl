import React from "react";
import { cn } from "@/lib/utils";
import type { CommentBadgeKind } from "../types";
import type { Locale } from "@/lib/i18n/routing";
import { useOptionalTx } from "@/lib/i18n/language-context";

/** Badge shown under the author's avatar (CommentItem positions it), readable at 11 px. */
export function AuthorBadge({ kind, language }: { kind: CommentBadgeKind; language: Locale }) {
  const tx = useOptionalTx(language);
  const labels: Record<CommentBadgeKind, string> = { AUTHOR: tx("Twórca", "Creator") };
  return (
    <span
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center whitespace-nowrap rounded-full border border-[var(--cm-blue-22)] bg-[var(--chan-blue-soft)] px-2 text-[11px] font-semibold leading-none text-[var(--chan-blue)]",
      )}
    >
      {labels[kind]}
    </span>
  );
}
