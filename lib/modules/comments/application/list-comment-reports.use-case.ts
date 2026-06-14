import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";
import { CommentReportStatus } from "@prisma/client";
export async function listCommentReports(status: CommentReportStatus | undefined, ctx: AppContext): Promise<UseCaseResult<
Array<
any>, CommentError>> {
  if (ctx.actor.type !== 'admin') return fail({ type: "UNAUTHORIZED", message: "Brak uprawnień administratora." });
  try {
    const reports = await new CommentRepository(ctx.prisma).findReports(status);
    return ok(reports);
  } catch (error:
any) {
    return fail({ type: "DATABASE_ERROR", message: error.message || "Błąd bazy danych." });
  }
}
