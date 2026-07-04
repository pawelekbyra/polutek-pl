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
const EXTENDED_EMOJIS = [
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
];

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
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showEmojiPanel, setShowEmojiPanel] = React.useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = React.useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const graphemeCount = countGraphemes(newComment);
  const isTooLong = graphemeCount > 2000;
  const textareaId = replyTo ? "comment-reply-textarea" : "comment-textarea";
  const limitId = `${textareaId}-limit`;
  const errorId = `${textareaId}-error`;

  const fieldClassName = "relative min-h-[2.75rem] rounded-2xl border border-[#0f0f0f] bg-white shadow-[0_1px_0_rgba(15,15,15,0.10),0_8px_18px_rgba(15,15,15,0.08)] transition-shadow focus-within:shadow-[0_1px_0_rgba(15,15,15,0.14),0_10px_22px_rgba(15,15,15,0.10)]";

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
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return;
    setIsUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/comments/image-upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setUploadedImageUrl(data.url);
      }
    } catch {}
    setIsUploadingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
          className="mt-1 border border-[#0f0f0f]"
        />
      )}
      <div className="flex-1 min-w-0">
        <form className="relative" onSubmit={handleSubmit} noValidate>
          {replyTo && userProfile && (
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#0f0f0f] bg-[#eff6ff] px-3 py-1 rounded-md w-fit mb-2 border border-[#0f0f0f] shadow-[0_1px_0_rgba(15,15,15,0.10),0_6px_14px_rgba(15,15,15,0.06)]">
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
                className="relative flex min-h-[2.75rem] w-full items-center justify-center px-3.5 py-2.5 text-[13px] font-bold text-neutral-500"
                role="status"
                aria-live="polite"
              >
                {language === "pl"
                  ? "Sprawdzamy możliwość komentowania..."
                  : "Checking comment access..."}
              </div>
            </div>
          ) : !canComment ? (
            <div className={fieldClassName}>
              <div className="relative flex min-h-[2.75rem] w-full items-center justify-center px-3.5 py-2.5">
                {isPatronGated && userProfile ? (
                  <a
                    href="#donations"
                    className="text-[14px] font-bold text-blue-600 underline underline-offset-4 hover:opacity-80 transition-all text-center"
                  >
                    {language === "pl"
                      ? "Zostaw napiwek, aby komentować"
                      : "Leave a tip to comment"}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => openAuthModal("sign-in")}
                    className="text-[14px] font-bold text-blue-600 underline underline-offset-4 hover:opacity-80 transition-all text-center"
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
                className="relative w-full bg-transparent text-[#0f0f0f] placeholder:text-neutral-500 focus:outline-none text-[14px] leading-5 transition-all resize-none px-3.5 py-2.5 min-h-[2.75rem]"
              />
            </div>
          )}

          {(isInputFocused || newComment.trim() || replyTo) && canComment && (
            <div className="flex flex-col gap-3 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 relative">
                  {QUICK_EMOJIS.slice(0, 5).map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      disabled={isPending}
                      className="hover:bg-neutral-100 p-1 rounded-md transition-colors text-[16px]"
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowEmojiPanel(prev => !prev)}
                    disabled={isPending}
                    className="hover:bg-neutral-100 px-1.5 py-1 rounded-md transition-colors text-[11px] font-bold text-neutral-500"
                  >
                    {showEmojiPanel ? "✕" : "więcej"}
                  </button>
                  {showEmojiPanel && (
                    <div className="absolute bottom-full left-0 mb-2 z-50 bg-white border border-[#0f0f0f] rounded-xl shadow-[0_1px_0_rgba(15,15,15,0.10),0_8px_18px_rgba(15,15,15,0.08)] p-2 w-[300px] max-h-[200px] overflow-y-auto">
                      <div className="flex flex-wrap gap-0.5">
                        {EXTENDED_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => { insertEmoji(emoji); setShowEmojiPanel(false); }}
                            className="hover:bg-neutral-100 p-1 rounded text-[18px] leading-none transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isPending || isUploadingImage}
                    className="hover:bg-neutral-100 p-1 rounded-md transition-colors text-neutral-500 text-[11px] font-bold"
                    title={language === "pl" ? "Dodaj obrazek" : "Add image"}
                  >
                    {isUploadingImage ? "⏳" : "📷"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
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

              {uploadedImageUrl && (
                <div className="relative inline-block mb-2">
                  <img src={uploadedImageUrl} alt="upload preview" className="max-h-[120px] max-w-[200px] rounded-lg border border-[#0f0f0f] object-contain" />
                  <button
                    type="button"
                    onClick={() => setUploadedImageUrl(null)}
                    className="absolute -top-1 -right-1 bg-white border border-[#0f0f0f] rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold hover:bg-red-50 hover:text-red-500"
                  >✕</button>
                </div>
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
