"use client";
import { insertBelowPinned, pinnedFirst } from "./pinned-order";

import { useCallback, useRef } from "react";
import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient, InfiniteData, QueryClient } from "@tanstack/react-query";
import { parseJsonResponse } from "@/lib/client/api";
import { CommentView } from "../types";
import type { InitialCommentsPage } from "../initial-comments";
import type { Locale } from "@/lib/i18n/routing";
import type { Tx } from "@/lib/i18n/ui";
import { useOptionalTx } from "@/lib/i18n/language-context";

type CommentsPage = {
  comments: CommentView[];
  nextCursor?: string | null;
  totalCount: number;
};

type RepliesPage = {
  replies: CommentView[];
  nextCursor: string | null;
};

type CommentsData = InfiniteData<CommentsPage>;
type RepliesData = InfiniteData<RepliesPage>;

type PostCommentResponse = {
  success: true;
  comment: CommentView;
};

type ReactionResponse = {
  viewerReaction?: CommentView["viewerReaction"];
  likesCount?: number;
};

/** Page size of "show more replies". */
export const REPLIES_PAGE_SIZE = 20;

/** Cache keys. Replies have their own prefix: their pages have a different shape than the list. */
export const commentKeys = {
  list: (videoId: string) => ["comments", videoId] as const,
  replies: (videoId: string, parentId?: string) =>
    (parentId ? ["comment-replies", videoId, parentId] : ["comment-replies", videoId]) as readonly string[],
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

async function parseCommentPostResponse(res: Response, tx: Tx): Promise<PostCommentResponse> {
  const data = await res.json().catch(() => null) as any;

  if (!res.ok || data?.success === false) {
    const code = data?.code;
    let message = data?.message || data?.errors?.fieldErrors?.text?.[0];

    if (!message || code) {
      message =
        code === "AUTH_REQUIRED" ? tx("Musisz być zalogowany, żeby komentować.", "You must be signed in to comment.") :
        code === "ONBOARDING_REQUIRED" ? tx("Najpierw wybierz pseudonim w oknie powitalnym, potem możesz komentować.", "Choose a nickname in the welcome window first, then you can comment.") :
        code === "COMMENT_FORBIDDEN" ? tx("Nie masz uprawnień do komentowania tego filmu.", "You don't have permission to comment on this video.") :
        code === "COMMENT_RATE_LIMITED" ? tx("Zbyt dużo komentarzy. Spróbuj ponownie za chwilę.", "Too many comments. Try again in a moment.") :
        code === "COMMENT_VALIDATION_ERROR" ? tx("Nieprawidłowe dane komentarza.", "Invalid comment data.") :
        code === "COMMENT_TOO_LONG" ? tx("Komentarz jest za długi.", "Comment is too long.") :
        message || (res.status === 401
          ? tx("Musisz być zalogowany, żeby komentować.", "You must be signed in to comment.")
          : res.status === 403
            ? tx("Nie masz uprawnień do komentowania tego filmu.", "You don't have permission to comment on this video.")
            : res.status === 429
              ? tx("Zbyt dużo komentarzy. Spróbuj ponownie za chwilę.", "Too many comments. Try again in a moment.")
              : tx("Nie udało się dodać komentarza.", "Failed to add comment."));
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

  return {
    id: `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    videoId,
    parentId: parentId ?? null,
    text,
    status: "VISIBLE",
    author: {
      id: userProfile?.id || "viewer",
      displayName: userProfile?.name || "Ty",
      username: userProfile?.username || null,
      imageUrl: userProfile?.imageUrl || null,
      // The server decides the real badges.
      badges: [],
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
    isHearted: false,
    repliesPreview: [],
  };
}

/** Applies `update` to one comment (top-level or reply); returning null removes it. */
function mapComment(comment: CommentView, update: (c: CommentView) => CommentView | null): CommentView | null {
  const next = update(comment);
  if (!next) return null;
  if (!next.repliesPreview?.length) return next;
  return {
    ...next,
    repliesPreview: next.repliesPreview
      .map((reply) => mapComment(reply, update))
      .filter((reply): reply is CommentView => reply !== null),
  };
}

/**
 * Applies `update` to every cached copy of every comment of a video: all sort orders of the
 * list and every loaded page of every thread's replies.
 */
function updateCachedComments(
  queryClient: QueryClient,
  videoId: string,
  update: (c: CommentView) => CommentView | null,
  updatePage?: (page: CommentsPage, index: number) => CommentsPage,
) {
  const apply = (list: CommentView[]) =>
    list.map((c) => mapComment(c, update)).filter((c): c is CommentView => c !== null);

  for (const [queryKey] of queryClient.getQueriesData<CommentsData>({ queryKey: commentKeys.list(videoId) })) {
    queryClient.setQueryData<CommentsData>(queryKey, (old) =>
      old && {
        ...old,
        pages: old.pages.map((page, index) => {
          const updated = { ...page, comments: apply(page.comments) };
          return updatePage ? updatePage(updated, index) : updated;
        }),
      },
    );
  }
  for (const [queryKey] of queryClient.getQueriesData<RepliesData>({ queryKey: commentKeys.replies(videoId) })) {
    queryClient.setQueryData<RepliesData>(queryKey, (old) =>
      old && { ...old, pages: old.pages.map((page) => ({ ...page, replies: apply(page.replies) })) },
    );
  }
}

function findCachedComment(queryClient: QueryClient, videoId: string, commentId: string): CommentView | undefined {
  const lists = queryClient
    .getQueriesData<CommentsData>({ queryKey: commentKeys.list(videoId) })
    .flatMap(([, data]) => data?.pages.flatMap((page) => page.comments) ?? []);
  const replies = queryClient
    .getQueriesData<RepliesData>({ queryKey: commentKeys.replies(videoId) })
    .flatMap(([, data]) => data?.pages.flatMap((page) => page.replies) ?? []);
  const all = [...lists, ...lists.flatMap((c) => c.repliesPreview ?? []), ...replies];
  return all.find((c) => c?.id === commentId);
}

/** Stops in-flight refetches so they cannot overwrite an optimistic update. */
async function cancelCommentQueries(queryClient: QueryClient, videoId: string) {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: commentKeys.list(videoId) }),
    queryClient.cancelQueries({ queryKey: commentKeys.replies(videoId) }),
  ]);
}

function snapshotCaches(queryClient: QueryClient, videoId: string) {
  return [
    ...queryClient.getQueriesData({ queryKey: commentKeys.list(videoId) }),
    ...queryClient.getQueriesData({ queryKey: commentKeys.replies(videoId) }),
  ];
}

function restoreCaches(queryClient: QueryClient, snapshot: ReturnType<typeof snapshotCaches>) {
  for (const [queryKey, data] of snapshot) queryClient.setQueryData(queryKey, data);
}

function applyReactionLocally(comment: CommentView, action: "LIKE" | "DISLIKE" | "CLEAR"): CommentView {
  const wasLiked = comment.viewerReaction === "LIKE";
  const likes = comment.likesCount ?? 0;
  if (action === "LIKE") {
    return { ...comment, viewerReaction: "LIKE", likesCount: wasLiked ? likes : likes + 1 };
  }
  // DISLIKE has no counter, but replaces a LIKE; CLEAR removes any reaction
  return {
    ...comment,
    viewerReaction: action === "DISLIKE" ? "DISLIKE" : null,
    likesCount: wasLiked ? Math.max(0, likes - 1) : likes,
  };
}

/**
 * Every reply of one thread, paged through `/api/comments/[id]/replies` (public: guests read
 * replies too). Only runs once the viewer expands the thread.
 */
export function useCommentReplies(videoId: string, parentId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: commentKeys.replies(videoId, parentId),
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: String(REPLIES_PAGE_SIZE) });
      if (pageParam) params.set("cursor", pageParam);
      const res = await fetch(`/api/comments/${encodeURIComponent(parentId)}/replies?${params}`, { signal });
      return parseJsonResponse<RepliesPage>(res);
    },
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}

/**
 * The server-rendered first page as this query's starting data, when it is for exactly this video
 * and sort order (it is never used for another video).
 */
export function initialCommentsData(
  initial: InitialCommentsPage | null | undefined,
  videoId: string,
  sortBy: "newest" | "top",
): InfiniteData<CommentsPage & { viewer: any; totalCount: number }, string> | undefined {
  if (!initial || initial.videoId !== videoId || initial.sortBy !== sortBy) return undefined;
  return {
    pages: [initial.page as unknown as CommentsPage & { viewer: any; totalCount: number }],
    pageParams: [""],
  };
}

export function useComments(
  videoId: string,
  sortBy: "newest" | "top",
  language: Locale = "pl",
  userProfile?: { id?: string; name?: string | null; username?: string | null; imageUrl?: string | null } | null,
  initialComments?: InitialCommentsPage | null,
) {
  const queryClient = useQueryClient();
  const tx = useOptionalTx(language);

  const { data, fetchNextPage, hasNextPage, isLoading, isFetchingNextPage, isError, error, refetch, isPlaceholderData } =
    useInfiniteQuery({
      queryKey: [...commentKeys.list(videoId), sortBy],
      queryFn: async ({ pageParam, signal }) => {
        const url = new URL('/api/comments', window.location.origin);
        url.searchParams.set('videoId', videoId);
        url.searchParams.set('sortBy', sortBy);
        if (pageParam) url.searchParams.set('cursor', String(pageParam));
        const res = await fetch(url.toString(), { signal });
        return parseJsonResponse<CommentsPage & { viewer: any; totalCount: number }>(res);
      },
      initialPageParam: "",
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      enabled: !!videoId,
      // First page from the server render: no request and no skeleton on the first view.
      initialData: initialCommentsData(initialComments, videoId, sortBy),
      // Switching video or sort order keeps the previous list on screen (marked as stale by the
      // caller) until the new one arrives, instead of dropping back to a skeleton.
      placeholderData: keepPreviousData,
    });

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: commentKeys.list(videoId) });
    void queryClient.invalidateQueries({ queryKey: commentKeys.replies(videoId) });
  }, [queryClient, videoId]);

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
      return parseCommentPostResponse(res, tx);
    },
    onMutate: async ({ text, parentId }) => {
      await cancelCommentQueries(queryClient, videoId);
      const previousData = snapshotCaches(queryClient, videoId);
      const optimisticComment = createOptimisticComment({ videoId, text, parentId, userProfile });

      if (parentId) {
        // The header counts top-level comments only (like the server), so a reply leaves it as is.
        updateCachedComments(queryClient, videoId, (c) =>
          c.id === parentId
            ? { ...c, repliesCount: (c.repliesCount ?? 0) + 1, repliesPreview: [...(c.repliesPreview ?? []), optimisticComment] }
            : c,
        );
      } else {
        for (const [queryKey] of queryClient.getQueriesData<CommentsData>({ queryKey: commentKeys.list(videoId) })) {
          queryClient.setQueryData<CommentsData>(queryKey, (old) => {
            if (!old?.pages[0]) return old;
            const first = old.pages[0];
            const comments = String(queryKey[2]) === "newest" ? insertBelowPinned(first.comments, optimisticComment) : first.comments;
            return { ...old, pages: [{ ...first, totalCount: first.totalCount + 1, comments }, ...old.pages.slice(1)] };
          });
        }
      }

      return { previousData, optimisticId: optimisticComment.id };
    },
    onSuccess: (data, _variables, context) => {
      if (!context?.optimisticId || !data?.comment) return;
      // A comment held for review comes back without its text (only moderators see it): the author keeps seeing
      // what they wrote until the next load, when it simply is not listed until it is approved.
      updateCachedComments(queryClient, videoId, (c) =>
        c.id === context.optimisticId ? (data.comment.status === "VISIBLE" ? data.comment : { ...data.comment, text: c.text, author: c.author }) : c,
      );
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) restoreCaches(queryClient, context.previousData);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(videoId), refetchType: "inactive" });
    },
  });

  // Toggle semantics: clicking the active reaction clears it, otherwise the
  // new reaction replaces the previous one (LIKE ⇄ DISLIKE are exclusive).
  const getCommentReactionAction = useCallback((commentId: string, reaction: "LIKE" | "DISLIKE"): "LIKE" | "DISLIKE" | "CLEAR" => {
    return findCachedComment(queryClient, videoId, commentId)?.viewerReaction === reaction ? "CLEAR" : reaction;
  }, [queryClient, videoId]);

  // Requests for the same comment run one after another, so the server always ends with the
  // state of the last click (the API sets a target state, it does not toggle).
  const reactionChains = useRef(new Map<string, Promise<unknown>>());

  const likeMutation = useMutation({
    mutationKey: ["comment-reaction", videoId],
    mutationFn: async ({ commentId, action }: { commentId: string; action: "LIKE" | "DISLIKE" | "CLEAR" }) => {
      const previous = reactionChains.current.get(commentId) ?? Promise.resolve();
      const request = previous.catch(() => undefined).then(async () => {
        const res = await fetch(`/api/comments/${commentId}/reaction`, {
          method: action === "CLEAR" ? "DELETE" : "PUT",
          headers: { "Content-Type": "application/json" },
          ...(action === "CLEAR" ? {} : { body: JSON.stringify({ type: action }) }),
        });
        return parseJsonResponse<ReactionResponse>(res);
      });
      reactionChains.current.set(commentId, request);
      try {
        return await request;
      } finally {
        if (reactionChains.current.get(commentId) === request) reactionChains.current.delete(commentId);
      }
    },
    onMutate: async ({ commentId, action }) => {
      await cancelCommentQueries(queryClient, videoId);
      updateCachedComments(queryClient, videoId, (c) => (c.id === commentId ? applyReactionLocally(c, action) : c));
    },
    onSuccess: (response, { commentId }) => {
      // The answer is authoritative for this comment: write it into the cache instead of
      // refetching every loaded page.
      if (typeof response?.likesCount !== "number" || response.viewerReaction === undefined) return;
      if (reactionChains.current.has(commentId)) return; // a newer click is still on its way
      updateCachedComments(queryClient, videoId, (c) =>
        c.id === commentId ? { ...c, likesCount: response.likesCount!, viewerReaction: response.viewerReaction ?? null } : c,
      );
    },
    onError: () => {
      // Concurrent optimistic updates make a snapshot rollback unsafe; ask the server instead.
      invalidateAll();
    },
  });

  const likeMutate = useCallback((commentId: string) => {
    likeMutation.mutate({ commentId, action: getCommentReactionAction(commentId, "LIKE") });
  }, [likeMutation.mutate, getCommentReactionAction]);

  const likeMutateAsync = useCallback((commentId: string) => {
    return likeMutation.mutateAsync({ commentId, action: getCommentReactionAction(commentId, "LIKE") });
  }, [likeMutation.mutateAsync, getCommentReactionAction]);

  const dislikeMutate = useCallback((commentId: string) => {
    likeMutation.mutate({ commentId, action: getCommentReactionAction(commentId, "DISLIKE") });
  }, [likeMutation.mutate, getCommentReactionAction]);

  const dislikeMutateAsync = useCallback((commentId: string) => {
    return likeMutation.mutateAsync({ commentId, action: getCommentReactionAction(commentId, "DISLIKE") });
  }, [likeMutation.mutateAsync, getCommentReactionAction]);

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
      await cancelCommentQueries(queryClient, videoId);
      const previousData = snapshotCaches(queryClient, videoId);
      const pinnedAt = new Date().toISOString();
      // One pinned comment per video (the server unpins the previous one).
      updateCachedComments(queryClient, videoId, (c) => {
        if (c.parentId) return c;
        if (c.id === commentId) return { ...c, isPinned: pinned, pinnedAt: pinned ? pinnedAt : null };
        return pinned && c.isPinned ? { ...c, isPinned: false, pinnedAt: null } : c;
      }, (page, index) => (index === 0 ? { ...page, comments: pinnedFirst(page.comments) } : page));
      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) restoreCaches(queryClient, context.previousData);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(videoId) });
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
      await cancelCommentQueries(queryClient, videoId);
      const previousData = snapshotCaches(queryClient, videoId);
      const target = findCachedComment(queryClient, videoId, commentId);
      const isTopLevel = !target?.parentId;

      updateCachedComments(
        queryClient,
        videoId,
        (c) => {
          if (c.id === commentId) return null;
          if (target?.parentId && c.id === target.parentId) return { ...c, repliesCount: Math.max(0, (c.repliesCount ?? 0) - 1) };
          return c;
        },
        // The header counts top-level comments only.
        (page, index) => (index === 0 && isTopLevel && target ? { ...page, totalCount: Math.max(0, page.totalCount - 1) } : page),
      );

      return { previousData };
    },
    onError: (_err, _commentId, context) => {
      if (context?.previousData) restoreCaches(queryClient, context.previousData);
    },
    onSettled: () => {
      invalidateAll();
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ commentId, text }: { commentId: string; text: string }) => {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        body: JSON.stringify({ text }),
        headers: { "Content-Type": "application/json" },
      });
      return parseJsonResponse<{ comment?: CommentView }>(res);
    },
    onSuccess: (response, { commentId }) => {
      const updated = response?.comment;
      if (!updated) return invalidateAll();
      updateCachedComments(queryClient, videoId, (c) =>
        c.id === commentId ? { ...c, text: updated.text, editedAt: updated.editedAt, updatedAt: updated.updatedAt } : c,
      );
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
    /** True while the list shown is the previous video's/sort's, kept until the new one arrives. */
    isPlaceholderData,
    postMutation,
    likeMutation: { ...likeMutation, mutate: likeMutate, mutateAsync: likeMutateAsync },
    dislikeMutation: { ...likeMutation, mutate: dislikeMutate, mutateAsync: dislikeMutateAsync },
    pinMutation,
    deleteMutation,
    editMutation,
    reportMutation,
    refetch,
  };
}
