"use client";

import { scrollToWatchTabsWhenSettled } from "./scroll-to-watch-tabs";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  MessageSquare,
  Loader2,
  AlertCircle,
  RefreshCcw,
} from "../icons";
import { useAuth, useUser } from "@/lib/auth/react";
import { cn } from "@/lib/utils";
import { useLanguage } from "../LanguageContext";
import { useOptionalTx } from "@/lib/i18n/language-context";
import { countedNoun } from "@/lib/i18n/plurals";
import type { Locale } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CommentReportReasonDto } from "@/lib/modules/comments/domain/comment-frontend.dto";
import { CommentComposer } from "./components/CommentComposer";
import { MobileCommentComposer, type MobileComposerHandle } from "./components/MobileCommentComposer";
import { useIsPhone } from "./hooks/useIsPhone";
import { useCommentDeepLinkContext, uniqueComments } from "./hooks/useCommentDeepLinkContext";
import { CommentItem } from "./components/CommentItem";
import { AnimatePresence } from "framer-motion";
import { CommentMotionItem, AnimatedCount } from "./components/comment-motion";
import { useComments } from "./hooks/useComments";
import { CommentThread } from "./components/CommentThread";
import { CommentLoadingSkeleton } from "@/components/skeletons";
import { usePageRevealReady } from "../preload/PageRevealGate";
import type { InitialCommentsPage } from "./initial-comments";
import { commentErrorText } from "./comment-errors";

interface EmbeddedCommentsProps {
  userProfile?: {
    id: string;
    imageUrl?: string | null;
    name?: string | null;
    username?: string | null;
    role?: string;
  } | null;
  videoId: string;
  /** Server-rendered first page (newest) of this video's comments, when the page has it. */
  initialComments?: InitialCommentsPage | null;
}

/**
 * The shared CommentLoadingSkeleton is purely decorative (aria-hidden), so on its
 * own it never tells assistive tech that comments are loading. Wrap it with a
 * visible, readable pending label announced via role="status"/aria-live so screen
 * reader users (and anyone glancing at the panel) get the same "comments are
 * loading" signal the skeleton bars only convey visually.
 */
const CommentsLoadingState = ({ language }: { language: Locale }) => {
  const tx = useOptionalTx(language);
  return (
  <div className="space-y-4">
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 text-[13px] font-bold text-[var(--chan-muted)]"
    >
      <Loader2
        size={16}
        className="animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      {tx("Rozgrzewamy dyskusję…", "Warming up the discussion…")}
    </div>
    <CommentLoadingSkeleton />
  </div>
  );
};

const EmbeddedComments: React.FC<EmbeddedCommentsProps> = ({
  userProfile: propUserProfile,
  videoId,
  initialComments,
}) => {
  const { t, language, tx } = useLanguage();
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();

  const userProfile = React.useMemo(() => {
    const sessionUserProfile = isSignedIn
      ? {
          id: userId!,
          imageUrl: user?.imageUrl || null,
          name:
            user?.fullName ||
            null,
          username: user?.username || null,
          role: "USER",
        }
      : null;

    return propUserProfile || sessionUserProfile
      ? {
          ...(sessionUserProfile || {}),
          ...(propUserProfile || {}),
          imageUrl:
            sessionUserProfile?.imageUrl || propUserProfile?.imageUrl || null,
          name: sessionUserProfile?.name || propUserProfile?.name || null,
          username:
            sessionUserProfile?.username || propUserProfile?.username || null,
        }
      : null;
  }, [
    propUserProfile,
    isSignedIn,
    userId,
    user,
  ]);

  // SafeAvatar falls back to our own local default avatar.
  const userAvatarUrl = userProfile?.imageUrl || null;

  const [sortBy, setSortBy] = useState<"newest" | "top">("newest");
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  // A reply target, draft or error belongs to one video: drop them when the video changes
  // (adjusting state during render, so the old reply target is never sent to the new video).
  const [stateVideoId, setStateVideoId] = useState(videoId);
  if (stateVideoId !== videoId) {
    setStateVideoId(videoId);
    setReplyTo(null);
    setNewComment("");
    setComposerError(null);
    setIsInputFocused(false);
  }

  const commentsTopRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
    postMutation,
    likeMutation,
    dislikeMutation,
    pinMutation,
    deleteMutation,
    editMutation,
    reportMutation,
    isPlaceholderData,
  } = useComments(videoId, sortBy, language, userProfile, initialComments);
  usePageRevealReady("comments", !isLoading);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const handleScroll = () => {
      if (commentsTopRef.current) {
        const top = commentsTopRef.current.getBoundingClientRect().top;
        setShowStickyHeader(top < -200);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollBehavior = (): ScrollBehavior =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

  const scrollToCommentsTop = useCallback(() => {
    commentsTopRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  }, []);

  // The round "back up" button: on a phone it goes where a new comment goes (the KOMENTARZE/FILMY tab row on top).
  const handleBackToTop = useCallback(() => {
    if (!scrollToWatchTabsWhenSettled(scrollBehavior())) scrollToCommentsTop();
  }, [scrollToCommentsTop]);

  const { mutate: postComment } = postMutation;

  const { error: deepLinkError, retry: retryDeepLink } = useCommentDeepLinkContext(videoId, sortBy, Boolean(data) && !isLoading && !isPlaceholderData && !isError);
  const comments = uniqueComments(data?.pages?.flatMap((page) => page.comments || []) ?? []);
  const totalCount = data?.pages?.[0]?.totalCount ?? 0;
  const viewer = data?.pages?.[0]?.viewer;

  const replyingToAuthor = replyTo
    ? comments.find((c) => c.id === replyTo)?.author?.displayName
    : null;
  const replyingToSnippet = replyTo
    ? (comments.find((c) => c.id === replyTo)?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || null
    : null;

  const { mutateAsync: likeMutateAsync } = likeMutation;
  const { mutateAsync: dislikeMutateAsync } = dislikeMutation;
  const { mutate: deleteMutate } = deleteMutation;
  const { mutate: pinMutate } = pinMutation;
  const { mutateAsync: editMutateAsync } = editMutation;
  const { mutateAsync: reportMutateAsync } = reportMutation;

  // likeMutation and dislikeMutation share the same underlying react-query
  // mutation (see useComments.ts), so its own isPending/variables only ever
  // reflect the single most recent call — reacting to comment B while
  // comment A's request is still in flight would otherwise re-enable A's
  // buttons before A's request has settled. Track per-comment pending state
  // locally instead, keyed off each call's own settlement.
  const [pendingReactionIds, setPendingReactionIds] = useState<Set<string>>(new Set());

  const markReactionSettled = useCallback((id: string) => {
    setPendingReactionIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleLike = useCallback(
    (id: string) => {
      setPendingReactionIds((prev) => new Set(prev).add(id));
      void likeMutateAsync(id).finally(() => markReactionSettled(id));
    },
    [likeMutateAsync, markReactionSettled],
  );
  const handleDislike = useCallback(
    (id: string) => {
      setPendingReactionIds((prev) => new Set(prev).add(id));
      void dislikeMutateAsync(id).finally(() => markReactionSettled(id));
    },
    [dislikeMutateAsync, markReactionSettled],
  );
  const composerRef = useRef<HTMLDivElement>(null);
  const mobileComposerRef = useRef<MobileComposerHandle>(null);
  const isPhone = useIsPhone();
  const handleReply = useCallback((id: string) => {
    setReplyTo(id);
    if (isPhone) {
      // Phone: the bar above the keyboard, opened right inside the tap (iOS raises the keyboard only then).
      mobileComposerRef.current?.open();
      return;
    }
    // Bring the reply field into view and put the cursor in it (not the top of the page).
    requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
      composerRef.current?.querySelector("textarea")?.focus({ preventScroll: true });
    });
  }, [isPhone]);
  const handleDelete = useCallback((id: string) => deleteMutate(id), [deleteMutate]);
  const handlePin = useCallback(
    (id: string, pinned: boolean) => pinMutate({ commentId: id, pinned }),
    [pinMutate],
  );
  const handleEdit = useCallback(
    (id: string, text: string) => editMutateAsync({ commentId: id, text }).then(() => undefined),
    [editMutateAsync],
  );
  const handleReport = useCallback(
    (id: string, reason: CommentReportReasonDto, note?: string) =>
      reportMutateAsync({ commentId: id, reason, note }).then(() => undefined),
    [reportMutateAsync],
  );
  const isReactionPending = useCallback((id: string) => pendingReactionIds.has(id), [pendingReactionIds]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newComment.trim() || !userProfile || postMutation.isPending) return;
      setComposerError(null);
      postComment(
        { text: newComment, parentId: replyTo || undefined },
        {
          onSuccess: () => {
            setNewComment("");
            setReplyTo(null);
            setIsInputFocused(false);
            if (isPhone) {
              mobileComposerRef.current?.close();
              // Show where the comment landed: the thread that was answered, or the top of the list.
              const answered = replyTo ? document.getElementById(`comment-${replyTo}`) : null;
              requestAnimationFrame(() => {
                if (answered) {
                  answered.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
                } else if (!scrollToWatchTabsWhenSettled(scrollBehavior())) {
                  composerRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
                }
              });
            }
          },
          onError: (error) => {
            // Never the server's raw text (Polish, or a bare "Request failed"): a translated text by code.
            setComposerError(
              commentErrorText(error, tx, tx("Nie udało się dodać komentarza. Spróbuj ponownie.", "Could not add your comment. Try again.")),
            );
          },
        },
      );
    },
    [
      newComment,
      userProfile,
      replyTo,
      isPhone,
      postComment,
      postMutation.isPending,
      language,
      tx,
    ],
  );

  const getCommentsLabel = (count: number) => countedNoun(language, "comments", count);

  const handleSortChange = (nextSort: "newest" | "top") => {
    setSortBy(nextSort);
  };

  // Spacing has one owner: the `gap` of each column below (no margins on the children, no
  // overrides in CSS modules). Header and composer 16 px apart, composer and the first comment
  // 24 px (the list's own `pt-2` on top of the gap: a new section needs more air than a row in
  // it); threads 16 px apart.
  return (
    <div
      ref={commentsTopRef}
      className="relative flex max-w-full flex-col gap-4 pb-4"
    >
      {deepLinkError && <p role="status" className="rounded-xl bg-[var(--chan-surface)] px-4 py-3 text-[13px] text-[var(--chan-muted)]">
        {deepLinkError.kind === "missing" ? tx("Ten komentarz nie jest już dostępny.", "This comment is no longer available.") : tx("Nie udało się wczytać komentarza.", "Could not load the comment.")}
        {deepLinkError.kind === "network" && <button type="button" onClick={retryDeepLink} className="ml-2 underline">{tx("Spróbuj ponownie", "Try again")}</button>}
      </p>}
      {/* Back to comments top */}
      {showStickyHeader &&
        createPortal(
        // In the body, so "fixed" is the screen corner whatever transforms the comments column has.
        <div className="fixed bottom-[max(12px,env(safe-area-inset-bottom))] right-3 z-50 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-200 sm:bottom-6 sm:right-6">
          <button
            type="button"
            onClick={handleBackToTop}
            aria-label={tx("Wróć do początku komentarzy", "Back to the top of comments")}
            className="group flex h-12 w-12 items-center justify-center rounded-full bg-[var(--chan-blue)] text-white shadow-[0_10px_30px_var(--cm-blue-35)] ring-1 ring-white/20 transition hover:-translate-y-0.5 hover:bg-[var(--cm-blue-86-black)] hover:shadow-[0_14px_36px_var(--cm-blue-42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] focus-visible:ring-offset-2 active:translate-y-0 active:scale-95 motion-reduce:transition-none"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="-translate-y-px transition-transform group-hover:-translate-y-1"
            >
              <path d="M6 14l6-6 6 6" />
            </svg>
          </button>
        </div>,
        document.body,
        )}

      <div className="flex flex-row items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="font-brand text-[15px] font-bold text-[var(--chan-ink)] truncate">
            <AnimatedCount value={totalCount} /> {getCommentsLabel(totalCount)}
          </h3>
        </div>

        <div className="flex gap-[16px] shrink-0 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-[var(--chan-muted)] transition-colors hover:bg-[var(--chan-surface)] hover:text-[var(--chan-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] motion-reduce:transition-none"
              aria-label={
                tx("Sortuj komentarze", "Sort comments")
              }
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="4" y1="21" x2="4" y2="14"></line>
                <line x1="4" y1="10" x2="4" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12" y2="3"></line>
                <line x1="20" y1="21" x2="20" y2="16"></line>
                <line x1="20" y1="12" x2="20" y2="3"></line>
                <line x1="2" y1="14" x2="6" y2="14"></line>
                <line x1="10" y1="8" x2="14" y2="8"></line>
                <line x1="18" y1="16" x2="22" y2="16"></line>
              </svg>
              <span className="text-[13px] font-semibold">
                {tx("Sortuj według", "Sort by")}
              </span>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="z-[1100] w-[168px] rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-1.5 text-[var(--chan-ink)] shadow-[0_14px_34px_-16px_rgba(15,23,42,0.3)] ring-0"
            >
              <DropdownMenuRadioGroup
                value={sortBy}
                onValueChange={(value) =>
                  handleSortChange(value as "newest" | "top")
                }
              >
                <DropdownMenuRadioItem
                  value="newest"
                  className="min-h-10 rounded-xl px-3 py-2 text-[12px] font-bold text-[var(--chan-muted)] focus:bg-[var(--chan-surface)] focus:text-[var(--chan-ink)]"
                >
                  {tx("Najnowsze", "Newest")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="top"
                  className="min-h-10 rounded-xl px-3 py-2 text-[12px] font-bold text-[var(--chan-muted)] focus:bg-[var(--chan-surface)] focus:text-[var(--chan-ink)]"
                >
                  {tx("Najlepsze", "Top")}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div ref={composerRef}>
        {isPhone ? (
        <MobileCommentComposer
          ref={mobileComposerRef}
          replyingToSnippet={replyingToSnippet}
          userProfile={userProfile}
          userAvatarUrl={userAvatarUrl}
          replyTo={replyTo}
          replyingToAuthor={replyingToAuthor}
          newComment={newComment}
          setNewComment={(value) => {
            setNewComment(value);
            if (composerError) setComposerError(null);
          }}
          setReplyTo={setReplyTo}
          isInputFocused={isInputFocused}
          setIsInputFocused={setIsInputFocused}
          /** ground truth for the UI permission: */
          canComment={viewer?.canComment ?? false}
          commentsDisabled={viewer?.commentsDisabled === true}
          isPending={postMutation.isPending}
          isViewerLoading={isLoading}
          errorMessage={composerError}
          handleSubmit={handleSubmit}
          t={t}
          language={language}
        />
        ) : (
        <CommentComposer
          userProfile={userProfile}
          userAvatarUrl={userAvatarUrl}
          replyTo={replyTo}
          replyingToAuthor={replyingToAuthor}
          newComment={newComment}
          setNewComment={(value) => {
            setNewComment(value);
            if (composerError) setComposerError(null);
          }}
          setReplyTo={setReplyTo}
          isInputFocused={isInputFocused}
          setIsInputFocused={setIsInputFocused}
          /** ground truth for the UI permission: */
          canComment={viewer?.canComment ?? false}
          commentsDisabled={viewer?.commentsDisabled === true}
          isPending={postMutation.isPending}
          isViewerLoading={isLoading}
          errorMessage={composerError}
          handleSubmit={handleSubmit}
          t={t}
          language={language}
        />
        )}
      </div>

      <div
        className={cn(
          "flex flex-col gap-4 pt-2 transition-opacity duration-200 motion-reduce:transition-none",
          // The previous video's (or sort order's) list, kept while the new one loads: dimmed
          // and inert, never a skeleton.
          isPlaceholderData && "pointer-events-none opacity-50",
        )}
        aria-busy={isPlaceholderData || undefined}
        inert={isPlaceholderData || undefined}
      >
        {isLoading ? (
          <CommentsLoadingState language={language} />
        ) : isError ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 bg-red-50/50 rounded-2xl border border-red-100">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-red-900">
                {tx("Nie udało się załadować komentarzy.", "Could not load comments.")}
              </p>
              <p className="text-xs text-red-700/70">
                {tx("Spróbuj odświeżyć stronę lub wróć później.", "Try refreshing the page or come back later.")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => refetch()}
            >
              <RefreshCcw size={14} className="mr-2" />
              {tx("Spróbuj ponownie", "Try again")}
            </Button>
          </div>
        ) : comments.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-3 opacity-60">
            <MessageSquare size={48} className="text-[var(--chan-line-soft)]" />
            <div className="space-y-1">
              <p className="font-black uppercase tracking-widest text-[11px]">
                {tx("Brak komentarzy", "No comments yet")}
              </p>
              <p className="text-xs">
                {viewer?.canComment
                  ? tx("Bądź pierwszy i napisz coś sensownego.", "Be the first to say something meaningful.")
                  : tx("Ten film nie ma jeszcze komentarzy.", "This video has no comments yet.")}
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
          {comments.map((comment) => (
            <CommentMotionItem key={comment.id}>
              <CommentThread
                videoId={videoId}
                comment={comment}
                userProfile={userProfile}
                language={language}
                t={t}
                canComment={viewer?.canComment ?? false}
                onLike={handleLike}
                onDislike={handleDislike}
                onReply={handleReply}
                onDelete={handleDelete}
                onPin={handlePin}
                onEdit={handleEdit}
                onReport={handleReport}
                isReactionPending={isReactionPending}
              />
            </CommentMotionItem>
          ))}
          </AnimatePresence>
        )}

        {hasNextPage && (
          // Also the infinite-scroll sentinel: reaching it loads the next page.
          <div ref={loadMoreRef} className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="min-w-[140px] rounded-full"
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  {tx("Ładowanie...", "Loading...")}
                </>
              ) : tx("Pokaż więcej", "Show more")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmbeddedComments;
