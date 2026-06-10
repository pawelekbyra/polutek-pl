import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentError } from "../domain/comment.errors";
import { CommentPolicy } from "../domain/comment.policy";
import { CommentRepository } from "../infrastructure/comment.repository";
import { checkVideoAccess } from "@/lib/modules/access";
import { recordAuditEvent } from "@/lib/modules/audit";
import { CommentStatus, CommentReportReason, PrismaClient } from "@prisma/client";

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

  const comment = await repo.findCommentById(commentId);
  if (!comment) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });

  if (comment.status === CommentStatus.DELETED) {
      return fail({ type: "VALIDATION_ERROR", message: "Nie można zgłosić usuniętego komentarza." });
  }
  if (comment.authorId === userId) {
      return fail({ type: "VALIDATION_ERROR", message: "Nie możesz zgłosić własnego komentarza." });
  }

  // 1. Access Check for the video the comment belongs to
  const accessResult = await checkVideoAccess({ videoIdOrSlug: comment.videoId }, ctx);
  if (!accessResult.ok) {
     return fail({ type: "DATABASE_ERROR", message: "Błąd podczas sprawdzania dostępu." });
  }

  // To report, you must have access to view the video (inheritance)
  if (!CommentPolicy.canReportComment(actor, accessResult.data)) {
      return fail({
          type: "FORBIDDEN",
          message: accessResult.data.reason === "PATRON_REQUIRED"
            ? "Zgłaszanie komentarzy pod tym filmem jest dostępne tylko dla Patronów."
            : "Brak dostępu do zgłaszania komentarzy pod tym filmem."
      });
  }

  try {
    const existing = await (prisma as PrismaClient).commentReport.findUnique({
      where: { commentId_reporterId: { commentId, reporterId: userId } }
    });

    if (existing) return ok(undefined);

    await (prisma as PrismaClient).$transaction(async (tx) => {
      await tx.commentReport.create({
        data: { commentId, reporterId: userId, reason, note }
      });
      await tx.comment.update({
        where: { id: commentId },
        data: { reportsCount: { increment: 1 } }
      });
    });

    await recordAuditEvent(ctx, {
      action: "COMMENT_REPORT",
      targetType: "COMMENT",
      targetId: commentId,
      metadata: { reason, note }
    });

    return ok(undefined);
  } catch (error: any) {
    return fail({ type: "DATABASE_ERROR", message: error.message || "Błąd bazy danych." });
  }
}
