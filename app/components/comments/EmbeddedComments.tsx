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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccessTierDto } from "@/lib/modules/comments/domain/comment-frontend.dto";
import { CommentComposer } from "./components/CommentComposer";
import { CommentItem } from "./components/CommentItem";
import { AnimatePresence } from "framer-motion";
import { CommentMotionItem, AnimatedCount } from "./components/comment-motion";
import { useComments } from "./hooks/useComments";
import { useClientReady } from "@/app/hooks/useClientEnvironment";
import { CommentLoadingSkeleton } from "@/components/skeletons";

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

const CommentsLoadingState = () => <CommentLoadingSkeleton />;

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
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const isClient = useClientReady();
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

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
      const yOffset = -360; // Scroll higher, around the video title area
      const y =
        commentsTopRef.current.getBoundingClientRect().top +
        window.pageYOffset +
        yOffset;
      const shouldReduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      window.scrollTo({
        top: y,
        behavior: shouldReduceMotion ? "auto" : "smooth",
      });
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
  };

  return (
    <div
      ref={commentsTopRef}
      className="space-y-[24px] sm:space-y-[30px] max-w-full bg-transparent rounded-none border-none shadow-none mb-[30px] relative"
    >
      {/* Back to comments top */}
      {showStickyHeader && (
        <div className="fixed bottom-5 right-5 z-50 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-200 sm:bottom-6 sm:right-6">
          <button
            type="button"
            onClick={scrollToTop}
            aria-label={language === "pl" ? "Wróć do początku komentarzy" : "Back to the top of comments"}
            className="group flex h-12 w-12 items-center justify-center rounded-full bg-[var(--chan-blue)] text-white shadow-[0_10px_30px_color-mix(in_srgb,var(--chan-blue)_35%,transparent)] ring-1 ring-white/20 transition hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--chan-blue)_86%,black)] hover:shadow-[0_14px_36px_color-mix(in_srgb,var(--chan-blue)_42%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] focus-visible:ring-offset-2 active:translate-y-0 active:scale-95"
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
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-[var(--chan-muted)] transition-colors hover:bg-[var(--chan-surface)] hover:text-[var(--chan-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] motion-reduce:transition-none"
              aria-label={
                language === "pl" ? "Sortuj komentarze" : "Sort comments"
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
                {language === "pl" ? "Sortuj według" : "Sort by"}
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
                  {language === "pl" ? "Najnowsze" : "Newest"}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="top"
                  className="min-h-10 rounded-xl px-3 py-2 text-[12px] font-bold text-[var(--chan-muted)] focus:bg-[var(--chan-surface)] focus:text-[var(--chan-ink)]"
                >
                  {language === "pl" ? "Najlepsze" : "Top"}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
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
                isReactionPending={
                  likeMutation.isPending || dislikeMutation.isPending
                }
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
                      isReactionPending={
                        likeMutation.isPending || dislikeMutation.isPending
                      }
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
