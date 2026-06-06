"use client";

import React from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { Star, Trash2, ThumbsUp, ThumbsDown } from "../../icons";
import { cn } from "@/lib/utils";
import { CommentView, getAvatarSeed, isPatronAuthor } from "../types";

interface CommentItemProps {
  comment: CommentView;
  userProfile: { id: string } | null;
  isClient: boolean;
  language: string;
  t: Record<string, string>;
  canComment: boolean;
  onLike: (id: string) => void;
  onDislike: (id: string) => void;
  onReply: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
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
  isPinPending,
  isReply = false
}: CommentItemProps) {
  const authorIsPatron = isPatronAuthor(comment.author);

  return (
    <div className={cn("flex items-start", isReply ? "gap-2.5 group/reply" : "gap-3 group/comment")}>
      <div className={cn("flex shrink-0 flex-col items-center gap-1", isReply ? "w-8" : "w-11")}>
        <div
          className={cn(
            "relative rounded-full bg-[#eff6ff] flex items-center justify-center overflow-hidden mt-0",
            isReply ? "w-6 h-6" : "w-9 h-9",
            authorIsPatron
              ? isReply
                ? "border-2 border-amber-300 shadow-[0_0_0_2px_rgba(251,191,36,0.18)]"
                : "border-2 border-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.2),0_8px_18px_rgba(180,83,9,0.16)]"
              : "border border-[#e9eef6]",
          )}
        >
          <Image
            src={
              comment.author?.imageUrl ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(getAvatarSeed(comment))}`
            }
            alt="Avatar"
            fill
            sizes={isReply ? "24px" : "36px"}
            className="object-cover"
            unoptimized
          />
        </div>
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
              {comment.authorName}
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
          <div className={cn(
            "flex items-center gap-1 transition-opacity",
            isReply
              ? "opacity-0 group-hover/reply:opacity-40 hover:!opacity-100"
              : "opacity-0 group-hover/comment:opacity-60"
          )}>
            {!isReply && comment.canPin && (
              <button
                onClick={() => onPin(comment.id, !comment.isPinned)}
                disabled={isPinPending}
                className={cn(
                  "rounded-md p-1 hover:!opacity-100 hover:bg-blue-50",
                  comment.isPinned && "text-blue-600 opacity-100",
                )}
                title={
                  comment.isPinned
                    ? language === "pl"
                      ? "Odepnij komentarz"
                      : "Unpin comment"
                    : language === "pl"
                      ? "Przypnij komentarz"
                      : "Pin comment"
                }
              >
                <Star
                  size={12}
                  className={cn(comment.isPinned && "fill-blue-600")}
                />
              </button>
            )}
            {userProfile?.id === comment.authorId && (
              <button
                onClick={() =>
                  confirm(t.deleteComment) &&
                  onDelete(comment.id)
                }
                className={cn(
                  "rounded-md p-1 hover:!opacity-100 hover:bg-red-50",
                  isReply && "p-1"
                )}
              >
                <Trash2 size={isReply ? 10 : 12} className="text-destructive" />
              </button>
            )}
          </div>
        </div>
        <p className="text-[#0f0f0f] text-[13px] leading-relaxed">
          {comment.text}
        </p>
        <div className="flex items-center gap-3 pt-0.5">
          <button
            onClick={() => userProfile && onLike(comment.id)}
            className={cn(
              "inline-flex h-6 min-w-8 items-center justify-center gap-1 rounded-md px-1 transition-all group",
              comment.isLiked
                ? "text-primary"
                : "text-[#606060] hover:text-[#0f0f0f]",
            )}
          >
            <ThumbsUp
              size={isReply ? 11 : 13}
              className={cn(comment.isLiked && "fill-primary")}
            />
            <span className={cn("font-normal", isReply ? "text-[10px]" : "text-[11px]")}>
              {comment._count?.likes || 0}
            </span>
          </button>
          <button
            onClick={() => userProfile && onDislike(comment.id)}
            className={cn(
              "inline-flex h-6 min-w-8 items-center justify-center gap-1 rounded-md px-1 transition-all group",
              comment.isDisliked
                ? "text-black"
                : "text-[#606060] hover:text-[#0f0f0f]",
            )}
          >
            <ThumbsDown
              size={isReply ? 11 : 13}
              className={cn(comment.isDisliked && "fill-black")}
            />
            <span className={cn("font-normal", isReply ? "text-[10px]" : "text-[11px]")}>
              {comment._count?.dislikes || 0}
            </span>
          </button>
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
