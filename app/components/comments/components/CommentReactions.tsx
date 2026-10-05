"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { NajsIcon } from "../../najs/primitives";
import { AnimatedCount, LikePop } from "./comment-motion";
import type { Locale } from "@/lib/i18n/routing";
import { useOptionalTx } from "@/lib/i18n/language-context";

interface CommentReactionsProps {
  commentId: string;
  likesCount: number;
  viewerReaction: "LIKE" | "DISLIKE" | null;
  disabled: boolean;
  language: Locale;
  onLike: (id: string) => void;
  onDislike: (id: string) => void;
}

const buttonClassName =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full px-2 transition-[color,background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] focus-visible:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 motion-reduce:transition-none";
const stateClassName = (active: boolean) =>
  active
    ? "text-[var(--chan-blue)]"
    : "text-[var(--chan-muted)] enabled:hover:bg-[var(--chan-surface)] enabled:hover:text-[var(--chan-ink)]";

/** Like (with its public count) and dislike (no public counter) of one comment. */
export function CommentReactions({ commentId, likesCount, viewerReaction, disabled, language, onLike, onDislike }: CommentReactionsProps) {
  const isLiked = viewerReaction === "LIKE";
  const isDisliked = viewerReaction === "DISLIKE";
  const tx = useOptionalTx(language);

  return (
    <div className="flex items-center gap-0">
      <button
        type="button"
        onClick={() => onLike(commentId)}
        disabled={disabled}
        aria-label={isLiked ? (tx("Cofnij polubienie komentarza", "Remove like from comment")) : tx("Polub komentarz", "Like comment")}
        aria-pressed={isLiked}
        className={cn("group", buttonClassName, stateClassName(isLiked))}
      >
        <LikePop active={isLiked}>
          <NajsIcon name="like" className="h-4 w-4" stroke={isLiked ? "var(--chan-blue)" : "currentColor"} />
        </LikePop>
        <AnimatedCount value={likesCount || 0} className="font-semibold text-[12px] leading-none" />
      </button>

      <button
        type="button"
        onClick={() => onDislike(commentId)}
        disabled={disabled}
        aria-label={isDisliked ? (tx("Cofnij reakcję nie lubię", "Remove dislike from comment")) : tx("Nie lubię komentarza", "Dislike comment")}
        aria-pressed={isDisliked}
        className={cn(buttonClassName, stateClassName(isDisliked))}
      >
        <NajsIcon name="dislike" className="h-4 w-4" stroke={isDisliked ? "var(--chan-blue)" : "currentColor"} />
      </button>
    </div>
  );
}
