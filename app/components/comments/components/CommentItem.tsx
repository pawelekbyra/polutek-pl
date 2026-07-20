"use client";

import React, { useState, useRef, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import { Star, Trash2, Heart, MoreVertical, Edit, Flag, Link as LinkIcon, EyeOff, RotateCcw } from "../../icons";
import { cn } from "@/lib/utils";
import { CommentView, getAvatarSeed, isPatronAuthor } from "../types";
import { SafeAvatar } from "../../SafeAvatar";
import { ReportDialog } from "./ReportDialog";
import { CommentReportReasonDto } from "@/lib/modules/comments/domain/comment-frontend.dto";
import { useToast } from "@/app/hooks/useToast";
import { NajsIcon } from "../../najs/primitives";
import { AnimatedCount, LikePop } from "./comment-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CommentItemProps {
  comment: CommentView;
  userProfile: { id?: string } | null;
  isClient: boolean;
  language: string;
  t: Record<string, string>;
  canComment: boolean;
  onLike: (id: string) => void;
  onDislike: (id: string) => void;
  onReply: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onEdit: (id: string, text: string) => void;
  onReport: (id: string, reason: CommentReportReasonDto, note?: string) => void;
  isPinPending: boolean;
  isReactionPending: boolean;
  isReply?: boolean;
}

function formatCommentAge(date: Date, language: string) {
  const formatted = formatDistanceToNow(date, {
    addSuffix: true,
    locale: language === "pl" ? pl : enUS,
  });

  return language === "pl" ? formatted.replace("około", "ok.") : formatted;
}

export function CommentItem({
  comment,
  userProfile,
  isClient,
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
  const isDeletedForPublic = comment.status === 'DELETED';

  const authorIsPatron = isPatronAuthor(comment.author);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text || "");
  const [showMenu, setShowMenu] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const toast = useToast();

  const isLiked = comment.viewerReaction === "LIKE";
  const isDisliked = comment.viewerReaction === "DISLIKE";
  const reactionsDisabled = !userProfile || !canComment || isReactionPending;
  const [isHearted, setIsHearted] = React.useState<boolean>(comment.isHearted || false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const commentRef = useRef<HTMLDivElement>(null);

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

  const handleHide = async () => {
    try {
      const res = await fetch(`/api/admin/comments/${comment.id}/hide`, { method: "POST" });
      if (res.ok) {
        toast(language === "pl" ? "Komentarz ukryty." : "Comment hidden.", "success");
      } else {
        toast(language === "pl" ? "Błąd ukrywania." : "Error hiding.", "error");
      }
    } catch (err) {
      toast("Error", "error");
    }
    setShowMenu(false);
  };

  const handleRestore = async () => {
    try {
      const res = await fetch(`/api/admin/comments/${comment.id}/restore`, { method: "POST" });
      if (res.ok) {
        toast(language === "pl" ? "Komentarz przywrócony." : "Comment restored.", "success");
      } else {
        toast(language === "pl" ? "Błąd przywracania." : "Error restoring.", "error");
      }
    } catch (err) {
      toast("Error", "error");
    }
    setShowMenu(false);
  };

  if (isDeletedForPublic) return null;

  const createdAtDate = comment.createdAt
    ? new Date(comment.createdAt)
    : null;
  const validCreatedAt =
    createdAtDate && !Number.isNaN(createdAtDate.getTime())
      ? createdAtDate
      : null;
  const relativeCreatedAt = isClient
    ? validCreatedAt
      ? formatCommentAge(validCreatedAt, language)
      : isReply
        ? t.justNow
        : language === "pl"
          ? "niedawno"
          : "recently"
    : "";
  const menuItemClassName =
    "min-h-10 gap-2 rounded-xl px-3 py-2 text-sm text-[var(--chan-ink)] focus:bg-[var(--chan-surface)] focus:text-[var(--chan-ink)]";

  return (
    <div
      id={`comment-${comment.id}`}
      ref={commentRef}
      className={cn(
        "relative flex items-start gap-[13px] border-t border-[var(--chan-line)] px-1 py-[18px] transition-colors duration-1000 first:border-t-0 first:pt-0",
        isReply ? "group/reply" : "group/comment",
        isHighlighted && "-mx-1 rounded-lg bg-[var(--chan-blue-soft)]/60 px-2",
      )}
    >
      {!isReply && comment.isPinned && (
        <span className="absolute right-1 top-[18px] z-[6] inline-flex items-center gap-1 rounded-full bg-[var(--chan-blue-soft)] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-[var(--chan-blue)]">
          <Star size={14} className="fill-[var(--chan-blue)]" />
          {language === "pl" ? "Przypięty" : "Pinned"}
        </span>
      )}
      <div className={cn("relative z-[5] flex shrink-0 flex-col items-center gap-1", isReply ? "w-[38px]" : "w-[38px]")}>
        <div className="w-[38px] h-[38px] rounded-full overflow-hidden border border-[var(--chan-line)] relative">
            <SafeAvatar
            src={comment.author?.imageUrl}
            alt={comment.author?.displayName || "Avatar"}
            size={38}
            fallbackSeed={getAvatarSeed(comment)}
            className="w-full h-full object-cover"
            />
        </div>
        {authorIsPatron && (
          <span className="whitespace-nowrap rounded-full border border-[color-mix(in_srgb,var(--chan-blue)_35%,transparent)] bg-[var(--chan-blue-soft)] px-[5px] py-[1px] text-[8px] font-extrabold uppercase tracking-wider text-[var(--chan-blue)]">
            PATRON
          </span>
        )}
      </div>
      <div className={cn("relative z-[5] flex-1 space-y-[2px] min-w-0 pt-0", !isReply && comment.isPinned && "pr-[86px]")}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={cn(
                "font-bold text-[var(--chan-ink)] leading-tight text-[13px]",
              )}
            >
              {comment.author?.displayName || "Użytkownik"}
            </span>

            <time
              className="text-[12px] leading-none text-[var(--chan-muted)]"
              dateTime={validCreatedAt ? comment.createdAt : undefined}
            >
              {relativeCreatedAt}
            </time>
          </div>
          {userProfile && (
            <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
              <DropdownMenuTrigger
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full transition-[opacity,background-color] hover:bg-[var(--chan-surface)] focus-visible:bg-[var(--chan-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] motion-reduce:transition-none",
                  showMenu
                    ? "opacity-100"
                    : "opacity-0 group-hover/comment:opacity-100 group-hover/reply:opacity-100 group-focus-within/comment:opacity-100 group-focus-within/reply:opacity-100 focus:opacity-100",
                )}
                aria-label={
                  language === "pl" ? "Akcje komentarza" : "Comment actions"
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
                  {language === "pl" ? "Kopiuj link" : "Copy link"}
                </DropdownMenuItem>

                {comment.viewerCanEdit && (
                  <DropdownMenuItem
                    onClick={() => setIsEditing(true)}
                    className={menuItemClassName}
                  >
                    <Edit aria-hidden="true" size={14} />
                    {language === "pl" ? "Edytuj" : "Edit"}
                  </DropdownMenuItem>
                )}
                {comment.viewerCanDelete && (
                  <DropdownMenuItem
                    onClick={() => {
                      if (confirm(t.deleteComment)) onDelete(comment.id);
                    }}
                    className={cn(menuItemClassName, "text-neutral-600")}
                  >
                    <Trash2 aria-hidden="true" size={14} />
                    {language === "pl" ? "Usuń" : "Delete"}
                  </DropdownMenuItem>
                )}
                {comment.viewerCanReport && (
                  <DropdownMenuItem
                    onClick={() => setIsReportDialogOpen(true)}
                    className={menuItemClassName}
                  >
                    <Flag aria-hidden="true" size={14} />
                    {language === "pl" ? "Zgłoś" : "Report"}
                  </DropdownMenuItem>
                )}
                {!isReply && comment.viewerCanPin && (
                  <DropdownMenuItem
                    onClick={() => onPin(comment.id, !comment.isPinned)}
                    className={menuItemClassName}
                  >
                    <Star aria-hidden="true" size={16} />
                    {comment.isPinned
                      ? language === "pl"
                        ? "Odepnij"
                        : "Unpin"
                      : language === "pl"
                        ? "Przypnij"
                        : "Pin"}
                  </DropdownMenuItem>
                )}
                {comment.viewerCanModerate &&
                  comment.status === "VISIBLE" &&
                  !isReply && (
                    <DropdownMenuItem
                      onClick={() => void handleHide()}
                      className={menuItemClassName}
                    >
                      <EyeOff aria-hidden="true" size={14} />
                      {language === "pl" ? "Ukryj" : "Hide"}
                    </DropdownMenuItem>
                  )}
                {comment.viewerCanModerate &&
                  comment.status === "HIDDEN" &&
                  !isReply && (
                    <DropdownMenuItem
                      onClick={() => void handleRestore()}
                      className={menuItemClassName}
                    >
                      <RotateCcw aria-hidden="true" size={14} />
                      {language === "pl" ? "Przywróć" : "Restore"}
                    </DropdownMenuItem>
                  )}
                {comment.viewerCanModerate && !isReply && (
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        const response = await fetch(
                          `/api/admin/comments/${comment.id}/heart`,
                          { method: "POST" },
                        );
                        if (response.ok) {
                          setIsHearted((current) => !current);
                          toast(
                            language === "pl"
                              ? "Serce twórcy zaktualizowane."
                              : "Creator heart updated.",
                            "success",
                          );
                        }
                      } catch {
                        toast(
                          language === "pl"
                            ? "Nie udało się zmienić serca twórcy."
                            : "Could not update the creator heart.",
                          "error",
                        );
                      }
                    }}
                    className={cn(
                      menuItemClassName,
                      "text-[var(--chan-amber-strong)] focus:text-[var(--chan-amber-strong)]",
                    )}
                  >
                    <Star
                      aria-hidden="true"
                      size={16}
                      className={isHearted ? "fill-[var(--chan-amber)]" : ""}
                    />
                    {isHearted
                      ? language === "pl"
                        ? "Usuń serce"
                        : "Remove heart"
                      : language === "pl"
                        ? "Daj serce"
                        : "Give heart"}
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
              className="w-full bg-white border border-[var(--chan-line)] rounded-md p-2 text-sm shadow-[0_1px_0_rgba(15,15,15,0.10),0_6px_14px_rgba(15,15,15,0.06)] focus:outline-none focus:ring-2 focus:ring-[var(--chan-ink)]/20"
              autoFocus
            />
            <div className="flex gap-2">
               <button
                onClick={() => setIsEditing(false)}
                className="text-xs font-bold px-3 py-1 rounded-md hover:bg-[var(--chan-surface)]"
               >
                 {t.cancel}
               </button>
               <button
                onClick={() => { onEdit(comment.id, editText); setIsEditing(false); }}
                disabled={!editText.trim() || editText === comment.text}
                className="text-xs font-bold px-3 py-1 bg-[var(--chan-blue)] text-white rounded-md hover:brightness-110 disabled:opacity-50"
               >
                 {language === "pl" ? "Zapisz" : "Save"}
               </button>
            </div>
          </div>
        ) : (
          <p className="text-[var(--chan-ink)] text-[14px] leading-[1.5]">
            {comment.text || (comment.status === 'DELETED' ? (language === 'pl' ? 'Komentarz usunięty' : 'Comment deleted') : '')}
          </p>
        )}

        <ReportDialog
          isOpen={isReportDialogOpen}
          onClose={() => setIsReportDialogOpen(false)}
          language={language}
          onSubmit={(reason, note) => onReport(comment.id, reason, note)}
        />

        <div className="flex flex-wrap items-center gap-[6px] pt-1 min-w-0">
          {/* Like + Dislike zgrupowane razem */}
          <div className="flex items-center gap-0">
            <button
              type="button"
              onClick={() => onLike(comment.id)}
              disabled={reactionsDisabled}
              aria-label={
                isLiked
                  ? language === "pl"
                    ? "Cofnij polubienie komentarza"
                    : "Remove like from comment"
                  : language === "pl"
                    ? "Polub komentarz"
                    : "Like comment"
              }
              aria-pressed={isLiked}
              className={cn(
                "group inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full px-2 transition-[color,background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] focus-visible:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 motion-reduce:transition-none",
                isLiked
                  ? "text-[var(--chan-blue)]"
                  : "text-[var(--chan-muted)] enabled:hover:bg-[var(--chan-surface)] enabled:hover:text-[var(--chan-ink)]",
              )}
            >
              <LikePop active={isLiked}>
                <NajsIcon
                  name="like"
                  className="h-4 w-4"
                  stroke={isLiked ? "var(--chan-blue)" : "currentColor"}
                />
              </LikePop>
              <AnimatedCount value={comment.likesCount || 0} className="font-semibold text-[12px] leading-none" />
            </button>

            <button
              type="button"
              onClick={() => onDislike(comment.id)}
              disabled={reactionsDisabled}
              className={cn(
                "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full px-2 transition-[color,background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] focus-visible:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 motion-reduce:transition-none",
                isDisliked
                  ? "text-[var(--chan-blue)]"
                  : "text-[var(--chan-muted)] enabled:hover:bg-[var(--chan-surface)] enabled:hover:text-[var(--chan-ink)]",
              )}
              aria-label={
                isDisliked
                  ? language === "pl"
                    ? "Cofnij reakcję nie lubię"
                    : "Remove dislike from comment"
                  : language === "pl"
                    ? "Nie lubię komentarza"
                    : "Dislike comment"
              }
              aria-pressed={isDisliked}
            >
              <NajsIcon
                name="dislike"
                className="h-4 w-4"
                stroke={isDisliked ? "var(--chan-blue)" : "currentColor"}
              />
            </button>
          </div>

          {isHearted && (
            <span
              aria-label={language === "pl" ? "Serce twórcy" : "Creator heart"}
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
