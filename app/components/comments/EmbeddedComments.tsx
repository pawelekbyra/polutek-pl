"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  MessageSquare,
  Loader2,
} from "../icons";
import { useAuth, useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useLanguage } from "../LanguageContext";
import { AccessTier } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { parseJsonResponse } from "@/lib/client/api";
import { CommentView } from "./types";
import { CommentComposer } from "./components/CommentComposer";
import { CommentItem } from "./components/CommentItem";

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

type CommentsPage = {
  comments: CommentView[];
  nextCursor?: string | null;
};

type CommentsData = InfiniteData<CommentsPage>;

interface EmbeddedCommentsProps {
  userProfile?: {
    id: string;
    imageUrl?: string | null;
    name?: string | null;
    username?: string | null;
    totalPaid?: number;
    isPatron?: boolean;
    role?: string;
  } | null;
  videoId: string;
  videoTier?: AccessTier;
}

const EmbeddedComments: React.FC<EmbeddedCommentsProps> = ({
  userProfile: propUserProfile,
  videoId,
  videoTier = "PUBLIC",
}) => {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();

  const metadata = (user?.publicMetadata || {}) as ClerkCommentMetadata;
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
        isPatron: booleanMetadata(metadata.isPatron),
        role: stringMetadata(metadata.role, "USER"),
      }
    : null;
  const userProfile =
    propUserProfile || clerkUserProfile
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

  const isPatronGated = videoTier === "PATRON";
  const isPatron = userProfile?.role === "ADMIN" || userProfile?.isPatron === true;
  const canComment = !!userProfile && (!isPatronGated || isPatron);
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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const { data, fetchNextPage, hasNextPage, isLoading, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: [
        "comments",
        videoId,
        sortBy,
      ],
      queryFn: async ({ pageParam }) => {
        const url = new URL("/api/comments", window.location.origin);
        url.searchParams.append("videoId", videoId);
        url.searchParams.append("sortBy", sortBy);
        if (pageParam) url.searchParams.append("cursor", pageParam as string);
        const res = await fetch(url.toString());
        return parseJsonResponse<CommentsPage>(res);
      },
      initialPageParam: "",
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      enabled: !!videoId,
    });

  const comments = data?.pages?.flatMap((page) => page.comments || []) ?? [];

  const replyingToAuthor = replyTo
    ? comments.find((c) => c.id === replyTo)?.authorName
    : null;

  const postMutation = useMutation({
    mutationFn: async ({
      text,
      parentId,
    }: {
      text: string;
      parentId?: string;
    }) => {
      const res = await fetch("/api/comments", {
        method: "POST",
        body: JSON.stringify({
          videoId,
          text,
          parentId,
        }),
        headers: { "Content-Type": "application/json" },
      });
      return parseJsonResponse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", videoId] });
      setNewComment("");
      setReplyTo(null);
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch("/api/comments/like", {
        method: "POST",
        body: JSON.stringify({ commentId }),
        headers: { "Content-Type": "application/json" },
      });
      return parseJsonResponse(res);
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ["comments", videoId] });
      const previousData = queryClient.getQueryData([
        "comments",
        videoId,
        sortBy,
      ]);

      queryClient.setQueryData<CommentsData>(
        [
          "comments",
          videoId,
          sortBy,
        ],
        (old) => {
          if (!old) return old;

          const updateComment = (c: CommentView): CommentView => {
            if (c.id === commentId) {
              const wasLiked = c.isLiked;
              const wasDisliked = c.isDisliked;
              return {
                ...c,
                isLiked: !wasLiked,
                isDisliked: false,
                _count: {
                  ...(c._count ?? { likes: 0, dislikes: 0 }),
                  likes: wasLiked
                    ? Math.max(0, (c._count?.likes ?? 0) - 1)
                    : (c._count?.likes ?? 0) + 1,
                  dislikes: wasDisliked
                    ? Math.max(0, (c._count?.dislikes ?? 0) - 1)
                    : (c._count?.dislikes ?? 0),
                },
              };
            }
            if (c.replies) {
              return { ...c, replies: c.replies.map(updateComment) };
            }
            return c;
          };

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              comments: page.comments.map(updateComment),
            })),
          };
        },
      );

      return { previousData };
    },
    onError: (err, commentId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          [
            "comments",
            videoId,
            sortBy,
          ],
          context.previousData,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", videoId] });
    },
  });

  const dislikeMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch("/api/comments/dislike", {
        method: "POST",
        body: JSON.stringify({ commentId }),
        headers: { "Content-Type": "application/json" },
      });
      return parseJsonResponse(res);
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ["comments", videoId] });
      const previousData = queryClient.getQueryData([
        "comments",
        videoId,
        sortBy,
      ]);

      queryClient.setQueryData<CommentsData>(
        [
          "comments",
          videoId,
          sortBy,
        ],
        (old) => {
          if (!old) return old;

          const updateComment = (c: CommentView): CommentView => {
            if (c.id === commentId) {
              const wasLiked = c.isLiked;
              const wasDisliked = c.isDisliked;
              return {
                ...c,
                isLiked: false,
                isDisliked: !wasDisliked,
                _count: {
                  ...(c._count ?? { likes: 0, dislikes: 0 }),
                  likes: wasLiked
                    ? Math.max(0, (c._count?.likes ?? 0) - 1)
                    : (c._count?.likes ?? 0),
                  dislikes: wasDisliked
                    ? Math.max(0, (c._count?.dislikes ?? 0) - 1)
                    : (c._count?.dislikes ?? 0) + 1,
                },
              };
            }
            if (c.replies) {
              return { ...c, replies: c.replies.map(updateComment) };
            }
            return c;
          };

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              comments: page.comments.map(updateComment),
            })),
          };
        },
      );

      return { previousData };
    },
    onError: (err, commentId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          [
            "comments",
            videoId,
            sortBy,
          ],
          context.previousData,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", videoId] });
    },
  });

  const pinMutation = useMutation({
    mutationFn: async ({
      commentId,
      pinned,
    }: {
      commentId: string;
      pinned: boolean;
    }) => {
      const res = await fetch("/api/comments", {
        method: "PATCH",
        body: JSON.stringify({ commentId, pinned }),
        headers: { "Content-Type": "application/json" },
      });
      return parseJsonResponse(res);
    },
    onMutate: async ({ commentId, pinned }) => {
      await queryClient.cancelQueries({ queryKey: ["comments", videoId] });
      const queryKey = [
        "comments",
        videoId,
        sortBy,
      ];
      const previousData = queryClient.getQueryData(queryKey);

      queryClient.setQueryData<CommentsData>(queryKey, (old) => {
        if (!old) return old;

        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            comments: page.comments.map((comment) => ({
              ...comment,
              isPinned: pinned
                ? comment.id === commentId
                : comment.id === commentId
                  ? false
                  : comment.isPinned,
              pinnedAt:
                pinned && comment.id === commentId
                  ? new Date().toISOString()
                  : comment.id === commentId
                    ? null
                    : comment.pinnedAt,
            })),
          })),
        };
      });

      return { previousData, queryKey };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", videoId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch(`/api/comments?id=${commentId}`, {
        method: "DELETE",
      });
      return parseJsonResponse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", videoId] });
    },
  });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !userProfile) return;
    postMutation.mutate({ text: newComment, parentId: replyTo || undefined });
  }, [newComment, userProfile, replyTo, postMutation]);

  const getCommentsLabel = (count: number) => {
    if (language === "pl") {
      if (count === 1) return "Komentarz";
      const lastDigit = count % 10;
      const lastTwoDigits = count % 100;
      if (
        lastDigit >= 2 &&
        lastDigit <= 4 &&
        (lastTwoDigits < 12 || lastTwoDigits > 14)
      ) {
        return "Komentarze";
      }
      return "Komentarzy";
    }
    return count === 1 ? "comment" : "comments";
  };

  return (
    <div className="space-y-7 max-w-3xl bg-white px-6 pb-6 pt-3 md:px-8 md:pb-8 md:pt-4 rounded-2xl border border-neutral-200 shadow-sm my-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3 order-2 sm:order-1">
          <MessageSquare size={20} className="text-blue-600" />
          <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tighter">
            {comments.length} {getCommentsLabel(comments.length)}
          </h3>
        </div>

        <div className="flex gap-4 order-1 sm:order-2 self-end sm:self-auto">
          <button
            onClick={() => setSortBy("top")}
            className={cn(
              "text-[10px] font-black uppercase tracking-[0.2em] transition-all pb-1 border-b-2",
              sortBy === "top"
                ? "text-blue-600 border-blue-600"
                : "text-neutral-400 border-transparent hover:text-neutral-600",
            )}
          >
            {language === "pl" ? "Najlepsze" : "Top"}
          </button>
          <button
            onClick={() => setSortBy("newest")}
            className={cn(
              "text-[10px] font-black uppercase tracking-[0.2em] transition-all pb-1 border-b-2",
              sortBy === "newest"
                ? "text-blue-600 border-blue-600"
                : "text-neutral-400 border-transparent hover:text-neutral-600",
            )}
          >
            {language === "pl" ? "Najnowsze" : "Newest"}
          </button>
        </div>
      </div>

      <CommentComposer
        userProfile={userProfile}
        userAvatarUrl={userAvatarUrl}
        replyTo={replyTo}
        replyingToAuthor={replyingToAuthor}
        newComment={newComment}
        setNewComment={setNewComment}
        setReplyTo={setReplyTo}
        isInputFocused={isInputFocused}
        setIsInputFocused={setIsInputFocused}
        canComment={canComment}
        isPatronGated={isPatronGated}
        isPatron={isPatron}
        isPending={postMutation.isPending}
        handleSubmit={handleSubmit}
        t={t}
        language={language}
      />

      <div className="space-y-6">
        {comments.map((comment) => (
          <div key={comment.id} className="space-y-3">
            <CommentItem
              comment={comment}
              userProfile={userProfile}
              isClient={isClient}
              language={language}
              t={t}
              canComment={canComment}
              onLike={(id) => likeMutation.mutate(id)}
              onDislike={(id) => dislikeMutation.mutate(id)}
              onReply={(id) => setReplyTo(id)}
              onDelete={(id) => deleteMutation.mutate(id)}
              onPin={(id, pinned) => pinMutation.mutate({ commentId: id, pinned })}
              isPinPending={pinMutation.isPending}
            />

            {/* NESTED REPLIES */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="pl-6 md:pl-14 space-y-5 border-l-2 border-neutral-100 ml-4 md:ml-6 mt-4">
                {comment.replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    userProfile={userProfile}
                    isClient={isClient}
                    language={language}
                    t={t}
                    canComment={canComment}
                    onLike={(id) => likeMutation.mutate(id)}
                    onDislike={(id) => dislikeMutation.mutate(id)}
                    onReply={() => {}}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onPin={() => {}}
                    isPinPending={false}
                    isReply={true}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {hasNextPage && (
          <div className="pt-6 flex justify-center">
            <Button
              variant="outline"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Pokaż więcej"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmbeddedComments;
