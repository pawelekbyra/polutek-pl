"use client";

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Loader2 } from "../../icons";
import { ChevronDownIcon, ChevronUpIcon } from "../../icons/MarkerUiIcons";
import { CommentItem } from "./CommentItem";
import { useCommentReplies } from "../hooks/useComments";
import { pendingCommentDeepLink } from "../deep-link";
import { useCommentDeepLinkRevision } from "../useCommentDeepLinkRevision";
import type { CommentView } from "../types";
import type { CommentReportReasonDto } from "@/lib/modules/comments/domain/comment-frontend.dto";
import type { Locale } from "@/lib/i18n/routing";
import type { Tx } from "@/lib/i18n/ui";
import { useOptionalTx } from "@/lib/i18n/language-context";
import { countedNoun } from "@/lib/i18n/plurals";

interface CommentThreadProps {
  videoId: string;
  comment: CommentView;
  userProfile: { id?: string } | null;
  language: Locale;
  t: Record<string, string>;
  canComment: boolean;
  onLike: (id: string) => void;
  onDislike: (id: string) => void;
  onReply: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onEdit: (id: string, text: string) => Promise<void>;
  onReport: (id: string, reason: CommentReportReasonDto, note?: string) => Promise<void>;
  isReactionPending: (id: string) => boolean;
  /** Bumped by the list each time the viewer posts a reply to this comment: the thread opens to show it. */
  openRequest?: number;
}

function moreRepliesLabel(count: number, tx: Tx) {
  if (count <= 0) return tx("Pokaż więcej odpowiedzi", "Show more replies");
  if (count === 1) return tx("Pokaż jeszcze 1 odpowiedź", "Show 1 more reply");
  return tx("Pokaż jeszcze {0} odpowiedzi", "Show {0} more replies", count);
}

const noop = () => {};

/**
 * One top-level comment with its whole thread. Replies start collapsed behind a "Show N replies" button (as on YouTube
 * or Reddit); the open state lives only in this component. A thread opens by itself when the address points at one of
 * its replies (notification link) and when the viewer has just posted a reply to it. The list response embeds the
 * first replies; "show more" pages through the rest via `/api/comments/[id]/replies`, so no reply is ever cut off.
 * Replies sit in the parent's text column (52 px = 40 px avatar + 12 px gap).
 */
function CommentThreadComponent({ videoId, comment, isReactionPending, onReply, onPin, openRequest = 0, ...shared }: CommentThreadProps) {
  const tx = useOptionalTx(shared.language);
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  // The replies mount on the first opening and stay mounted, so closing can animate (and reopening is instant).
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const panelId = useId();
  const deepLinkRevision = useCommentDeepLinkRevision();
  const repliesQuery = useCommentReplies(videoId, comment.id, expanded);
  const replies = useMemo(() => {
    const preview = comment.repliesPreview ?? [];
    const loaded = repliesQuery.data?.pages.flatMap((page) => page.replies) ?? [];
    if (!expanded || loaded.length === 0) return preview;
    // Replies posted after the thread was loaded live in the preview until the next refetch.
    const loadedIds = new Set(loaded.map((reply) => reply.id));
    return [...loaded, ...preview.filter((reply) => !loadedIds.has(reply.id))];
  }, [expanded, repliesQuery.data, comment.repliesPreview]);

  const openThread = useCallback(() => {
    setMounted(true);
    setOpen(true);
  }, []);

  // A link to one of the replies (the address, or a notification) opens the thread that holds it. The pending link
  // lives outside React (deep-link.ts), so this is a sync from that store.
  const previewIds = (comment.repliesPreview ?? []).map((reply) => reply.id).join(",");
  useEffect(() => {
    const target = pendingCommentDeepLink();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with the external deep-link store
    if (target && target !== comment.id && previewIds.split(",").includes(target)) openThread();
  }, [comment.id, previewIds, deepLinkRevision, openThread]);

  // The viewer has just answered this comment (adjusting state while rendering, on a changed request number).
  const [seenRequest, setSeenRequest] = useState(0);
  if (openRequest !== seenRequest) {
    setSeenRequest(openRequest);
    if (openRequest > 0) {
      setMounted(true);
      setOpen(true);
    }
  }

  // Two frames after the first opening: the collapsed state is painted first, so opening is a transition, not a jump.
  // (Afterwards the replies stay mounted and `open` alone drives the transition.)
  useEffect(() => {
    if (!open) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [open]);

  const totalReplies = Math.max(comment.repliesCount, replies.length);
  const hasReplies = totalReplies > 0;
  const remaining = Math.max(0, comment.repliesCount - replies.length);
  const canShowMore = expanded ? !!repliesQuery.hasNextPage || (repliesQuery.isError && remaining > 0) : remaining > 0;
  const isLoadingReplies = expanded && (repliesQuery.isPending || repliesQuery.isFetchingNextPage);

  const showMore = () => {
    if (!expanded) setExpanded(true);
    else if (repliesQuery.isError) void repliesQuery.refetch();
    else void repliesQuery.fetchNextPage();
  };

  const visible = open && entered;

  return (
    <div>
      <CommentItem
        comment={comment}
        onReply={onReply}
        onPin={onPin}
        isReactionPending={isReactionPending(comment.id)}
        {...shared}
      />

      {hasReplies && (
        <div className="mt-0.5 pl-[52px]">
          <button
            type="button"
            onClick={() => (open ? setOpen(false) : openThread())}
            aria-expanded={open}
            aria-controls={panelId}
            className="-ml-2 inline-flex h-8 items-center gap-1 rounded-full px-2 text-[13px] font-semibold text-[var(--chan-blue)] transition-colors hover:bg-[var(--chan-blue-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] motion-reduce:transition-none"
          >
            {open ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
            {open
              ? tx("Ukryj odpowiedzi", "Hide replies")
              : tx("Pokaż {0} {1}", "Show {0} {1}", totalReplies, countedNoun(shared.language, "replies", totalReplies))}
          </button>
        </div>
      )}

      <div
        id={panelId}
        inert={!open}
        className="grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: visible ? "1fr" : "0fr", opacity: visible ? 1 : 0 }}
      >
        {/* -mx-2/px-2: room for the highlight of a linked reply, which reaches 8 px past the column. */}
        <div className="-mx-2 min-h-0 overflow-hidden px-2">
          {mounted && (replies.length > 0 || canShowMore) && (
            <div className="flex flex-col gap-3 pb-0.5 pl-[52px] pt-2">
              {replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  onReply={noop}
                  onPin={noop}
                  isReactionPending={isReactionPending(reply.id)}
                  isReply
                  {...shared}
                />
              ))}

              {repliesQuery.isError && expanded && (
                <p role="alert" className="text-[13px] text-[var(--chan-muted)]">
                  {tx("Nie udało się wczytać odpowiedzi.", "Could not load the replies.")}
                </p>
              )}

              {(canShowMore || isLoadingReplies) && (
                <div>
                  <button
                    type="button"
                    onClick={showMore}
                    disabled={isLoadingReplies}
                    className="-ml-2 inline-flex h-8 items-center gap-2 rounded-full px-2 text-[13px] font-semibold text-[var(--chan-blue)] transition-colors hover:bg-[var(--chan-blue-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none"
                  >
                    {isLoadingReplies ? (
                      <>
                        <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                        {tx("Wczytywanie odpowiedzi…", "Loading replies…")}
                      </>
                    ) : repliesQuery.isError ? (
                      tx("Spróbuj ponownie", "Try again")
                    ) : (
                      moreRepliesLabel(remaining, tx)
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const CommentThread = React.memo(CommentThreadComponent);
