"use client";

import React, { useState, useRef, useEffect } from "react";
import { formatDistance } from "date-fns";
import { dateFnsLocale } from "@/lib/i18n/date-locale";
import type { Locale } from "@/lib/i18n/routing";
import { useOptionalTx } from "@/lib/i18n/language-context";
import { Star, Trash2, Heart, MoreVertical, Edit, Flag, Link as LinkIcon } from "../../icons";
import { cn } from "@/lib/utils";
import { CommentView, getAuthorBadge } from "../types";
import { SafeAvatar } from "../../SafeAvatar";
import { ReportDialog } from "./ReportDialog";
import { CommentReportReasonDto } from "@/lib/modules/comments/domain/comment-frontend.dto";
import { useToast } from "@/app/hooks/useToast";
import { CommentReactions } from "./CommentReactions";
import { AuthorBadge } from "./AuthorBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRenderClock } from "../../RenderClock";

interface CommentItemProps {
  comment: CommentView;
  userProfile: { id?: string } | null;
  language: Locale;
  t: Record<string, string>;
  canComment: boolean;
  onLike: (id: string) => void;
  onDislike: (id: string) => void;
  onReply: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  /** Resolves when the edit is saved; the editor stays open with an error when it rejects. */
  onEdit: (id: string, text: string) => Promise<void> | void;
  /** Resolves when the report is stored; the dialog shows the error when it rejects. */
  onReport: (id: string, reason: CommentReportReasonDto, note?: string) => Promise<void> | void;
  isReactionPending: boolean;
  isReply?: boolean;
}

/** Avatar sizes: replies are visibly subordinate to their parent. */
const AVATAR_SIZE = 40;
const REPLY_AVATAR_SIZE = 24;

function formatCommentAge(date: Date, language: Locale, now: Date) {
  const formatted = formatDistance(date, now, {
    addSuffix: true,
    locale: dateFnsLocale(language),
  });

  return language === "pl" ? formatted.replace("około", "ok.") : formatted;
}

function CommentItemComponent({
  comment,
  userProfile,
  language,
  t,
  canComment,
  onLike,
  onDislike,
  onReply,
  onDelete,
  onPin,
  onEdit,
  onReport,
  isReactionPending,
  isReply = false
}: CommentItemProps) {
  const tx = useOptionalTx(language);
  const isDeletedForPublic = comment.status === 'DELETED';

  const authorBadge = getAuthorBadge(comment.author);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text || "");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const toast = useToast();

  const reactionsDisabled = !userProfile || !canComment || isReactionPending;
  // Creator heart: shown to everyone, set only from the admin panel (decision 8, docs/architecture/admin-phase5.md).
  const isHearted = comment.isHearted === true;
  const [isHighlighted, setIsHighlighted] = useState(false);
  const commentRef = useRef<HTMLDivElement>(null);
  // Server render time during hydration, live time after (RenderClock): no text swap on load.
  const now = useRenderClock();

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === `#comment-${comment.id}`) {
      setIsHighlighted(true);
      const shouldReduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      commentRef.current?.scrollIntoView({
        behavior: shouldReduceMotion ? "auto" : "smooth",
        block: "center",
      });
      const timer = setTimeout(() => setIsHighlighted(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [comment.id]);

  const startEditing = () => {
    setEditText(comment.text || "");
    setEditError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editText.trim() || editText === comment.text || isSavingEdit) return;
    setIsSavingEdit(true);
    setEditError(null);
    try {
      await onEdit(comment.id, editText);
      setIsEditing(false);
    } catch (error) {
      // Keep the editor and the typed text so nothing is lost.
      setEditError(
        error instanceof Error && error.message
          ? error.message
          : tx("Nie udało się zapisać zmian.", "Could not save your changes."),
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const submitReport = async (reason: CommentReportReasonDto, note?: string) => {
    await onReport(comment.id, reason, note);
    toast(
      tx("Dziękujemy, zgłoszenie zostało wysłane.", "Thanks, your report was sent."),
      "success",
    );
  };

  if (isDeletedForPublic) return null;

  const createdAtDate = comment.createdAt
    ? new Date(comment.createdAt)
    : null;
  const validCreatedAt =
    createdAtDate && !Number.isNaN(createdAtDate.getTime())
      ? createdAtDate
      : null;
  const relativeCreatedAt = now
    ? validCreatedAt
      ? formatCommentAge(validCreatedAt, language, now)
      : isReply
        ? t.justNow
        : tx("niedawno", "recently")
    : "";
  const menuItemClassName =
    "min-h-10 gap-2 rounded-xl px-3 py-2 text-sm text-[var(--chan-ink)] focus:bg-[var(--chan-surface)] focus:text-[var(--chan-ink)]";
  const avatarSize = isReply ? REPLY_AVATAR_SIZE : AVATAR_SIZE;

  // Layout (one source of spacing, no vertical padding on the item itself; the list's gap owns
  // the space between comments): avatar 40 px (replies 24 px) + 12 px gap, name line 18 px,
  // 2 px to the text (14/20), 4 px to the actions, whose like icon lines up with the text edge.
  return (
    <div
      id={`comment-${comment.id}`}
      ref={commentRef}
      className={cn(
        "relative flex items-start gap-3 rounded-lg transition-colors duration-300 motion-reduce:transition-none",
        isReply ? "group/reply" : "group/comment",
        isHighlighted && "-mx-2 bg-[var(--chan-blue-soft)]/60 px-2",
      )}
    >
      {/* Badges live under the avatar (never next to the name). The badge is positioned absolutely,
          centred on the avatar, so it never changes the column width or the text alignment. */}
      <div className="relative z-[5] shrink-0" style={{ width: avatarSize, height: avatarSize }}>
        <SafeAvatar
          src={comment.author?.imageUrl}
          alt={comment.author?.displayName || "Avatar"}
          size={avatarSize}
          className="border border-[var(--chan-line)]"
        />
        {authorBadge && (
          <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2">
            <AuthorBadge kind={authorBadge} language={language} />
          </span>
        )}
      </div>
      <div className="relative z-[5] min-w-0 flex-1">
        <div className={cn("relative flex items-start justify-between", userProfile && "pr-9")}>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] font-bold leading-[18px] text-[var(--chan-ink)]">
              {comment.author?.displayName || (tx("Użytkownik", "User"))}
            </span>
            <time
              className="shrink-0 whitespace-nowrap text-[12px] leading-[18px] text-[var(--chan-muted)]"
              dateTime={validCreatedAt ? comment.createdAt : undefined}
            >
              {relativeCreatedAt}
            </time>
            {!isReply && comment.isPinned && (
              <span
                role="img"
                aria-label={tx("Przypięty", "Pinned")}
                className="inline-flex shrink-0 text-[var(--chan-blue)]"
              >
                <Star size={12} aria-hidden="true" className="fill-[var(--chan-blue)]" />
              </span>
            )}
          </div>
          {userProfile && (
            <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
              <DropdownMenuTrigger
                className={cn(
                  "absolute -top-[9px] right-0 grid h-9 w-9 place-items-center rounded-full transition-[opacity,background-color] hover:bg-[var(--chan-surface)] focus-visible:bg-[var(--chan-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] motion-reduce:transition-none",
                  // Revealed on hover only where hover exists; on touch screens it is always visible.
                  showMenu
                    ? "opacity-100"
                    : "opacity-100 [@media(hover:hover)]:opacity-0 group-hover/comment:opacity-100 group-hover/reply:opacity-100 group-focus-within/comment:opacity-100 group-focus-within/reply:opacity-100 focus:opacity-100",
                )}
                aria-label={
                  tx("Akcje komentarza", "Comment actions")
                }
              >
                <MoreVertical aria-hidden="true" size={16} />
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                sideOffset={6}
                className="z-[1100] w-52 rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-1.5 text-[var(--chan-ink)] shadow-[0_14px_34px_-16px_rgba(15,23,42,0.3)] ring-0"
              >
                <DropdownMenuItem
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.hash = `comment-${comment.id}`;
                    void navigator.clipboard.writeText(url.toString());
                  }}
                  className={menuItemClassName}
                >
                  <LinkIcon aria-hidden="true" size={14} />
                  {tx("Kopiuj link", "Copy link")}
                </DropdownMenuItem>

                {comment.viewerCanEdit && (
                  <DropdownMenuItem
                    onClick={startEditing}
                    className={menuItemClassName}
                  >
                    <Edit aria-hidden="true" size={14} />
                    {tx("Edytuj", "Edit")}
                  </DropdownMenuItem>
                )}
                {comment.viewerCanDelete && (
                  <DropdownMenuItem
                    onClick={() => {
                      if (confirm(t.deleteComment)) onDelete(comment.id);
                    }}
                    className={cn(menuItemClassName, "text-[var(--chan-muted-2)]")}
                  >
                    <Trash2 aria-hidden="true" size={14} />
                    {tx("Usuń", "Delete")}
                  </DropdownMenuItem>
                )}
                {comment.viewerCanReport && (
                  <DropdownMenuItem
                    onClick={() => setIsReportDialogOpen(true)}
                    className={menuItemClassName}
                  >
                    <Flag aria-hidden="true" size={14} />
                    {tx("Zgłoś", "Report")}
                  </DropdownMenuItem>
                )}
                {!isReply && comment.viewerCanPin && (
                  <DropdownMenuItem
                    onClick={() => onPin(comment.id, !comment.isPinned)}
                    className={menuItemClassName}
                  >
                    <Star aria-hidden="true" size={16} />
                    {comment.isPinned
                      ? tx("Odepnij", "Unpin")
                      : tx("Przypnij", "Pin")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isEditing ? (
          <div className="mt-1 space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEditing();
                } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void saveEdit();
                }
              }}
              aria-label={tx("Edytuj komentarz", "Edit comment")}
              aria-invalid={Boolean(editError)}
              readOnly={isSavingEdit}
              className="w-full rounded-md border border-[var(--chan-line)] bg-[var(--chan-card)] p-2 text-sm text-[var(--chan-ink)] shadow-[0_1px_0_rgba(15,15,15,0.10),0_6px_14px_rgba(15,15,15,0.06)] focus:outline-none focus:ring-2 focus:ring-[var(--chan-ink)]/20"
              autoFocus
            />
            {editError && (
              <p role="alert" className="text-xs font-bold text-red-700">
                {editError}
              </p>
            )}
            <div className="flex gap-2">
               <button
                type="button"
                onClick={cancelEditing}
                className="text-xs font-bold px-3 py-1 rounded-md hover:bg-[var(--chan-surface)]"
               >
                 {t.cancel}
               </button>
               <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={!editText.trim() || editText === comment.text || isSavingEdit}
                className="text-xs font-bold px-3 py-1 bg-[var(--chan-blue)] text-white rounded-md hover:brightness-110 disabled:opacity-50"
               >
                 {tx("Zapisz", "Save")}
               </button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-5 text-[var(--chan-ink)]">
            {comment.text}
          </p>
        )}

        <ReportDialog
          isOpen={isReportDialogOpen}
          onClose={() => setIsReportDialogOpen(false)}
          language={language}
          onSubmit={submitReport}
        />

        {/* -ml-2 cancels the buttons' own padding so the like icon lines up with the text. */}
        <div className="-ml-2 mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
          <CommentReactions
            commentId={comment.id}
            likesCount={comment.likesCount}
            viewerReaction={comment.viewerReaction}
            disabled={reactionsDisabled}
            language={language}
            onLike={onLike}
            onDislike={onDislike}
          />

          {isHearted && (
            <span
              aria-label={tx("Serce twórcy", "Creator heart")}
              className="inline-flex h-8 items-center px-1 text-[var(--chan-amber)]"
              role="img"
            >
              <Heart
                size={15}
                className="fill-[var(--chan-amber)] text-[var(--chan-amber)]"
                aria-hidden="true"
              />
            </span>
          )}

          {!isReply && canComment && (
            <button
              type="button"
              onClick={() => userProfile && onReply(comment.id)}
              className="h-8 rounded-lg px-3 text-[12px] font-bold text-[var(--chan-ink)] transition-colors hover:bg-[var(--chan-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] motion-reduce:transition-none"
            >
              {t.reply || "Odpowiedz"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const CommentItem = React.memo(CommentItemComponent);
