import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult } from "@/lib/modules/shared/result";
import { CommentError } from "../domain/comment.errors";
import { moderateCommentStatus } from "./moderate-comment-status";

/** Brings back a comment moderation hid or held. Deleted comments cannot be restored (CONFLICT). */
export async function restoreAdminComment(commentId: string, ctx: AppContext): Promise<UseCaseResult<void, CommentError>> {
  return moderateCommentStatus(commentId, "restore", ctx);
}
