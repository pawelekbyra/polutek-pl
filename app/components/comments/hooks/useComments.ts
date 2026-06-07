"use client";

import { useInfiniteQuery, useMutation, useQueryClient, InfiniteData } from "@tanstack/react-query";
import { parseJsonResponse } from "@/lib/client/api";
import { CommentView } from "../types";

type CommentsPage = {
  comments: CommentView[];
  nextCursor?: string | null;
  totalCount: number;
};

type CommentsData = InfiniteData<CommentsPage>;

function updateCommentReactionInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  videoId: string,
  commentId: string,
  action: "LIKE" | "UNLIKE",
) {
  const queries = queryClient.getQueriesData<CommentsData>({ queryKey: ["comments", videoId] });

  const updateComment = (c: CommentView): CommentView => {
    if (c.id === commentId) {
      const wasLiked = c.viewerReaction === "LIKE";
      const likes = c.likesCount ?? 0;

      if (action === "LIKE") {
        return {
          ...c,
          viewerReaction: "LIKE",
          likesCount: wasLiked ? likes : likes + 1,
        };
      } else {
        return {
          ...c,
          viewerReaction: null,
          likesCount: wasLiked ? Math.max(0, likes - 1) : likes,
        };
      }
    }
    if (c.repliesPreview) return { ...c, repliesPreview: c.repliesPreview.map(updateComment) };
    return c;
  };

  for (const [queryKey] of queries) {
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

  const { data, fetchNextPage, hasNextPage, isLoading, isFetchingNextPage, isError, error, refetch } =
    useInfiniteQuery({
      queryKey: ["comments", videoId, sortBy],
      queryFn: async ({ pageParam }) => {
        const url = new URL('/api/comments', window.location.origin);
        url.searchParams.set('videoId', videoId);
        url.searchParams.set('sortBy', sortBy);
        if (pageParam) url.searchParams.set('cursor', String(pageParam));
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
      const res = await fetch(`/api/videos/${videoId}/comments`, {
        method: "POST",
        body: JSON.stringify({
          text,
          parentId,
        }),
        headers: { "Content-Type": "application/json" },
      });
      return parseJsonResponse(res);
    },
    onMutate: async ({ text, parentId }) => {
      await queryClient.cancelQueries({ queryKey: ["comments", videoId] });
      const queries = queryClient.getQueriesData<CommentsData>({ queryKey: ["comments", videoId] });

      for (const [queryKey] of queries) {
        queryClient.setQueryData<CommentsData>(queryKey, (old) => {
          if (!old) return old;

          const pages = [...old.pages];
          if (pages[0]) {
             pages[0] = {
               ...pages[0],
               totalCount: pages[0].totalCount + 1
             };
          }

          if (parentId) {
            return {
              ...old,
              pages: pages.map(page => ({
                ...page,
                comments: page.comments.map(c => {
                  if (c.id === parentId) {
                    return { ...c, repliesCount: (c.repliesCount ?? 0) + 1 };
                  }
                  return c;
                })
              }))
            };
          }

          return { ...old, pages };
        });
      }

      return { previousData: queries };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", videoId] });
    },
  });

  const likeMutation = useMutation({
    mutationKey: ["comment-reaction", videoId],
    mutationFn: async (commentId: string) => {
      const allComments = queryClient.getQueriesData<CommentsData>({ queryKey: ["comments", videoId] })
          .flatMap(q => q[1]?.pages.flatMap(p => p.comments) || []);

      const comment = allComments.find(c => c?.id === commentId) ||
                    allComments.flatMap(c => c?.repliesPreview || []).find(r => r?.id === commentId);

      const isLiked = comment?.viewerReaction === "LIKE";
      const method = isLiked ? "DELETE" : "PUT";

      const res = await fetch(`/api/comments/${commentId}/reaction`, {
        method,
        headers: { "Content-Type": "application/json" },
      });
      return parseJsonResponse(res);
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ["comments", videoId] });

      const allComments = queryClient.getQueriesData<CommentsData>({ queryKey: ["comments", videoId] })
          .flatMap(q => q[1]?.pages.flatMap(p => p.comments) || []);

      const comment = allComments.find(c => c?.id === commentId) ||
                    allComments.flatMap(c => c?.repliesPreview || []).find(r => r?.id === commentId);

      const isLiked = comment?.viewerReaction === "LIKE";
      const action = isLiked ? "UNLIKE" : "LIKE";

      const previousData = updateCommentReactionInCache(queryClient, videoId, commentId, action);
      return { previousData };
    },
    onError: (err, commentId, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: (data, error, commentId) => {
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
      const res = await fetch(`/api/comments/${commentId}/pin`, {
        method: pinned ? "POST" : "DELETE",
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
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });
      return parseJsonResponse(res);
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ["comments", videoId] });

      const queries = queryClient.getQueriesData<CommentsData>({ queryKey: ["comments", videoId] });

      const removeComment = (c: CommentView, parent?: CommentView): CommentView | null => {
        if (c.id === commentId) {
          return null;
        }

        const next = { ...c };
        if (next.repliesPreview) {
          const originalCount = next.repliesPreview.length;
          next.repliesPreview = next.repliesPreview
            .map(r => removeComment(r, next))
            .filter((r): r is CommentView => r !== null);

          if (next.repliesPreview.length < originalCount) {
             next.repliesCount = Math.max(0, (next.repliesCount ?? 0) - (originalCount - next.repliesPreview.length));
          }
        }
        return next;
      };

      for (const [queryKey] of queries) {
        queryClient.setQueryData<CommentsData>(queryKey, (old) => {
          if (!old) return old;

          const pages = [...old.pages];
          if (pages[0]) {
             pages[0] = {
               ...pages[0],
               totalCount: Math.max(0, pages[0].totalCount - 1)
             };
          }

          return {
            ...old,
            pages: pages.map((page) => ({
              ...page,
              comments: page.comments
                .map(c => removeComment(c))
                .filter((c): c is CommentView => c !== null),
            })),
          };
        });
      }

      return { previousData: queries };
    },
    onError: (err, commentId, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
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
    isError,
    error,
    postMutation,
    likeMutation,
    pinMutation,
    deleteMutation,
    editMutation,
    reportMutation,
    refetch,
  };
}
