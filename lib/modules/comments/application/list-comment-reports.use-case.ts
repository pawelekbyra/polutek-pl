import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentRepository, CommentReportWithRelations } from "../infrastructure/comment.repository";
import { CommentReportStatus } from "@prisma/client";
import { canSeeCommentContent } from "../domain/comment.dto";

export interface ListCommentReportsInput {
  status?: CommentReportStatus;
  page?: number;
  pageSize?: number;
}

export interface ListCommentReportsResult {
  items: CommentReportWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listCommentReports(
  input: CommentReportStatus | undefined | ListCommentReportsInput,
  ctx: AppContext,
): Promise<UseCaseResult<ListCommentReportsResult, CommentError>> {
  if (ctx.actor.type !== 'admin') return fail({ type: "UNAUTHORIZED", message: "Brak uprawnień administratora." });

  // Back-compat: callers/tests may still pass a bare status enum (or undefined) as the first arg.
  const normalized: ListCommentReportsInput =
    typeof input === 'object' && input !== null ? input : { status: input };

  const page = Math.max(1, normalized.page || 1);
  const pageSize = Math.max(1, Math.min(100, normalized.pageSize || 20));

  try {
    const { items, total } = await new CommentRepository(ctx.prisma).findReports({
      status: normalized.status,
      page,
      pageSize,
    });
    // Same rule as the admin comment list: what an author deleted themselves is not shown again.
    const masked = items.map((report) =>
      !report.comment || canSeeCommentContent(report.comment, { canModerate: true, revealDeletedContent: true })
        ? report
        : { ...report, comment: { ...report.comment, text: "" } },
    );
    return ok({ items: masked, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_REPORTS_LIST_ERROR", error));
  }
}
