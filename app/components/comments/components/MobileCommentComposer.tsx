"use client";

import React from "react";
import { createPortal } from "react-dom";
import { ArrowUp, CornerDownRight, Loader2 } from "../../icons";
import { cn } from "@/lib/utils";
import { SafeAvatar } from "../../SafeAvatar";
import { countGraphemes } from "@/lib/utils/graphemes";
import { useOptionalTx } from "@/lib/i18n/language-context";
import { CommentComposer, QUICK_EMOJIS, type CommentComposerProps } from "./CommentComposer";
import { useKeyboardInset } from "../hooks/useKeyboardInset";

export interface MobileComposerHandle {
  /** Opens the bar and puts the cursor in it. Call it straight from a tap handler: iOS only opens the keyboard then. */
  open: () => void;
  close: () => void;
}

type Props = CommentComposerProps & {
  /** First words of the comment being answered, shown in the "Replying to" line. */
  replyingToSnippet?: string | null;
};

const MAX_LENGTH = 2000;
const COUNTER_FROM = 1800;
const MAX_FIELD_HEIGHT = 120;

/**
 * Phone composer: in the list there is one calm line ("Add a comment..."); tapping it (or "Reply" on a comment)
 * raises a bar that sits right above the keyboard, TikTok-style, with the reply target on top, a one-tap emoji
 * strip, a growing field and a round send button. The draft survives closing the bar. Anything that cannot be
 * typed into (signed out, comments off, still loading) is the regular composer's message.
 *
 * The bar is always mounted (invisible when closed) so the field can be focused synchronously inside the tap,
 * which is what makes iOS raise the keyboard. The field is 16 px: smaller text makes iOS zoom the page on focus.
 */
export const MobileCommentComposer = React.forwardRef<MobileComposerHandle, Props>(function MobileCommentComposer(
  props,
  ref,
) {
  const {
    replyingToSnippet,
    userProfile,
    userAvatarUrl,
    replyTo,
    replyingToAuthor,
    newComment,
    setNewComment,
    setReplyTo,
    setIsInputFocused,
    canComment,
    commentsDisabled = false,
    isPending,
    isViewerLoading = false,
    errorMessage,
    handleSubmit,
    t,
    language,
  } = props;
  const tx = useOptionalTx(language);
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const draftRef = React.useRef(newComment);
  draftRef.current = newComment;
  const inset = useKeyboardInset(open);
  const usable = canComment && !commentsDisabled && !isViewerLoading;
  const graphemeCount = countGraphemes(newComment);
  const isTooLong = graphemeCount > MAX_LENGTH;

  React.useEffect(() => setMounted(true), []);

  const openSheet = React.useCallback(() => {
    setOpen(true);
    textareaRef.current?.focus({ preventScroll: true });
  }, []);

  const closeSheet = React.useCallback(() => {
    setOpen(false);
    textareaRef.current?.blur();
    setIsInputFocused(false);
    // An empty draft has no use for a reply target; a typed one keeps it until sent or cancelled.
    if (!draftRef.current.trim()) setReplyTo(null);
  }, [setIsInputFocused, setReplyTo]);

  React.useImperativeHandle(ref, () => ({ open: openSheet, close: closeSheet }), [openSheet, closeSheet]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSheet();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeSheet]);

  // The field grows with the text up to five lines, then scrolls.
  React.useLayoutEffect(() => {
    const field = textareaRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, MAX_FIELD_HEIGHT)}px`;
  }, [newComment, open]);

  const insertEmoji = (emoji: string) => {
    const field = textareaRef.current;
    if (!field) return;
    const start = field.selectionStart ?? newComment.length;
    const end = field.selectionEnd ?? start;
    setNewComment(newComment.slice(0, start) + emoji + newComment.slice(end));
    const caret = start + emoji.length;
    requestAnimationFrame(() => {
      field.focus({ preventScroll: true });
      field.setSelectionRange(caret, caret);
    });
  };

  if (!usable) {
    const { replyingToSnippet: _unused, ...composerProps } = props;
    void _unused;
    return <CommentComposer {...composerProps} />;
  }

  const placeholder = replyTo ? t.addReply : t.addComment;
  const sendLabel = replyTo ? t.reply : t.comment;
  const hasDraft = newComment.trim().length > 0;

  const sheet = (
    <>
      <div
        aria-hidden="true"
        onClick={closeSheet}
        className={cn(
          "fixed inset-0 z-[1100] touch-none bg-black/40 transition-opacity duration-200 motion-reduce:transition-none",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <form
        role="dialog"
        aria-modal={open}
        aria-label={placeholder}
        onSubmit={handleSubmit}
        noValidate
        style={{
          bottom: inset,
          paddingBottom: inset > 0 ? 8 : "max(8px, env(safe-area-inset-bottom))",
        }}
        className={cn(
          "fixed inset-x-0 z-[1101] rounded-t-2xl border-t border-[var(--chan-line)] bg-[var(--chan-card)] shadow-[0_-12px_32px_rgba(15,23,42,0.18)] transition-[opacity,transform] duration-200 motion-reduce:transition-none",
          open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
        )}
      >
        {replyTo ? (
          <div className="flex items-center gap-2 px-4 pt-3 text-[12px] text-[var(--chan-muted)]">
            <CornerDownRight size={12} aria-hidden="true" className="shrink-0 text-[var(--chan-blue)]" />
            <span className="min-w-0 flex-1 truncate">
              {tx("Odpowiadasz", "Replying to")}{" "}
              <span className="font-bold text-[var(--chan-ink)]">{replyingToAuthor}</span>
              {replyingToSnippet ? <span>{` · ${replyingToSnippet}`}</span> : null}
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label={tx("Anuluj odpowiedź", "Cancel reply")}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--chan-muted)] active:bg-[var(--chan-surface)]"
            >
              ✕
            </button>
          </div>
        ) : null}

        <div
          className="flex gap-1 overflow-x-auto px-3 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          // Keeps the field focused (and the keyboard up) when an emoji is tapped.
          onMouseDown={(event) => event.preventDefault()}
        >
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => insertEmoji(emoji)}
              disabled={isPending}
              aria-label={tx("Dodaj emoji {0}", "Add emoji {0}", emoji)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[20px] active:bg-[var(--chan-surface)]"
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2 px-3 pt-1">
          <div className="min-w-0 flex-1 rounded-[22px] bg-[var(--chan-surface)] px-4">
            <label htmlFor="comment-mobile-textarea" className="sr-only">
              {placeholder}
            </label>
            <textarea
              id="comment-mobile-textarea"
              ref={textareaRef}
              value={newComment}
              rows={1}
              onChange={(event) => setNewComment(event.target.value)}
              onFocus={() => setIsInputFocused(true)}
              readOnly={isPending}
              placeholder={placeholder}
              enterKeyHint="enter"
              autoComplete="off"
              aria-invalid={Boolean(errorMessage || isTooLong)}
              className="block max-h-[120px] w-full resize-none bg-transparent py-2.5 text-[16px] leading-6 text-[var(--chan-ink)] placeholder:text-[var(--chan-muted)] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!hasDraft || isPending || isTooLong}
            aria-label={sendLabel}
            className="mb-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--chan-blue)] text-white transition-opacity active:scale-95 disabled:opacity-35"
          >
            {isPending ? (
              <Loader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <ArrowUp size={20} aria-hidden="true" />
            )}
          </button>
        </div>

        {isTooLong || errorMessage || graphemeCount >= COUNTER_FROM ? (
          <div className="flex items-start justify-between gap-3 px-4 pt-1.5 text-[11px] font-bold">
            <p role="alert" className="min-w-0 flex-1 text-red-600">
              {isTooLong
                ? tx("Komentarz jest za długi. Limit to 2000 znaków.", "Comment is too long. The limit is 2000 characters.")
                : (errorMessage ?? "")}
            </p>
            <span className={cn("shrink-0", isTooLong ? "text-red-500" : "text-[var(--chan-muted)]")}>
              {graphemeCount} / {MAX_LENGTH}
            </span>
          </div>
        ) : null}
      </form>
    </>
  );

  return (
    <>
      <div className="flex items-center gap-3">
        <SafeAvatar
          src={userAvatarUrl}
          alt={userProfile?.name || "Avatar"}
          size={40}
          className="border border-[var(--chan-line)]"
        />
        <button
          type="button"
          onClick={openSheet}
          aria-haspopup="dialog"
          className={cn(
            "flex min-h-11 min-w-0 flex-1 items-center rounded-full bg-[var(--chan-surface)] px-4 text-left text-[14px] transition-colors active:bg-[var(--chan-line)]",
            hasDraft ? "text-[var(--chan-ink)]" : "text-[var(--chan-muted)]",
          )}
        >
          <span className="truncate">{hasDraft ? newComment : placeholder}</span>
        </button>
      </div>
      {mounted ? createPortal(sheet, document.body) : null}
    </>
  );
});
