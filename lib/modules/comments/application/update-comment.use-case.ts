import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentDto, mapCommentToDto } from "../domain/comment.dto";
import { CommentError } from "../domain/comment.errors";
import { CommentPolicy } from "../domain/comment.policy";
import { CommentRepository } from "../infrastructure/comment.repository";
import { checkVideoAccess } from "@/lib/modules/access";
import { countGraphemes } from "@/lib/utils/graphemes";
import { CommentStatus } from "@prisma/client";

export interface UpdateCommentInput {
  commentId: string;
  text: string;
}

export async function updateComment(
  input: UpdateCommentInput,
  ctx: AppContext
): Promise<UseCaseResult<CommentDto, CommentError>> {
  const { commentId, text } = input;
  const { actor, prisma } = ctx;

  if (actor.type === 'guest' || actor.type === 'system') {
    return fail({ type: "UNAUTHORIZED", message: "Musisz być zalogowany, aby edytować komentarz." });
  }

  const userId = actor.userId;
  const repo = new CommentRepository(prisma);

  const comment = await repo.findCommentById(commentId);
  if (!comment) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });

  // 0. Access Check (inheritance)
  const accessResult = await checkVideoAccess({ videoIdOrSlug: comment.videoId }, ctx);
  if (!accessResult.ok) {
     return fail({ type: "DATABASE_ERROR", message: "Błąd podczas sprawdzania dostępu." });
  }
  if (!accessResult.data.hasAccess) {
    return fail({
        type: "FORBIDDEN",
        message: accessResult.data.reason === "PATRON_REQUIRED"
            ? "Ten film jest dostępny tylko dla Patronów."
            : "Brak dostępu."
    });
  }

  // 1. Authorization check
  if (!CommentPolicy.canUpdateComment(actor, comment.authorId)) {
    return fail({ type: "FORBIDDEN", message: "Nie masz uprawnień do edycji tego komentarza." });
  }

  // 2. Invariant check: Cannot edit moderated or deleted comments
  if (comment.status !== CommentStatus.VISIBLE) {
      return fail({ type: "VALIDATION_ERROR", message: "Nie można edytować moderowanych lub usuniętych komentarzy." });
  }

  // 3. Validation
  if (countGraphemes(text) > 2000) {
    return fail({ type: "VALIDATION_ERROR", message: "Komentarz jest za długi (max 2000 znaków)." });
  }

  try {
    await repo.update(commentId, {
        text,
        editedAt: new Date()
    });

    const videoCreatorId = await repo.findVideoCreatorId(comment.videoId);
    const canModerate = actor.type === 'admin' || videoCreatorId === userId;
    const context = { userId, canModerate, videoCreatorId, hasVideoAccess: accessResult.data.hasAccess };

    // Need full author details for DTO
    const fullComment = await repo.findCommentById(commentId);

    return ok(mapCommentToDto(fullComment, context));
  } catch (error: any) {
    return fail({ type: "DATABASE_ERROR", message: error.message || "Błąd bazy danych." });
  }
}
