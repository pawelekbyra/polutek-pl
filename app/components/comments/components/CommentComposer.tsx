"use client";

import React from "react";
import { CornerDownRight, Loader2 } from "../../icons";
import { Button } from "@/components/ui/button";
import { useAuthModal } from "@/app/components/auth/AuthModalProvider";
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
  isViewerLoading?: boolean;
  errorMessage?: string | null;
  handleSubmit: (e: React.FormEvent) => void;
  t: any;
  language: string;
}

const QUICK_EMOJIS = ["😀", "😂", "🔥", "👏", "❤️", "🙏", "💯", "😮"];
const EXTENDED_EMOJIS = Array.from(new Set([
  "😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊","😋","😎","😍","😘","🥰","😗","😙","😚","🙂","🤗",
  "🤩","🤔","🤨","😐","😑","😶","🙄","😏","😣","😥","😮","🤐","😯","😪","😫","🥱","😴","😌","😛","😜",
  "😝","🤤","😒","😓","😔","😕","🙃","🤑","😲","☹️","🙁","😖","😞","😟","😤","😢","😭","😦","😧","😨",
  "😩","🤯","😬","😰","😱","🥵","🥶","😳","🤪","😵","🥴","😠","😡","🤬","😷","🤒","🤕","🤢","🤮","🤧",
  "🥳","🥸","😇","🤠","🥺","🫠","🫣","🫡","🫢","🫤","🤭","🫨","😶‍🌫️","😮‍💨","😤",
  "👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉",
  "👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💪",
  "🦾","🦿","🦵","🦶","👂","🦻","👃","🫀","🫁","🧠","🦷","🦴","👀","👁️","👅","👄","🫦",
  "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️",
  "🔥","💯","✨","⭐","🌟","💫","⚡","🌈","🎉","🎊","🎈","🎁","🏆","🥇","🎯","💥","❄️","🌊","🍀","🌸",
]));

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
  isViewerLoading = false,
  errorMessage,
  handleSubmit,
  t,
  language,
}: CommentComposerProps) {
  const { open: openAuthModal } = useAuthModal();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const emojiPanelRef = React.useRef<HTMLDivElement>(null);
  const emojiTriggerRef = React.useRef<HTMLButtonElement>(null);
  const [showEmojiPanel, setShowEmojiPanel] = React.useState(false);
  const graphemeCount = countGraphemes(newComment);
  const isTooLong = graphemeCount > 2000;
  const textareaId = replyTo ? "comment-reply-textarea" : "comment-textarea";
  const emojiPanelId = `${textareaId}-emoji-panel`;
  const limitId = `${textareaId}-limit`;
  const errorId = `${textareaId}-error`;

  const fieldClassName = "relative min-h-[2.75rem] rounded-2xl bg-[var(--chan-surface)] px-4 transition-colors focus-within:bg-[var(--chan-line)]";

  React.useEffect(() => {
    if (!showEmojiPanel) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        !emojiPanelRef.current?.contains(event.target as Node) &&
        !emojiTriggerRef.current?.contains(event.target as Node)
      ) {
        setShowEmojiPanel(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowEmojiPanel(false);
      emojiTriggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showEmojiPanel]);

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
      className={cn("flex items-start mb-10", userProfile ? "gap-5" : "gap-0")}
    >
      {userProfile && (
        <SafeAvatar
          src={userAvatarUrl}
          alt={userProfile.name || "Avatar"}
          size={40}
          fallbackSeed={userProfile.id}
          className={cn(
            "mt-1 border border-[var(--chan-line)]",
            isPatronDecorative && "chan-patron-ring",
          )}
        />
      )}
      <div className="flex-1 min-w-0">
        <form className="relative" onSubmit={handleSubmit} noValidate>
          {replyTo && userProfile && (
            <div className="mb-2 flex w-fit items-center gap-2 text-[11px] font-bold text-[var(--chan-blue)]">
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
                aria-label={
                  language === "pl" ? "Anuluj odpowiedź" : "Cancel reply"
                }
              >
                ✕
              </button>
            </div>
          )}
          {isViewerLoading ? (
            <div className={fieldClassName}>
              <div
                className="relative flex min-h-[2.75rem] w-full items-center justify-center py-2.5 text-[13px] font-bold text-[var(--chan-muted)]"
                role="status"
                aria-live="polite"
              >
                {language === "pl"
                  ? "Sprawdzamy możliwość komentowania..."
                  : "Checking comment access..."}
              </div>
            </div>
          ) : !canComment ? (
            <div
              className={cn(
                fieldClassName,
                isPatronGated
                  ? "bg-[var(--chan-amber-soft)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--chan-amber)_28%,transparent)]"
                  : "bg-[var(--chan-blue-soft)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--chan-blue)_20%,transparent)]",
              )}
            >
              <div className="relative flex min-h-[2.75rem] w-full items-center justify-center py-2.5">
                {isPatronGated && userProfile ? (
                  <a
                    href="#donations"
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--chan-amber)_38%,transparent)] bg-white/75 px-4 text-center text-[13px] font-bold text-[var(--chan-amber-ink)] shadow-[0_8px_20px_-14px_color-mix(in_srgb,var(--chan-amber)_65%,transparent)] transition-[transform,background-color,box-shadow] hover:-translate-y-px hover:bg-white active:translate-y-0 active:scale-[0.98]"
                  >
                    {language === "pl"
                      ? "Zostaw napiwek, aby komentować"
                      : "Leave a tip to comment"}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => openAuthModal("sign-in")}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--chan-blue)_28%,transparent)] bg-white/75 px-4 text-center text-[13px] font-bold text-[var(--chan-blue)] shadow-[0_8px_20px_-14px_color-mix(in_srgb,var(--chan-blue)_58%,transparent)] transition-[transform,background-color,box-shadow] hover:-translate-y-px hover:bg-white active:translate-y-0 active:scale-[0.98]"
                  >
                    {t.signInToComment}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className={fieldClassName}>
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
                className="relative w-full bg-transparent text-[var(--chan-ink)] placeholder:text-[var(--chan-muted)] focus:outline-none text-[14px] leading-5 transition-all resize-none py-2.5 min-h-[2.75rem]"
              />
            </div>
          )}

          {(isInputFocused || newComment.trim() || replyTo) && canComment && (
            <div className="mt-2 flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 relative">
                  {QUICK_EMOJIS.slice(0, 5).map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      disabled={isPending}
                      className="grid h-9 w-9 place-items-center rounded-md text-[16px] transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
                      aria-label={
                        language === "pl"
                          ? `Dodaj emoji ${emoji}`
                          : `Add emoji ${emoji}`
                      }
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    ref={emojiTriggerRef}
                    type="button"
                    onClick={() => setShowEmojiPanel(prev => !prev)}
                    disabled={isPending}
                    className="min-h-9 rounded-md px-2 text-[11px] font-bold text-neutral-500 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
                    aria-expanded={showEmojiPanel}
                    aria-controls={emojiPanelId}
                    aria-haspopup="dialog"
                    aria-label={
                      language === "pl" ? "Więcej emoji" : "More emoji"
                    }
                  >
                    {showEmojiPanel
                      ? "✕"
                      : language === "pl"
                        ? "więcej"
                        : "more"}
                  </button>
                  {showEmojiPanel && (
                    <div
                      ref={emojiPanelRef}
                      id={emojiPanelId}
                      role="dialog"
                      aria-label={
                        language === "pl" ? "Wybierz emoji" : "Choose an emoji"
                      }
                      className="absolute bottom-full left-0 z-50 mb-2 max-h-[200px] w-[300px] overflow-y-auto rounded-xl border border-[var(--chan-line)] bg-white p-2 shadow-[0_8px_26px_rgba(23,23,23,0.12)]"
                    >
                      <div className="flex flex-wrap gap-0.5">
                        {EXTENDED_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => { insertEmoji(emoji); setShowEmojiPanel(false); }}
                            className="grid h-9 w-9 place-items-center rounded text-[18px] leading-none transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]"
                            aria-label={
                              language === "pl"
                                ? `Dodaj emoji ${emoji}`
                                : `Add emoji ${emoji}`
                            }
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div
                  id={limitId}
                  className={cn(
                    "text-[10px] font-bold",
                    isTooLong ? "text-red-500" : "text-neutral-400",
                  )}
                >
                  {graphemeCount} / 2000
                </div>
              </div>

              {(errorMessage || isTooLong) && (
                <p
                  id={errorId}
                  role="alert"
                  className="text-xs font-bold text-red-600"
                >
                  {isTooLong
                    ? language === "pl"
                      ? "Komentarz jest za długi. Limit to 2000 znaków."
                      : "Comment is too long. The limit is 2000 characters."
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
                    <span
                      className="inline-flex items-center"
                      role="status"
                      aria-live="polite"
                    >
                      <Loader2
                        className="mr-2 animate-spin motion-reduce:animate-none"
                        size={14}
                        aria-hidden="true"
                      />
                      {language === "pl" ? "Wysyłanie..." : "Sending..."}
                    </span>
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
