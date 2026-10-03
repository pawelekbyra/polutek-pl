import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult } from "@/lib/modules/shared/result";
import { CommentError } from "../domain/comment.errors";
import { moderateCommentStatus } from "./moderate-comment-status";

export async function hideAdminComment(commentId: string, ctx: AppContext): Promise<UseCaseResult<void, CommentError>> {
  return moderateCommentStatus(commentId, "hide", ctx);
}
