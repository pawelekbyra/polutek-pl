"use client";

import React, { useState, useRef, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { Star, Trash2, ThumbsUp, ThumbsDown, MoreVertical, Edit, Flag, Link as LinkIcon, EyeOff, RotateCcw } from "../../icons";
import { cn } from "@/lib/utils";
import { CommentView, getAvatarSeed, isPatronAuthor } from "../types";
import { SafeAvatar } from "../../SafeAvatar";
import { ReportDialog } from "./ReportDialog";
import { CommentReportReasonDto } from "@/lib/services/comments/comment.dto";
import { useToast } from "@/app/hooks/useToast";

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
  onReply,
  onDelete,
  onPin,
  onEdit,
  onReport,
  isPinPending,
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
  const isHearted = (comment as
any).isHearted || false;
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
        "flex items-start transition-colors duration-1000",
        isReply ? "gap-2.5 group/reply" : "gap-3 group/comment",
        isHighlighted && "bg-blue-50 ring-2 ring-blue-100 rounded-lg p-2 -m-2"
      )}
    >
      <div className={cn("flex shrink-0 flex-col items-center gap-1", isReply ? "w-8" : "w-11")}>
        <SafeAvatar
          src={comment.author?.imageUrl}
          alt={comment.author?.displayName || "Avatar"}
          size={isReply ? 24 : 36}
          fallbackSeed={getAvatarSeed(comment)}
          className={cn(
            "mt-0",
            authorIsPatron
              ? isReply
                ? "border-2 border-amber-300 shadow-[0_0_0_2px_rgba(251,191,36,0.18)]"
                : "border-2 border-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.2),0_8px_18px_rgba(180,83,9,0.16)]"
              : "border border-[#e9eef6]",
          )}
        />
        {authorIsPatron && (
          <span className={cn(
            "rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 font-black uppercase leading-none tracking-[0.12em] text-amber-950 shadow-sm ring-1 ring-amber-200",
            isReply ? "px-1 py-0.5 text-[7px]" : "px-1.5 py-0.5 text-[8px]"
          )}>
            Patron
          </span>
        )}
      </div>
      <div className="flex-1 space-y-0.5 min-w-0 pt-0.5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={cn(
                "font-bold text-[#0f0f0f] leading-none",
                isReply ? "text-[11px]" : "text-[12px]",
                authorIsPatron && "text-amber-900",
              )}
            >
              {comment.author?.displayName || "Użytkownik"}
            </span>
            {!isReply && comment.isPinned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-blue-600">
                <Star size={10} className="fill-blue-600" />
                {language === "pl" ? "Przypięty" : "Pinned"}
              </span>
            )}
            <span className={cn("text-[#606060] leading-none", isReply ? "text-[10px]" : "text-[11px]")}>
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
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={cn(
                "p-1 rounded-full hover:bg-neutral-100 transition-opacity",
                showMenu ? "opacity-100" : "opacity-0 group-hover/comment:opacity-100 group-hover/reply:opacity-100"
              )}
            >
              <MoreVertical size={16} />
            </button>

            {showMenu && (
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
                                toast(language === "pl" ? "Serce twórcy zaktualizowane." : "Creator heart updated.", "success");
                                // We could force refetch but let's keep it simple
                            }
                        } catch (err) {}
                        setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2 text-blue-600"
                  >
                    <Star size={14} className={isHearted ? "fill-blue-600" : ""} /> {isHearted ? (language === "pl" ? "Usuń serce" : "Remove heart") : (language === "pl" ? "Daj serce" : "Give heart")}
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
              className="w-full bg-neutral-50 border border-neutral-200 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-2">
               <button
                onClick={() => setIsEditing(false)}
                className="text-xs font-bold px-3 py-1 rounded-md hover:bg-neutral-100"
               >
                 {t.cancel}
               </button>
               <button
                onClick={() => { onEdit(comment.id, editText); setIsEditing(false); }}
                disabled={!editText.trim() || editText === comment.text}
                className="text-xs font-bold px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
               >
                 {language === "pl" ? "Zapisz" : "Save"}
               </button>
            </div>
          </div>
        ) : (
          <p className="text-[#0f0f0f] text-[13px] leading-relaxed">
            {comment.text || (comment.status === 'DELETED' ? (language === 'pl' ? 'Komentarz usunięty' : 'Comment deleted') : '')}
          </p>
        )}

        <ReportDialog
          isOpen={isReportDialogOpen}
          onClose={() => setIsReportDialogOpen(false)}
          language={language}
          onSubmit={(reason, note) => onReport(comment.id, reason, note)}
        />

        <div className="flex items-center gap-3 pt-0.5">
          <button
            onClick={() => userProfile && onLike(comment.id)}
            className={cn(
              "inline-flex h-6 min-w-8 items-center justify-center gap-1 rounded-md px-1 transition-all group",
              isLiked
                ? "text-primary"
                : "text-[#606060] hover:text-[#0f0f0f]",
            )}
          >
            <ThumbsUp
              size={isReply ? 11 : 13}
              className={cn(isLiked && "fill-primary")}
            />
            <span className={cn("font-normal", isReply ? "text-[10px]" : "text-[11px]")}>
              {comment.likesCount || 0}
            </span>
          </button>

          {isHearted && (
             <div className="flex items-center gap-1 bg-neutral-100 rounded-full px-1.5 py-0.5 border border-neutral-200">
                <SafeAvatar
                  src={null} // We could show creator avatar but simplified for now
                  alt="Creator Heart"
                  size={12}
                  className="rounded-full bg-blue-500 flex items-center justify-center border-none"
                  fallbackSeed="heart"
                />
                <span className="text-[9px] font-black uppercase text-blue-600 tracking-tighter">Serce twórcy</span>
             </div>
          )}

          {!isReply && canComment && (
            <button
              onClick={() => userProfile && onReply(comment.id)}
              className="text-[11px] font-bold text-[#0f0f0f] hover:bg-[#dbeafe] px-2.5 py-0.5 rounded-md ml-1 transition-all"
            >
              {t.reply}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
