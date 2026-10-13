import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { WriteTx } from "@/lib/modules/shared/db";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";
import { recordAuditEvent } from "@/lib/modules/audit";
import { CommentReportStatus } from "@prisma/client";
import { authorizeReport, moderatorId } from "./authorize-comments";

/** Closes a report. The comment's `reportsCount` is recomputed from the reports still pending. */
export async function resolveCommentReport(reportId: string, status: CommentReportStatus, ctx: AppContext): Promise<UseCaseResult<{ id: string; status: CommentReportStatus }, CommentError>> {
  const denied = await authorizeReport(ctx, "comment.moderate", reportId);
  if (denied) return fail(denied);
  if (status === CommentReportStatus.PENDING) return fail({ type: "VALIDATION_ERROR", message: "Zgłoszenie można tylko oddalić albo uznać." });
  const actorId = moderatorId(ctx);
  try {
    const report = await new CommentRepository(ctx.prisma).findReportById(reportId);
    if (!report) return fail({ type: "NOT_FOUND", message: "Zgłoszenie nie istnieje." });
    const updated = await ctx.db.writeTransaction(async (tx: WriteTx) => {
      const txRepo = new CommentRepository(tx);
      const resolved = await txRepo.resolveReport(reportId, { status, resolvedAt: ctx.now(), resolvedById: actorId });
      await txRepo.refreshPendingReportsCount(report.commentId);
      await recordAuditEvent(ctx, { action: `REPORT_${status}`, targetType: "COMMENT", targetId: report.commentId, metadata: { reportId } }, tx);
      return resolved;
    });
    return ok({ id: updated.id, status: updated.status });
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_REPORT_RESOLVE_ERROR", error));
  }
}
