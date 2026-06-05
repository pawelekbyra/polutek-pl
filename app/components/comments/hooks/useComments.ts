"use client";

import { useInfiniteQuery, useMutation, useQueryClient, InfiniteData } from "@tanstack/react-query";
import { parseJsonResponse } from "@/lib/client/api";
import { CommentView } from "../types";

type CommentsPage = {
  comments: CommentView[];
  nextCursor?: string | null;
};

type CommentsData = InfiniteData<CommentsPage>;

export function useComments(videoId: string, sortBy: "newest" | "top") {
  const queryClient = useQueryClient();

  const { data, fetchNextPage, hasNextPage, isLoading, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["comments", videoId, sortBy],
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
      const previousData = queryClient.getQueryData(["comments", videoId, sortBy]);

      queryClient.setQueryData<CommentsData>(
        ["comments", videoId, sortBy],
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
        queryClient.setQueryData(["comments", videoId, sortBy], context.previousData);
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
      const previousData = queryClient.getQueryData(["comments", videoId, sortBy]);

      queryClient.setQueryData<CommentsData>(
        ["comments", videoId, sortBy],
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
        queryClient.setQueryData(["comments", videoId, sortBy], context.previousData);
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
      const queryKey = ["comments", videoId, sortBy];
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

  return {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    postMutation,
    likeMutation,
    dislikeMutation,
    pinMutation,
    deleteMutation,
  };
}
