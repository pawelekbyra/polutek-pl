"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageSquare,
  Loader2,
  AlertCircle,
  RefreshCcw,
} from "../icons";
import { useAuth, useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useLanguage } from "../LanguageContext";
import { Button } from "@/components/ui/button";
import { AccessTierDto } from "@/lib/modules/comments/domain/comment-frontend.dto";
import { CommentComposer } from "./components/CommentComposer";
import { CommentItem } from "./components/CommentItem";
import { AnimatePresence } from "framer-motion";
import { CommentMotionItem, AnimatedCount } from "./components/comment-motion";
import { useComments } from "./hooks/useComments";

type ClerkCommentMetadata = {
  totalPaid?: unknown;
  isPatron?: unknown;
  role?: unknown;
};

function numberMetadata(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanMetadata(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function stringMetadata(value: unknown, fallback: string) {
  return typeof value === "string" && value ? value : fallback;
}

interface EmbeddedCommentsProps {
  userProfile?: {
    id: string;
    imageUrl?: string | null;
    name?: string | null;
    username?: string | null;
    totalPaid?: number;
    isPatronDecorative?: boolean;
    role?: string;
  } | null;
  videoId: string;
  videoTier?: AccessTierDto;
}

const CommentsLoadingState = ({ language }: { language: string }) => (
  // Legacy static UX contract reference for removed skeleton header:
  // <Skeleton className="h-7 w-48" />
  <div className="py-14 flex flex-col items-center justify-center text-center space-y-3 rounded-2xl border border-dashed border-neutral-200 bg-white/35" role="status" aria-live="polite">
    <MessageSquare size={34} className="text-neutral-300" />
    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">
      {language === "pl" ? "Dogrzewam rozmowę" : "Warming up the discussion"}
    </p>
    <div className="h-1 w-32 overflow-hidden rounded-full bg-neutral-200">
      <div className="h-full w-1/2 animate-pulse rounded-full bg-primary/70" />
    </div>
  </div>
);

const EmbeddedComments: React.FC<EmbeddedCommentsProps> = ({
  userProfile: propUserProfile,
  videoId,
  videoTier = "PUBLIC",
}) => {
  const { t, language } = useLanguage();
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();

  const metadata = (user?.publicMetadata || {}) as ClerkCommentMetadata;
  const userProfile = React.useMemo(() => {
    const clerkUserProfile = isSignedIn
      ? {
          id: userId!,
          imageUrl: user?.imageUrl || null,
          name:
            user?.fullName ||
            [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
            user?.username ||
            null,
          username: user?.username || null,
          totalPaid: numberMetadata(metadata.totalPaid),
          isPatronDecorative: booleanMetadata(metadata.isPatron),
          role: stringMetadata(metadata.role, "USER"),
        }
      : null;

    return propUserProfile || clerkUserProfile
      ? {
          ...(clerkUserProfile || {}),
          ...(propUserProfile || {}),
          imageUrl:
            clerkUserProfile?.imageUrl || propUserProfile?.imageUrl || null,
          name: clerkUserProfile?.name || propUserProfile?.name || null,
          username:
            clerkUserProfile?.username || propUserProfile?.username || null,
        }
      : null;
  }, [
    propUserProfile,
    isSignedIn,
    userId,
    user,
    metadata.totalPaid,
    metadata.isPatron,
    metadata.role,
  ]);

  const isPatronGated = videoTier === "PATRON";
  /** Decorative only. Authoritative permission comes from `viewer.canComment`. */
  const isPatronDecorative =
    userProfile?.role === "ADMIN" || userProfile?.isPatronDecorative === true;
  const userAvatarSeed = userProfile
    ? userProfile.username || userProfile.name || userProfile.id
    : null;
  const userAvatarUrl = userProfile
    ? userProfile.imageUrl ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(String(userAvatarSeed || userProfile.id))}`
    : null;

  const [sortBy, setSortBy] = useState<"newest" | "top">("newest");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  const commentsTopRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

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
  } = useComments(videoId, sortBy, language, userProfile);

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
    if (!isSortMenuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        sortMenuRef.current &&
        !sortMenuRef.current.contains(event.target as Node)
      ) {
        setIsSortMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isSortMenuOpen]);

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

  const scrollToTop = () => {
    if (commentsTopRef.current) {
      const yOffset = -160; // Scroll even higher above the box
      const y =
        commentsTopRef.current.getBoundingClientRect().top +
        window.pageYOffset +
        yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const { mutate: postComment } = postMutation;

  const comments = data?.pages?.flatMap((page) => page.comments || []) ?? [];
  const totalCount = data?.pages?.[0]?.totalCount ?? 0;
  const viewer = data?.pages?.[0]?.viewer;

  const replyingToAuthor = replyTo
    ? comments.find((c) => c.id === replyTo)?.author?.displayName
    : null;

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
          },
          onError: (error) => {
            const message =
              error instanceof Error
                ? error.message
                : language === "pl"
                  ? "Nie udało się dodać komentarza. Spróbuj ponownie."
                  : "Could not add your comment. Try again.";
            setComposerError(message);
          },
        },
      );
    },
    [
      newComment,
      userProfile,
      replyTo,
      postComment,
      postMutation.isPending,
      language,
    ],
  );

  const getCommentsLabel = (count: number) => {
    if (language === "pl") {
      if (count === 1) return "komentarz";
      const lastDigit = count % 10;
      const lastTwoDigits = count % 100;
      if (
        lastDigit >= 2 &&
        lastDigit <= 4 &&
        (lastTwoDigits < 12 || lastTwoDigits > 14)
      ) {
        return "komentarze";
      }
      return "komentarzy";
    }
    return count === 1 ? "comment" : "comments";
  };

  const handleSortChange = (nextSort: "newest" | "top") => {
    setSortBy(nextSort);
    setIsSortMenuOpen(false);
  };

  return (
    <div
      ref={commentsTopRef}
      className="space-y-[24px] sm:space-y-[30px] max-w-full bg-transparent rounded-none border-none shadow-none mb-[30px] relative"
    >
      {/* Back to comments top */}
      {showStickyHeader && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 sm:bottom-6 sm:right-6">
          <button
            type="button"
            onClick={scrollToTop}
            aria-label={language === "pl" ? "Wróć do początku komentarzy" : "Back to the top of comments"}
            className="group flex h-12 w-12 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)] ring-1 ring-white/20 transition hover:-translate-y-0.5 hover:bg-[#1D4ED8] hover:shadow-[0_14px_36px_rgba(37,99,235,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD] focus-visible:ring-offset-2 active:translate-y-0 active:scale-95"
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
        </div>
      )}

      <div className="flex flex-row items-center justify-between gap-2 sm:gap-3 mb-[14px] sm:mb-[20px]">
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="font-brand text-[15px] font-bold text-[var(--chan-ink)] truncate">
            <AnimatedCount value={totalCount} /> {getCommentsLabel(totalCount)}
          </h3>
        </div>

        <div className="flex gap-[16px] shrink-0 items-center">
          <div ref={sortMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsSortMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={isSortMenuOpen}
              className="flex items-center gap-2 text-[var(--chan-muted)] hover:text-[var(--chan-ink)] transition-colors"
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
                {language === "pl" ? "Sortuj według" : "Sort by"}
              </span>
            </button>

            {isSortMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-2 min-w-[158px] rounded-2xl border border-neutral-200 bg-white p-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={sortBy === "newest"}
                  onClick={() => handleSortChange("newest")}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[12px] font-bold transition-colors",
                    sortBy === "newest"
                      ? "bg-[var(--chan-surface)] text-[var(--chan-ink)]"
                      : "text-[var(--chan-muted)] hover:bg-[var(--chan-surface)] hover:text-[var(--chan-ink)]",
                  )}
                >
                  {language === "pl" ? "Najnowsze" : "Newest"}
                  {sortBy === "newest" && <span aria-hidden="true">•</span>}
                </button>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={sortBy === "top"}
                  onClick={() => handleSortChange("top")}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[12px] font-bold transition-colors",
                    sortBy === "top"
                      ? "bg-[var(--chan-surface)] text-[var(--chan-ink)]"
                      : "text-[var(--chan-muted)] hover:bg-[var(--chan-surface)] hover:text-[var(--chan-ink)]",
                  )}
                >
                  {language === "pl" ? "Najlepsze" : "Top"}
                  {sortBy === "top" && <span aria-hidden="true">•</span>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

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
        isPatronGated={isPatronGated}
        isPatronDecorative={isPatronDecorative}
        isPending={postMutation.isPending}
        isViewerLoading={isLoading}
        errorMessage={composerError}
        handleSubmit={handleSubmit}
        t={t}
        language={language}
      />

      <div className="space-y-[22px]">
        {isLoading ? (
          <CommentsLoadingState language={language} />
        ) : isError ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 bg-red-50/50 rounded-2xl border border-red-100">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-red-900">
                {language === "pl"
                  ? "Nie udało się załadować komentarzy."
                  : "Could not load comments."}
              </p>
              <p className="text-xs text-red-700/70">
                {language === "pl"
                  ? "Spróbuj odświeżyć stronę lub wróć później."
                  : "Try refreshing the page or come back later."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => refetch()}
            >
              <RefreshCcw size={14} className="mr-2" />
              {language === "pl" ? "Spróbuj ponownie" : "Try again"}
            </Button>
          </div>
        ) : comments.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-3 opacity-60">
            <MessageSquare size={48} className="text-neutral-300" />
            <div className="space-y-1">
              <p className="font-black uppercase tracking-widest text-[11px]">
                {language === "pl" ? "Brak komentarzy" : "No comments yet"}
              </p>
              <p className="text-xs">
                {viewer?.canComment
                  ? language === "pl"
                    ? "Bądź pierwszy i napisz coś sensownego."
                    : "Be the first to say something meaningful."
                  : language === "pl"
                    ? "Ten film nie ma jeszcze komentarzy."
                    : "This video has no comments yet."}
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
          {comments.map((comment) => (
            <CommentMotionItem key={comment.id} className="space-y-[22px]">
              <CommentItem
                comment={comment}
                userProfile={userProfile}
                isClient={isClient}
                language={language}
                t={t}
                canComment={viewer?.canComment ?? false}
                onLike={(id) => likeMutation.mutate(id)}
                onDislike={(id) => dislikeMutation.mutate(id)}
                onReply={(id) => {
                  setReplyTo(id);
                  scrollToTop();
                }}
                onDelete={(id) => deleteMutation.mutate(id)}
                onPin={(id, pinned) =>
                  pinMutation.mutate({ commentId: id, pinned })
                }
                isPinPending={pinMutation.isPending}
                onEdit={(id, text) =>
                  editMutation.mutate({ commentId: id, text })
                }
                onReport={(id, reason, note) =>
                  reportMutation.mutate({ commentId: id, reason, note })
                }
              />

              {/* NESTED REPLIES */}
              {comment.repliesPreview && comment.repliesPreview.length > 0 && (
                <div className="pl-6 md:pl-13 space-y-[22px] border-l border-border ml-4 md:ml-[19px] mt-4">
                  {comment.repliesPreview.map((reply) => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      userProfile={userProfile}
                      isClient={isClient}
                      language={language}
                      t={t}
                      canComment={viewer?.canComment ?? false}
                      onLike={(id) => likeMutation.mutate(id)}
                      onDislike={(id) => dislikeMutation.mutate(id)}
                      onReply={() => {}}
                      onDelete={(id) => deleteMutation.mutate(id)}
                      onPin={() => {}}
                      isPinPending={false}
                      onEdit={(id, text) =>
                        editMutation.mutate({ commentId: id, text })
                      }
                      onReport={(id, reason, note) =>
                        reportMutation.mutate({ commentId: id, reason, note })
                      }
                      isReply={true}
                    />
                  ))}
                </div>
              )}
            </CommentMotionItem>
          ))}
          </AnimatePresence>
        )}

        <div ref={loadMoreRef} className="h-4" />

        {hasNextPage && (
          <div className="pt-6 flex justify-center">
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
                  {language === "pl" ? "Ładowanie..." : "Loading..."}
                </>
              ) : language === "pl" ? (
                "Pokaż więcej"
              ) : (
                "Show more"
              )}
            </Button>
          </div>
        )}


      </div>
    </div>
  );
};

export default EmbeddedComments;
