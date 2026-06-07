"use client";

import React from "react";
import { CornerDownRight, Loader2 } from "../../icons";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { SafeAvatar } from "../../SafeAvatar";

interface CommentComposerProps {
  userProfile: any;
  userAvatarUrl: string | null;
  replyTo: string | null;
  replyingToAuthor: string | null | undefined;
  newComment: string;
  setNewComment: (val: string) => void;
  setReplyTo: (val: string | null) => void;
  isInputFocused: boolean;
  setIsInputFocused: (val: boolean) => void;
  canComment: boolean;
  isPatronGated: boolean;
  isPatron: boolean;
  isPending: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  t: any;
  language: string;
}

export function countGraphemes(text: string) {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter("pl", { granularity: "grapheme" }).segment(text)].length;
  }
  return Array.from(text).length;
}

const QUICK_EMOJIS = ["😀", "😂", "🔥", "👏", "❤️", "🙏", "💯", "😮"];

export function CommentComposer({
  userProfile,
  userAvatarUrl,
  replyTo,
  replyingToAuthor,
  newComment,
  setNewComment,
  setReplyTo,
  isInputFocused,
  setIsInputFocused,
  canComment,
  isPatronGated,
  isPatron,
  isPending,
  handleSubmit,
  t,
  language
}: CommentComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const graphemeCount = countGraphemes(newComment);
  const isTooLong = graphemeCount > 2000;

  const insertEmoji = (emoji: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = newComment;
    const before = text.substring(0, start);
    const after = text.substring(end);
    setNewComment(before + emoji + after);

    // Focus back and set cursor position after the emoji
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = start + emoji.length;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };
  return (
    <div
      className={cn(
        "flex items-start mb-10",
        userProfile ? "gap-5" : "gap-0",
      )}
    >
      {userProfile && (
        <SafeAvatar
          src={userAvatarUrl}
          alt={userProfile.name || "Avatar"}
          size={40}
          fallbackSeed={userProfile.id}
          className={cn(
            "mt-1",
            isPatron
              ? "border-2 border-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]"
              : "border border-[#e9eef6]",
          )}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="relative">
          {replyTo && userProfile && (
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#0f0f0f] bg-[#eff6ff] px-3 py-1 rounded-md w-fit mb-2 border border-[#e9eef6]">
              <CornerDownRight size={12} />
              {language === "pl" ? (
                <>
                  Odpowiadasz{" "}
                  <span className="font-black ml-1">{replyingToAuthor}</span>
                </>
              ) : (
                <>
                  Replying to{" "}
                  <span className="font-black ml-1">{replyingToAuthor}</span>
                </>
              )}
              <button
                onClick={() => setReplyTo(null)}
                className="ml-2 hover:opacity-60"
              >
                ✕
              </button>
            </div>
          )}
          {!canComment ? (
            <div className="w-full border-b border-[#e9eef6] py-1 min-h-[1.5rem] flex items-center justify-center">
              {isPatronGated && !isPatron ? (
                <span className="text-[14px] font-bold text-blue-600 underline underline-offset-4 hover:opacity-80 transition-all text-center">
                  {t.becomePatronToComment}
                </span>
              ) : (
                <SignInButton mode="modal">
                  <button className="text-[14px] font-bold text-blue-600 underline underline-offset-4 hover:opacity-80 transition-all text-center">
                    {t.signInToComment}
                  </button>
                </SignInButton>
              )}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={(e) => {
                setNewComment(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onFocus={() => setIsInputFocused(true)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  if (newComment.trim() && !isPending && !isTooLong) {
                    handleSubmit(e as any);
                  }
                }
              }}
              placeholder={replyTo ? t.addReply : t.addComment}
              className="w-full bg-transparent text-[#0f0f0f] focus:outline-none text-[14px] leading-5 border-b border-[#e9eef6] focus:border-b-2 focus:border-[#3b82f6] transition-all resize-none py-2 min-h-[2.5rem]"
            />
          )}
        </div>

        {(isInputFocused || newComment.trim() || replyTo) && canComment && (
          <div className="flex flex-col gap-3 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-1.5">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => insertEmoji(emoji)}
                    className="hover:bg-neutral-100 p-1 rounded-md transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <div className={cn("text-[10px] font-bold", isTooLong ? "text-red-500" : "text-neutral-400")}>
                {graphemeCount} / 2000
              </div>
            </div>

            <div className="flex justify-start gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setNewComment("");
                  setReplyTo(null);
                  setIsInputFocused(false);
                }}
              >
                {t.cancel}
              </Button>

              <Button
                onClick={handleSubmit}
                disabled={!newComment.trim() || isPending || isTooLong}
              >
                {isPending ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : replyTo ? (
                  t.reply
                ) : (
                  t.comment
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
