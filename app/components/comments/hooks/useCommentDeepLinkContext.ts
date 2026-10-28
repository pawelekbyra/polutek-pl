"use client";
import { useEffect, useState } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import type { CommentView } from "../types";
import { clearCommentDeepLink, pendingCommentDeepLink, requestCommentDeepLink } from "../deep-link";
import { useCommentDeepLinkRevision } from "../useCommentDeepLinkRevision";
import { commentKeys } from "./useComments";

type Page = { comments: CommentView[] };
type Context = { comment: CommentView; parentComment: CommentView | null; videoId: string };

/** Include exactly the target thread, with its reply visible, without scanning every comment page. */
export function includeCommentContext<T extends Page>(data: InfiniteData<T> | undefined, context: Context): InfiniteData<T> | undefined {
  if (!data?.pages.length) return data;
  const root = context.parentComment ?? context.comment;
  const existing = data.pages.flatMap((page) => page.comments).find((comment) => comment.id === root.id) ?? root;
  const thread = context.parentComment ? { ...existing, repliesPreview: [...(existing.repliesPreview ?? []).filter((reply) => reply.id !== context.comment.id), context.comment] } : existing;
  let found = false;
  const pages = data.pages.map((page) => ({ ...page, comments: page.comments.map((comment) => { if (comment.id !== root.id) return comment; found = true; return thread; }) }));
  if (!found) pages[0] = { ...pages[0], comments: [thread, ...pages[0].comments] };
  return { ...data, pages };
}

export function uniqueComments(comments: CommentView[]): CommentView[] {
  const seen = new Set<string>();
  return comments.filter((comment) => { if (seen.has(comment.id)) return false; seen.add(comment.id); return true; });
}

export function useCommentDeepLinkContext(videoId: string, sortBy: "newest" | "top", ready: boolean) {
  const revision = useCommentDeepLinkRevision();
  const client = useQueryClient();
  const [error, setError] = useState<{ target: string; kind: "missing" | "network" } | null>(null);
  useEffect(() => {
    setError(null);
    const target = pendingCommentDeepLink();
    if (!ready || !target || document.getElementById(`comment-${target}`)) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/comments/${encodeURIComponent(target)}/context`, { cache: "no-store", signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!response.ok) {
          if (response.status === 404 || response.status === 403 || response.status === 401) {
            clearCommentDeepLink();
            setError({ target, kind: "missing" });
            return;
          }
          throw new Error("Context unavailable");
        }
        const context = await response.json() as Context;
        if (controller.signal.aborted) return;
        // A router/shallow switch may still be replacing the previous video when the request starts.
        if (context.videoId !== videoId) return;
        if (context.comment.id !== target || (context.comment.parentId && !context.parentComment)) {
          clearCommentDeepLink();
          setError({ target, kind: "missing" });
          return;
        }
        client.setQueryData<InfiniteData<Page>>([...commentKeys.list(videoId), sortBy], (data) => includeCommentContext(data, context));
      } catch {
        if (!controller.signal.aborted) setError({ target, kind: "network" });
      }
    })();
    return () => controller.abort();
  }, [videoId, sortBy, ready, revision, client]);
  return { error, retry: () => { if (error) requestCommentDeepLink(error.target); } };
}
