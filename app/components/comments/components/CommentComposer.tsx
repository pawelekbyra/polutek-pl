"use client";

import React from "react";
import { CornerDownRight, Loader2 } from "../../icons";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { SafeAvatar } from "../../SafeAvatar";
import { countGraphemes } from "@/lib/utils/graphemes";

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
  isPatronDecorative: boolean;
  isPending: boolean;
  errorMessage?: string | null;
  handleSubmit: (e: React.FormEvent) => void;
  t: any;
  language: string;
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
  isPatronDecorative,
  isPending,
  errorMessage,
  handleSubmit,
  t,
  language
}: CommentComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const graphemeCount = countGraphemes(newComment);
  const isTooLong = graphemeCount > 2000;
  const textareaId = replyTo ? "comment-reply-textarea" : "comment-textarea";
  const limitId = `${textareaId}-limit`;
  const errorId = `${textareaId}-error`;

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
            isPatronDecorative
              ? "border-2 border-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]"
              : "border border-[#e9eef6]",
          )}
        />
      )}
      <div className="flex-1 min-w-0">
        <form className="relative" onSubmit={handleSubmit} noValidate>
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
                type="button"
                onClick={() => setReplyTo(null)}
                className="ml-2 hover:opacity-60"
                aria-label={language === "pl" ? "Anuluj odpowiedź" : "Cancel reply"}
              >
                ✕
              </button>
            </div>
          )}
          {!canComment ? (
            <div className="w-full border-b border-[#e9eef6] py-1 min-h-[1.5rem] flex items-center justify-center">
              {isPatronGated && userProfile ? (
                <a
                  href="#donations"
                  className="text-[14px] font-bold text-blue-600 underline underline-offset-4 hover:opacity-80 transition-all text-center"
                >
                  {language === "pl" ? "Zostań Patronem, żeby komentować" : "Become a Patron to comment"}
                </a>
              ) : (
                <SignInButton mode="modal">
                  <button type="button" className="text-[14px] font-bold text-blue-600 underline underline-offset-4 hover:opacity-80 transition-all text-center">
                    {t.signInToComment}
                  </button>
                </SignInButton>
              )}
            </div>
          ) : (
            <>
              <label htmlFor={textareaId} className="sr-only">
                {replyTo ? t.addReply : t.addComment}
              </label>
              <textarea
                id={textareaId}
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
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }
              }}
              placeholder={replyTo ? t.addReply : t.addComment}
              aria-invalid={Boolean(errorMessage || isTooLong)}
              aria-describedby={`${limitId}${errorMessage || isTooLong ? ` ${errorId}` : ""}`}
              disabled={isPending}
                className="w-full bg-transparent text-[#0f0f0f] focus:outline-none text-[14px] leading-5 border-b border-[#e9eef6] focus:border-b-2 focus:border-[#3b82f6] transition-all resize-none py-2 min-h-[2.5rem]"
              />
            </>
          )}

        {(isInputFocused || newComment.trim() || replyTo) && canComment && (
          <div className="flex flex-col gap-3 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-1.5">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    disabled={isPending}
                    className="hover:bg-neutral-100 p-1 rounded-md transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <div id={limitId} className={cn("text-[10px] font-bold", isTooLong ? "text-red-500" : "text-neutral-400")}>
                {graphemeCount} / 2000
              </div>
            </div>

            {(errorMessage || isTooLong) && (
              <p id={errorId} role="alert" className="text-xs font-bold text-red-600">
                {isTooLong
                  ? (language === "pl" ? "Komentarz jest za długi. Limit to 2000 znaków." : "Comment is too long. The limit is 2000 characters.")
                  : errorMessage}
              </p>
            )}

            <div className="flex justify-start gap-2">
              <Button
                type="button"
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
                type="submit"
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
        </form>
      </div>
    </div>
  );
}
