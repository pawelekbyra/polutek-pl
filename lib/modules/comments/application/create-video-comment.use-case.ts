import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentDto, mapCommentToDto } from "../domain/comment.dto";
import { CommentError } from "../domain/comment.errors";
import { CommentPolicy } from "../domain/comment.policy";
import { CommentRepository } from "../infrastructure/comment.repository";
import { checkVideoAccess } from "@/lib/modules/access";
import { recordAuditEvent } from "@/lib/modules/audit";
import { isUuid } from "@/lib/utils/uuid";
import { countGraphemes } from "@/lib/utils/graphemes";
import { PrismaClient } from "@prisma/client";

export interface CreateVideoCommentInput {
  videoId: string;
  text: string;
  parentId?: string | null;
  imageUrl?: string | null;
}

export async function createVideoComment(
  input: CreateVideoCommentInput,
  ctx: AppContext
): Promise<UseCaseResult<CommentDto, CommentError>> {
  const { videoId, text, parentId, imageUrl } = input;
  const { actor, prisma } = ctx;

  if (actor.type === 'guest' || actor.type === 'system') {
    return fail({ type: "UNAUTHORIZED", message: "Musisz być zalogowany, aby dodać komentarz." });
  }

  const userId = actor.userId;

  // 1. Resolve videoId if it's a slug
  let resolvedVideoId = videoId;
  if (!isUuid(videoId)) {
    const video = await prisma.video.findUnique({ where: { slug: videoId }, select: { id: true } });
    if (!video) return fail({ type: "NOT_FOUND", message: "Film nie istnieje." });
    resolvedVideoId = video.id;
  }

  // 2. Access Check
  const accessResult = await checkVideoAccess({ videoIdOrSlug: resolvedVideoId }, ctx);
  if (!accessResult.ok) {
     return fail({ type: "DATABASE_ERROR", message: "Błąd podczas sprawdzania dostępu." });
  }

  if (!CommentPolicy.canCreateComment(actor, accessResult.data)) {
    // If not found, return NOT_FOUND to avoid leaking existence
    if (accessResult.data.reason === 'NOT_FOUND' || accessResult.data.reason === 'DELETED') {
        return fail({ type: "NOT_FOUND", message: "Film nie istnieje." });
    }
    return fail({
        type: "FORBIDDEN",
        message: accessResult.data.reason === "PATRON_REQUIRED"
            ? "Ten film jest dostępny tylko dla Patronów."
            : "Brak uprawnień do komentowania."
    });
  }

  // 3. Validation
  if (countGraphemes(text) > 2000) {
    return fail({ type: "VALIDATION_ERROR", message: "Komentarz jest za długi (max 2000 znaków)." });
  }

  const repo = new CommentRepository(prisma);

  try {
    const video = await prisma.video.findUnique({
      where: { id: resolvedVideoId },
      select: { creatorId: true, creator: { select: { userId: true } } }
    });
    if (!video) return fail({ type: "NOT_FOUND", message: "Film nie istnieje." });

    const videoCreatorId = video.creator?.userId || null;

    let finalParentId = parentId || null;
    if (parentId) {
      const parent = await repo.findCommentById(parentId);
      if (!parent || parent.videoId !== resolvedVideoId) {
        return fail({ type: "VALIDATION_ERROR", message: "Nieprawidłowy komentarz nadrzędny." });
      }
      // Enforce one-level nesting: if parent is a reply, attach to its parent instead
      if (parent.parentId) {
        finalParentId = parent.parentId;
      }
    }

    const newComment = await (prisma as PrismaClient).$transaction(async (tx) => {
      const txRepo = new CommentRepository(tx);
      const comment = await txRepo.create({
        authorId: userId,
        videoId: resolvedVideoId,
        creatorId: video.creatorId,
        text,
        parentId: finalParentId,
        imageUrl
      });

      if (finalParentId) {
        await txRepo.incrementRepliesCount(finalParentId);
      }

      return comment;
    });

    await recordAuditEvent(ctx, {
      action: "COMMENT_CREATE",
      targetType: "COMMENT",
      targetId: newComment.id,
      metadata: { videoId: resolvedVideoId, parentId: finalParentId }
    });

    // We need to fetch author details for DTO
    const commentWithAuthor = await repo.findCommentById(newComment.id);

    // Global admin or creator of the video can moderate.
    const canModerate = actor.type === 'admin' || videoCreatorId === userId;
    const context = { userId, canModerate, videoCreatorId };

    return ok(mapCommentToDto(commentWithAuthor, context));
  } catch (error: any) {
    return fail({ type: "DATABASE_ERROR", message: error.message || "Błąd bazy danych." });
  }
}
