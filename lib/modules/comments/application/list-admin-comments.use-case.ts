import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentDto, mapCommentToDto } from "../domain/comment.dto";
import { CommentError } from "../domain/comment.errors";
import { CommentRepository } from "../infrastructure/comment.repository";
import { CommentStatus } from "@prisma/client";

export interface ListAdminCommentsInput {
  q?: string;
  status?: CommentStatus;
  videoId?: string;
  page?: number;
  pageSize?: number;
}

export interface ListAdminCommentsResult {
  items: CommentDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listAdminComments(
  input: ListAdminCommentsInput,
  ctx: AppContext
): Promise<UseCaseResult<ListAdminCommentsResult, CommentError>> {
  const { q, status, videoId } = input;
  const page = Math.max(1, input.page || 1);
  const pageSize = Math.max(1, Math.min(100, input.pageSize || 50));
  const { actor, prisma } = ctx;

  if (actor.type !== 'admin') {
    return fail({ type: "FORBIDDEN", message: "Brak uprawnień administratora." });
  }

  const userId = actor.userId;
  const repo = new CommentRepository(prisma);

  const { items, total } = await repo.findAdminComments({ q, status, videoId, page, pageSize });

  const context = { userId, canModerate: true, videoCreatorId: null, hasVideoAccess: true };
  const mappedComments = items.map(c => mapCommentToDto(c, context));

  return ok({ items: mappedComments, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
