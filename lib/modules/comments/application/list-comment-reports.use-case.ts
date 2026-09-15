import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentError } from "../domain/comment.errors";
import { CommentRepository, CommentReportWithRelations } from "../infrastructure/comment.repository";
import { CommentReportStatus } from "@prisma/client";

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
    return ok({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error: any) {
    return fail({ type: "DATABASE_ERROR", message: error.message || "Błąd bazy danych." });
  }
}
