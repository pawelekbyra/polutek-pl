import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentDto, mapCommentToDto } from "../domain/comment.dto";
import { CommentError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";
import { CommentStatus } from "@prisma/client";

export interface ListAdminCommentsInput {
  q?: string;
  status?: CommentStatus;
  limit: number;
}

export async function listAdminComments(
  input: ListAdminCommentsInput,
  ctx: AppContext
): Promise<UseCaseResult<CommentDto[], CommentError>> {
  const { q, status, limit } = input;
  const { actor, prisma } = ctx;

  if (actor.type !== 'admin') {
    return fail({ type: "FORBIDDEN", message: "Brak uprawnień administratora." });
  }

  const userId = actor.userId;
  const repo = new CommentRepository(prisma);

  const comments = await repo.findAdminComments({ q, status, limit });

  const context = { userId, canModerate: true, videoCreatorId: null, hasVideoAccess: true };
  const mappedComments = comments.map(c => mapCommentToDto(c, context));

  return ok(mappedComments);
}
