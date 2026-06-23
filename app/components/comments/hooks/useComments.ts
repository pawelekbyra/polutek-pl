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

type PostCommentResponse = {
  success: true;
  comment: CommentView;
};

export class CommentPostError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "CommentPostError";
    this.status = status;
    this.code = code;
  }
}

async function parseCommentPostResponse(res: Response, language: string = "pl"): Promise<PostCommentResponse> {
  const data = await res.json().catch(() => null) as any;

  if (!res.ok || data?.success === false) {
    const code = data?.code;
    let message = data?.message || data?.errors?.fieldErrors?.text?.[0];

    if (!message || code) {
      if (language === "pl") {
        message =
          code === "AUTH_REQUIRED" ? "Musisz być zalogowany, żeby komentować." :
          code === "COMMENT_FORBIDDEN" ? "Nie masz uprawnień do komentowania tego filmu." :
          code === "COMMENT_RATE_LIMITED" ? "Zbyt dużo komentarzy. Spróbuj ponownie za chwilę." :
          code === "COMMENT_VALIDATION_ERROR" ? "Nieprawidłowe dane komentarza." :
          code === "COMMENT_TOO_LONG" ? "Komentarz jest za długi." :
          message || (res.status === 401
            ? "Musisz być zalogowany, żeby komentować."
            : res.status === 403
              ? "Nie masz uprawnień do komentowania tego filmu."
              : res.status === 429
                ? "Zbyt dużo komentarzy. Spróbuj ponownie za chwilę."
                : "Nie udało się dodać komentarza.");
      } else {
        message =
          code === "AUTH_REQUIRED" ? "You must be signed in to comment." :
          code === "COMMENT_FORBIDDEN" ? "You don't have permission to comment on this video." :
          code === "COMMENT_RATE_LIMITED" ? "Too many comments. Try again in a moment." :
          code === "COMMENT_VALIDATION_ERROR" ? "Invalid comment data." :
          code === "COMMENT_TOO_LONG" ? "Comment is too long." :
          message || (res.status === 401
            ? "You must be signed in to comment."
            : res.status === 403
              ? "You don't have permission to comment."
              : res.status === 429
                ? "Too many comments. Try again later."
                : "Failed to add comment.");
      }
    }

    throw new CommentPostError(message, res.status, code);
  }

  return data as PostCommentResponse;
}

function createOptimisticComment({
  videoId,
  text,
  parentId,
  userProfile,
}: {
  videoId: string;
  text: string;
  parentId?: string;
  userProfile?: any;
}): CommentView {
  const now = new Date().toISOString();
  const badges = [];
  if (userProfile?.role === "ADMIN") badges.push({ type: "ADMIN", label: "Admin" });
  /** Decorative only - optimistic UI follows cached isPatronDecorative for immediate feedback. */
  if (userProfile?.isPatronDecorative) badges.push({ type: "PATRON", label: "Patron" });

  return {
    id: `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    videoId,
    parentId: parentId ?? null,
    text,
    imageUrl: null,
    status: "VISIBLE",
    author: {
      id: userProfile?.id || "viewer",
      displayName: userProfile?.name || "Ty",
      username: userProfile?.username || null,
      imageUrl: userProfile?.imageUrl || null,
      badges: badges as any[],
    },
    createdAt: now,
    updatedAt: now,
    editedAt: null,
    deletedAt: null,
    deletedReason: null,
    pinnedAt: null,
    likesCount: 0,
    repliesCount: 0,
    reportsCount: 0,
    viewerReaction: null,
    viewerCanEdit: false,
    viewerCanDelete: false,
    viewerCanReport: false,
    viewerCanModerate: false,
    viewerCanPin: false,
    isPinned: false,
    repliesPreview: [],
  };
}

function updateCommentReactionInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  videoId: string,
  commentId: string,
  action: "LIKE" | "UNLIKE",
) {
  // We must target all variants of sortBy to prevent rollback when switching views
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


export function useComments(videoId: string, sortBy: "newest" | "top", language: string = "pl", userProfile?: any) {
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
      return parseCommentPostResponse(res, language);
    },
    onMutate: async ({ text, parentId }) => {
      await queryClient.cancelQueries({ queryKey: ["comments", videoId] });
      const queries = queryClient.getQueriesData<CommentsData>({ queryKey: ["comments", videoId] });
      const optimisticComment = createOptimisticComment({ videoId, text, parentId, userProfile });

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
            const updatedPages = pages.map(page => ({
              ...page,
              comments: page.comments.map(c => {
                if (c.id === parentId) {
                  return {
                    ...c,
                    repliesCount: (c.repliesCount ?? 0) + 1,
                    repliesPreview: [...(c.repliesPreview ?? []), optimisticComment],
                  };
                }
                // Check if the parent is in repliesPreview (though we only support 1 level deep in UI usually)
                if (c.repliesPreview?.some(r => r.id === parentId)) {
                  return {
                    ...c,
                    repliesPreview: c.repliesPreview.map(r => {
                      if (r.id === parentId) {
                        return {
                          ...r,
                          repliesCount: (r.repliesCount ?? 0) + 1,
                          repliesPreview: [...(r.repliesPreview ?? []), optimisticComment],
                        };
                      }
                      return r;
                    })
                  };
                }
                return c;
              })
            }));
            return { ...old, pages: updatedPages };
          }

          if (String(queryKey[2]) === "newest" && pages[0]) {
            pages[0] = {
              ...pages[0],
              comments: [optimisticComment, ...pages[0].comments],
            };
          }

          return { ...old, pages };
        });
      }

      return { previousData: queries, optimisticId: optimisticComment.id };
    },
    onSuccess: (data, _variables, context) => {
      if (!context?.optimisticId || !data?.comment) return;
      const queries = queryClient.getQueriesData<CommentsData>({ queryKey: ["comments", videoId] });
      const replace = (comment: CommentView): CommentView => {
        if (comment.id === context.optimisticId) return data.comment;
        return {
          ...comment,
          repliesPreview: comment.repliesPreview?.map(replace) ?? [],
        };
      };

      for (const [queryKey] of queries) {
        queryClient.setQueryData<CommentsData>(queryKey, (old) => old && {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            comments: page.comments.map(replace),
          })),
        });
      }
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", videoId], refetchType: "inactive" });
    },
  });

  const getCommentLikeAction = (commentId: string): "LIKE" | "UNLIKE" => {
    const allComments = queryClient.getQueriesData<CommentsData>({ queryKey: ["comments", videoId] })
      .flatMap(q => q[1]?.pages.flatMap(p => p.comments) || []);
    const comment = allComments.find(c => c?.id === commentId) ||
      allComments.flatMap(c => c?.repliesPreview || []).find(r => r?.id === commentId);
    return comment?.viewerReaction === "LIKE" ? "UNLIKE" : "LIKE";
  };

  const likeMutation = useMutation({
    mutationKey: ["comment-reaction", videoId],
    mutationFn: async ({ commentId, action }: { commentId: string; action: "LIKE" | "UNLIKE" }) => {
      const res = await fetch(`/api/comments/${commentId}/reaction`, {
        method: action === "LIKE" ? "PUT" : "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      return parseJsonResponse(res);
    },
    onMutate: async ({ commentId, action }) => {
      await queryClient.cancelQueries({ queryKey: ["comments", videoId] });
      const previousData = updateCommentReactionInCache(queryClient, videoId, commentId, action);
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
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
    likeMutation: {
      ...likeMutation,
      mutate: (commentId: string) => likeMutation.mutate({ commentId, action: getCommentLikeAction(commentId) }),
      mutateAsync: (commentId: string) => likeMutation.mutateAsync({ commentId, action: getCommentLikeAction(commentId) }),
    },
    pinMutation,
    deleteMutation,
    editMutation,
    reportMutation,
    refetch,
  };
}
