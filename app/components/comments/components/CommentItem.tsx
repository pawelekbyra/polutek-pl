"use client";

import React, { useState, useRef, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { Star, Trash2, Heart, MoreVertical, Edit, Flag, Link as LinkIcon, EyeOff, RotateCcw } from "../../icons";
import { cn } from "@/lib/utils";
import { CommentView, getAvatarSeed, isPatronAuthor } from "../types";
import { SafeAvatar } from "../../SafeAvatar";
import { ReportDialog } from "./ReportDialog";
import { CommentReportReasonDto } from "@/lib/modules/comments/domain/comment-frontend.dto";
import { useToast } from "@/app/hooks/useToast";
import { NajsIcon } from "../../najs/primitives";
import { AnimatedCount, LikePop } from "./comment-motion";

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
  isReply?: boolean;
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
  const [isHearted, setIsHearted] = React.useState<boolean>(comment.isHearted || false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const commentRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === `#comment-${comment.id}`) {
      setIsHighlighted(true);
      commentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      const timer = setTimeout(() => setIsHighlighted(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [comment.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  return (
    <div
      id={`comment-${comment.id}`}
      ref={commentRef}
      className={cn(
        "relative flex items-start gap-[13px] rounded-2xl bg-white p-[16px_14px] shadow-[0_1px_2px_rgba(23,23,23,0.05),0_8px_20px_rgba(23,23,23,0.06)] transition-colors duration-1000",
        isReply ? "group/reply" : "group/comment",
        isHighlighted && "ring-2 ring-blue-100",
      )}
    >
      {!isReply && comment.isPinned && (
        <span className="absolute right-0 top-0 z-[6] inline-flex items-center gap-1 rounded-bl-lg rounded-tr-2xl bg-blue-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-blue-600">
          <Star size={10} className="fill-blue-600" />
          {language === "pl" ? "Przypięty" : "Pinned"}
        </span>
      )}
      <div className={cn("relative z-[5] flex shrink-0 flex-col items-center gap-1", isReply ? "w-[38px]" : "w-[38px]")}>
        <div className="w-[38px] h-[38px] rounded-full overflow-hidden border border-border relative">
            <SafeAvatar
            src={comment.author?.imageUrl}
            alt={comment.author?.displayName || "Avatar"}
            size={38}
            fallbackSeed={getAvatarSeed(comment)}
            className="w-full h-full object-cover"
            />
        </div>
        {authorIsPatron && (
          <span className="bg-accent-soft text-primary text-[8px] font-extrabold px-[5px] py-[1px] rounded-full border border-accent-ring tracking-wider uppercase whitespace-nowrap">
            6-7
          </span>
        )}
      </div>
      <div className={cn("relative z-[5] flex-1 space-y-[2px] min-w-0 pt-0", !isReply && comment.isPinned && "pr-[86px]")}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={cn(
                "font-bold text-[#0f0f0f] leading-tight text-[13px]",
              )}
            >
              {comment.author?.displayName || "Użytkownik"}
            </span>

            <span className={cn("text-[#8A857B] leading-none text-[12px]")}>
              {isClient &&
              comment.createdAt &&
              !isNaN(new Date(comment.createdAt).getTime())
                ? formatDistanceToNow(new Date(comment.createdAt), {
                    addSuffix: true,
                    locale: pl,
                  }).replace("około", "ok.")
                : isClient
                  ? (isReply ? t.justNow : "niedawno")
                  : ""}
            </span>
          </div>
          <div className="relative" ref={menuRef}>
            {userProfile && (
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={cn(
                "p-1 rounded-full hover:bg-neutral-100 transition-opacity",
                showMenu ? "opacity-100" : "opacity-0 group-hover/comment:opacity-100 group-hover/reply:opacity-100"
              )}
            >
              <MoreVertical size={16} />
            </button>
            )}

            {userProfile && showMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-neutral-200 rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in duration-150">
                <button
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.hash = `comment-${comment.id}`;
                    navigator.clipboard.writeText(url.toString());
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2"
                >
                  <LinkIcon size={14} /> {language === "pl" ? "Kopiuj link" : "Copy link"}
                </button>

                {comment.viewerCanEdit && (
                  <button
                    onClick={() => { setIsEditing(true); setShowMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2"
                  >
                    <Edit size={14} /> {language === "pl" ? "Edytuj" : "Edit"}
                  </button>
                )}
                {comment.viewerCanDelete && (
                  <button
                    onClick={() => { if(confirm(t.deleteComment)) onDelete(comment.id); setShowMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2 text-neutral-600"
                  >
                    <Trash2 size={14} /> {language === "pl" ? "Usuń" : "Delete"}
                  </button>
                )}

                {comment.viewerCanReport && (
                  <button
                    onClick={() => { setIsReportDialogOpen(true); setShowMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2"
                  >
                    <Flag size={14} /> {language === "pl" ? "Zgłoś" : "Report"}
                  </button>
                )}

                {/* Admin/Moderator actions */}
                {!isReply && comment.viewerCanPin && (
                   <button
                    onClick={() => { onPin(comment.id, !comment.isPinned); setShowMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2"
                  >
                    <Star size={14} /> {comment.isPinned ? (language === "pl" ? "Odepnij" : "Unpin") : (language === "pl" ? "Przypnij" : "Pin")}
                  </button>
                )}

                {comment.viewerCanModerate && comment.status === 'VISIBLE' && !isReply && (
                  <button
                    onClick={handleHide}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2"
                  >
                    <EyeOff size={14} /> {language === "pl" ? "Ukryj" : "Hide"}
                  </button>
                )}

                {comment.viewerCanModerate && comment.status === 'HIDDEN' && !isReply && (
                  <button
                    onClick={handleRestore}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2"
                  >
                    <RotateCcw size={14} /> {language === "pl" ? "Przywróć" : "Restore"}
                  </button>
                )}

                {comment.viewerCanModerate && !isReply && (
                  <button
                    onClick={async () => {
                        try {
                            const res = await fetch(`/api/admin/comments/${comment.id}/heart`, { method: "POST" });
                            if (res.ok) {
                                setIsHearted(prev => !prev);
                                toast(language === "pl" ? "Serce twórcy zaktualizowane." : "Creator heart updated.", "success");
                            }
                        } catch (err) {}
                        setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2 text-primary"
                  >
                    <Star size={14} className={isHearted ? "fill-primary" : ""} /> {isHearted ? (language === "pl" ? "Usuń serce" : "Remove heart") : (language === "pl" ? "Daj serce" : "Give heart")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="mt-1 space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full bg-secondary border border-border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <div className="flex gap-2">
               <button
                onClick={() => setIsEditing(false)}
                className="text-xs font-bold px-3 py-1 rounded-md hover:bg-secondary"
               >
                 {t.cancel}
               </button>
               <button
                onClick={() => { onEdit(comment.id, editText); setIsEditing(false); }}
                disabled={!editText.trim() || editText === comment.text}
                className="text-xs font-bold px-3 py-1 bg-primary text-white rounded-md hover:brightness-110 disabled:opacity-50"
               >
                 {language === "pl" ? "Zapisz" : "Save"}
               </button>
            </div>
          </div>
        ) : (
          <p className="text-[#0f0f0f] text-[14px] leading-[1.5]">
            {comment.text || (comment.status === 'DELETED' ? (language === 'pl' ? 'Komentarz usunięty' : 'Comment deleted') : '')}
          </p>
        )}

        <ReportDialog
          isOpen={isReportDialogOpen}
          onClose={() => setIsReportDialogOpen(false)}
          language={language}
          onSubmit={(reason, note) => onReport(comment.id, reason, note)}
        />

        <div className="flex flex-wrap items-center gap-[10px] pt-1 min-w-0">
          <button
            onClick={() => userProfile && onLike(comment.id)}
            className={cn(
              "inline-flex h-6 shrink-0 items-center justify-center gap-1.5 transition-all group",
              isLiked
                ? "text-primary"
                : "text-[#606060] hover:text-[#0f0f0f]",
            )}
          >
            <LikePop active={isLiked}>
              <NajsIcon
                name="like"
                className="h-[15px] w-[15px]"
                stroke={isLiked ? "#2563eb" : "currentColor"}
              />
            </LikePop>
            <AnimatedCount value={comment.likesCount || 0} className="font-semibold text-[13px]" />
          </button>

          <button
            onClick={() => userProfile && onDislike(comment.id)}
            className={cn(
              "inline-flex h-6 shrink-0 items-center justify-center transition-all",
              comment.viewerReaction === "DISLIKE" ? "text-primary" : "text-[#606060] hover:text-[#0f0f0f]",
            )}
            aria-label={language === "pl" ? "Nie lubię" : "Dislike"}
          >
            <NajsIcon
              name="dislike"
              className="h-[15px] w-[15px]"
              stroke={comment.viewerReaction === "DISLIKE" ? "#2563eb" : "currentColor"}
            />
          </button>

          {isHearted && (
            <span title={language === "pl" ? "Serce twórcy" : "Creator heart"} className="inline-flex items-center">
              <Heart size={14} className="fill-primary text-primary" />
            </span>
          )}

          {!isReply && canComment && (
            <button
              onClick={() => userProfile && onReply(comment.id)}
              className="text-[12px] font-bold text-[#0f0f0f] hover:bg-secondary px-2.5 py-0.5 rounded-md transition-all"
            >
              {t.reply || "Odpowiedz"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
