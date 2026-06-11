import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";
import { recordAuditEvent } from "@/lib/modules/audit";
import { CommentReportStatus } from "@prisma/client";
export async function resolveCommentReport(reportId: string, status: CommentReportStatus, ctx: AppContext): Promise<UseCaseResult<any, CommentError>> {
  if (ctx.actor.type !== 'admin') return fail({ type: "UNAUTHORIZED", message: "Brak uprawnień administratora." });
  const repo = new CommentRepository(ctx.prisma);
  try {
    const report = await repo.findReportById(reportId);
    if (!report) return fail({ type: "NOT_FOUND", message: "Zgłoszenie nie istnieje." });
    const updated = await repo.resolveReport(reportId, { status, resolvedAt: new Date(), resolvedById: ctx.actor.userId! });
    await recordAuditEvent(ctx, { action: `REPORT_${status}`, targetType: "COMMENT", targetId: report.commentId, metadata: { reportId, actorId: ctx.actor.userId } });
    return ok(updated);
  } catch (error: any) {
    return fail({ type: "DATABASE_ERROR", message: error.message || "Błąd bazy danych." });
  }
}
