import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { WriteTx } from "@/lib/modules/shared/db";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentPolicy } from "../domain/comment.policy";
import { CommentRepository } from "../infrastructure/comment.repository";
import { checkVideoAccess } from "@/lib/modules/access";
import { recordAuditEventSafe } from "@/lib/modules/audit";
import { CommentStatus, CommentReportReason } from "@prisma/client";

/** Pending reports from distinct users after which a regular viewer's comment waits for review. */
export const REPORT_HOLD_THRESHOLD = 3;

export interface ReportCommentInput {
  commentId: string;
  reason: CommentReportReason;
  note?: string;
}

export async function reportComment(
  input: ReportCommentInput,
  ctx: AppContext
): Promise<UseCaseResult<void, CommentError>> {
  const { commentId, reason, note } = input;
  const { actor, prisma } = ctx;

  if (actor.type === 'guest' || actor.type === 'system') {
    return fail({ type: "UNAUTHORIZED", message: "Musisz być zalogowany, aby zgłosić komentarz." });
  }

  const userId = actor.userId;
  const repo = new CommentRepository(prisma);

  try {
    const comment = await repo.findCommentById(commentId);
    if (!comment || comment.author?.isDeleted) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });

    if (comment.status === CommentStatus.DELETED) {
      return fail({ type: "CONFLICT", message: "Nie można zgłosić usuniętego komentarza." });
    }
    if (comment.authorId === userId) {
      return fail({ type: "VALIDATION_ERROR", message: "Nie możesz zgłosić własnego komentarza." });
    }

    const accessResult = await checkVideoAccess({ videoIdOrSlug: comment.videoId }, ctx);
    if (!accessResult.ok) return fail(commentDatabaseError("COMMENT_REPORT_ACCESS_ERROR", accessResult.error));
    if (!CommentPolicy.canReportComment(actor, accessResult.data)) {
      return fail({ type: "FORBIDDEN", message: "Brak dostępu do zgłaszania komentarzy pod tym filmem." });
    }

    // The channel's own voices (admins, the video's creator) are never hidden automatically;
    // their reports still land in the moderation queue.
    const videoCreatorId = await repo.findVideoCreatorId(comment.videoId);
    const authorIsProtected = comment.author?.role === "ADMIN" || comment.authorId === videoCreatorId;

    const created = await ctx.db.writeTransaction(async (tx: WriteTx) => {
      const txRepo = new CommentRepository(tx);
      // Reports of one comment are written and counted one at a time (audit W18).
      await txRepo.lockCommentForReports(commentId);
      // One report per user and comment (unique constraint); a repeated report is a no-op.
      if (!(await txRepo.createReport({ commentId, reporterId: userId, reason, note }))) return false;

      const pending = await txRepo.refreshPendingReportsCount(commentId);
      // The conditional transition (only from VISIBLE) keeps a comment a moderator already decided on untouched.
      if (pending >= REPORT_HOLD_THRESHOLD && !authorIsProtected) {
        await txRepo.transitionStatus(commentId, [CommentStatus.VISIBLE], {
          status: CommentStatus.HELD_FOR_REVIEW,
          moderatedAt: ctx.now(),
          moderatedById: null,
        });
      }
      return true;
    });

    if (created) {
      // Ids and the reason only; the free-text note stays in the report itself.
      await recordAuditEventSafe(ctx, {
        action: "COMMENT_REPORT",
        targetType: "COMMENT",
        targetId: commentId,
        metadata: { reason },
      });
    }

    return ok(undefined);
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_REPORT_ERROR", error));
  }
}
