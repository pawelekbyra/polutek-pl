"use client";

import { useInfiniteQuery, useMutation, useQueryClient, InfiniteData } from "@tanstack/react-query";
import { parseJsonResponse } from "@/lib/client/api";
import { CommentView } from "../types";

type CommentsPage = {
  comments: CommentView[];
  nextCursor?: string | null;
};

type CommentsData = InfiniteData<CommentsPage>;

function updateCommentReactionInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  videoId: string,
  commentId: string,
  action: "LIKE" | "DISLIKE",
) {
  const queries = queryClient.getQueriesData<CommentsData>({ queryKey: ["comments", videoId] });

  const updateComment = (c: CommentView): CommentView => {
    if (c.id === commentId) {
      const wasLiked = !!c.isLiked;
      const wasDisliked = !!c.isDisliked;
      const likes = c._count?.likes ?? 0;
      const dislikes = c._count?.dislikes ?? 0;

      if (action === "LIKE") {
        const nextIsLiked = !wasLiked;
        return {
          ...c,
          isLiked: nextIsLiked,
          isDisliked: false,
          _count: {
            ...(c._count ?? { likes: 0, dislikes: 0 }),
            likes: wasLiked ? Math.max(0, likes - 1) : likes + 1,
            dislikes: wasDisliked ? Math.max(0, dislikes - 1) : (c._count?.dislikes ?? 0),
          },
        };
      }

      const nextIsDisliked = !wasDisliked;
      return {
        ...c,
        isLiked: false,
        isDisliked: nextIsDisliked,
        _count: {
          ...(c._count ?? { likes: 0, dislikes: 0 }),
          likes: wasLiked ? Math.max(0, likes - 1) : (c._count?.likes ?? 0),
          dislikes: wasDisliked ? Math.max(0, dislikes - 1) : dislikes + 1,
        },
      };
    }
    if (c.replies) return { ...c, replies: c.replies.map(updateComment) };
    return c;
  };

  for (const [queryKey, previousData] of queries) {
    queryClient.setQueryData<CommentsData>(queryKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          comments: page.comments.map(updateComment),
        })),
      };
    });
  }

  return queries;
}


export function useComments(videoId: string, sortBy: "newest" | "top") {
  const queryClient = useQueryClient();

  const { data, fetchNextPage, hasNextPage, isLoading, isFetchingNextPage, isError, error } =
    useInfiniteQuery({
      queryKey: ["comments", videoId, sortBy],
      queryFn: async ({ pageParam }) => {
        const url = new URL("/api/comments", window.location.origin);
        url.searchParams.append("videoId", videoId);
        url.searchParams.append("sortBy", sortBy);
        if (pageParam) url.searchParams.append("cursor", pageParam as string);
        const res = await fetch(url.toString());
        return parseJsonResponse<CommentsPage & { viewer: any; totalCount: number }>(res);
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
    mutationKey: ["comment-reaction", videoId],
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
      const previousData = updateCommentReactionInCache(queryClient, videoId, commentId, "LIKE");
      return { previousData };
    },
    onError: (err, commentId, context) => {
      for (const [queryKey, data] of context?.previousData ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ["comment-reaction", videoId] }) === 1) {
        queryClient.invalidateQueries({ queryKey: ["comments", videoId] });
      }
    },
  });

  const dislikeMutation = useMutation({
    mutationKey: ["comment-reaction", videoId],
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
      const previousData = updateCommentReactionInCache(queryClient, videoId, commentId, "DISLIKE");
      return { previousData };
    },
    onError: (err, commentId, context) => {
      for (const [queryKey, data] of context?.previousData ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ["comment-reaction", videoId] }) === 1) {
        queryClient.invalidateQueries({ queryKey: ["comments", videoId] });
      }
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

  const editMutation = useMutation({
    mutationFn: async ({ commentId, text }: { commentId: string; text: string }) => {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        body: JSON.stringify({ text }),
        headers: { "Content-Type": "application/json" },
      });
      return parseJsonResponse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", videoId] });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async ({ commentId, reason, note }: { commentId: string; reason: string; note?: string }) => {
      const res = await fetch(`/api/comments/${commentId}/report`, {
        method: "POST",
        body: JSON.stringify({ reason, note }),
        headers: { "Content-Type": "application/json" },
      });
      return parseJsonResponse(res);
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
    editMutation,
    reportMutation,
  };
}
