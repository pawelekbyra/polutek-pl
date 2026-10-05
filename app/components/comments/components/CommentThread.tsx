"use client";

import React, { useMemo, useState } from "react";
import { Loader2 } from "../../icons";
import { CommentItem } from "./CommentItem";
import { useCommentReplies } from "../hooks/useComments";
import type { CommentView } from "../types";
import type { CommentReportReasonDto } from "@/lib/modules/comments/domain/comment-frontend.dto";
import type { Locale } from "@/lib/i18n/routing";
import type { Tx } from "@/lib/i18n/ui";
import { useOptionalTx } from "@/lib/i18n/language-context";

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
}

function moreRepliesLabel(count: number, tx: Tx) {
  if (count <= 0) return tx("Pokaż więcej odpowiedzi", "Show more replies");
  if (count === 1) return tx("Pokaż jeszcze 1 odpowiedź", "Show 1 more reply");
  return tx("Pokaż jeszcze {0} odpowiedzi", "Show {0} more replies", count);
}

const noop = () => {};

/**
 * One top-level comment with its whole thread. The list response embeds the first replies;
 * "show more" pages through the rest via `/api/comments/[id]/replies`, so no reply is ever
 * cut off. Replies sit in the parent's text column (52 px = 40 px avatar + 12 px gap).
 */
function CommentThreadComponent({ videoId, comment, isReactionPending, onReply, onPin, ...shared }: CommentThreadProps) {
  const tx = useOptionalTx(shared.language);
  const [expanded, setExpanded] = useState(false);
  const repliesQuery = useCommentReplies(videoId, comment.id, expanded);
  const replies = useMemo(() => {
    const preview = comment.repliesPreview ?? [];
    const loaded = repliesQuery.data?.pages.flatMap((page) => page.replies) ?? [];
    if (!expanded || loaded.length === 0) return preview;
    // Replies posted after the thread was loaded live in the preview until the next refetch.
    const loadedIds = new Set(loaded.map((reply) => reply.id));
    return [...loaded, ...preview.filter((reply) => !loadedIds.has(reply.id))];
  }, [expanded, repliesQuery.data, comment.repliesPreview]);

  const remaining = Math.max(0, comment.repliesCount - replies.length);
  const canShowMore = expanded ? !!repliesQuery.hasNextPage || (repliesQuery.isError && remaining > 0) : remaining > 0;
  const isLoadingReplies = expanded && (repliesQuery.isPending || repliesQuery.isFetchingNextPage);

  const showMore = () => {
    if (!expanded) setExpanded(true);
    else if (repliesQuery.isError) void repliesQuery.refetch();
    else void repliesQuery.fetchNextPage();
  };

  return (
    <div>
      <CommentItem
        comment={comment}
        onReply={onReply}
        onPin={onPin}
        isReactionPending={isReactionPending(comment.id)}
        {...shared}
      />

      {(replies.length > 0 || canShowMore) && (
        <div className="mt-2 flex flex-col gap-3 pl-[52px]">
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
  );
}

export const CommentThread = React.memo(CommentThreadComponent);
