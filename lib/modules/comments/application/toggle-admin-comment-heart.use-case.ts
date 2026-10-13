import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { WriteTx } from "@/lib/modules/shared/db";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";
import { recordAuditEvent } from "@/lib/modules/audit";
import { CommentStatus } from "@prisma/client";
import { authorizeComments } from "./authorize-comments";

export async function toggleAdminCommentHeart(commentId: string, ctx: AppContext): Promise<UseCaseResult<{ isHearted: boolean }, CommentError>> {
  const denied = await authorizeComments(ctx, "comment.heart", [commentId]);
  if (denied) return fail(denied);
  try {
    const comment = await new CommentRepository(ctx.prisma).findCommentById(commentId);
    if (!comment) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });
    if (comment.status === CommentStatus.DELETED) return fail({ type: "CONFLICT", message: "Usuniętemu komentarzowi nie można dać serca." });
    const isHearted = !comment.isHearted;
    await ctx.db.writeTransaction(async (tx: WriteTx) => {
      await new CommentRepository(tx).setHeart(commentId, isHearted);
      await recordAuditEvent(ctx, { action: isHearted ? "COMMENT_HEART" : "COMMENT_UNHEART", targetType: "COMMENT", targetId: commentId }, tx);
    });
    return ok({ isHearted });
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_HEART_ERROR", error));
  }
}
