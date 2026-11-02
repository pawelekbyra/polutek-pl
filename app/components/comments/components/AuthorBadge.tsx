import React from "react";
import { cn } from "@/lib/utils";
import type { CommentBadgeKind } from "../types";
import type { Locale } from "@/lib/i18n/routing";
import { useOptionalTx } from "@/lib/i18n/language-context";

/**
 * Small pill under the author's avatar. "AUTHOR" is the video's creator (blue); "VIP" is an active paid patron-zone
 * access (yellow with dark ink, 7:1 contrast). "VIP" is the same word in every language, so only its accessible name
 * is translated. `size="sm"` is for replies, whose avatar is 24 px: the pill stays narrow enough not to touch the text.
 */
export function AuthorBadge({ kind, language, size = "md" }: { kind: CommentBadgeKind; language: Locale; size?: "md" | "sm" }) {
  const tx = useOptionalTx(language);
  // Sentence case on purpose: the pill hangs under a 40 px (replies: 24 px) avatar and must stay narrower than the avatar
  // plus the 12 px gap to the text, also for "Créateur" / "Creatore"; capitals would be about 20% wider.
  const base = cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-bold leading-none",
    size === "sm" ? "h-[15px] rounded-[4px] px-[3px] text-[9px]" : "h-[17px] rounded-[5px] px-1.5 text-[10.5px]",
  );
  if (kind === "VIP") {
    const label = tx("Użytkownik VIP", "VIP user");
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        data-badge="vip"
        className={cn(base, "tracking-[0.04em] bg-[var(--chan-amber-bright)] text-[var(--chan-amber-ink)] ring-1 ring-inset ring-[var(--chan-amber-strong)]/40")}
      >
        VIP
      </span>
    );
  }
  return (
    <span data-badge="author" className={cn(base, "bg-[var(--cm-blue-14)] text-[var(--chan-blue)]")}>
      {tx("Twórca", "Creator")}
    </span>
  );
}
