import { AppContext } from "@/lib/modules/shared/app-context";
import { canModerateVideoComments } from "./authorize-comments";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentDto, mapCommentToDto } from "../domain/comment.dto";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentPolicy } from "../domain/comment.policy";
import { CommentRepository } from "../infrastructure/comment.repository";
import { checkVideoAccess } from "@/lib/modules/access";
import { recordAuditEventSafe } from "@/lib/modules/audit";
import { isUuid } from "@/lib/utils/uuid";
import { countGraphemes } from "@/lib/utils/graphemes";
import { CommentStatus } from "@prisma/client";
import { channelBanError, commentMuteError } from "./comment-write-guard";
import { notifyCommentReply } from "./comment-notifications";

export interface CreateVideoCommentInput {
  videoId: string;
  text: string;
  parentId?: string | null;
}

const INVALID_PARENT: CommentError = { type: "VALIDATION_ERROR", message: "Nie można odpowiedzieć na ten komentarz." };

export async function createVideoComment(
  input: CreateVideoCommentInput,
  ctx: AppContext
): Promise<UseCaseResult<CommentDto, CommentError>> {
  const { videoId, text, parentId } = input;
  const { actor, prisma } = ctx;

  if (actor.type === 'guest' || actor.type === 'system') {
    return fail({ type: "UNAUTHORIZED", message: "Musisz być zalogowany, aby dodać komentarz." });
  }

  if (CommentPolicy.isOnboardingPending(actor)) {
    return fail({
      type: "FORBIDDEN",
      code: "ONBOARDING_REQUIRED",
      message: "Najpierw wybierz pseudonim w oknie powitalnym, potem możesz komentować.",
    });
  }

  const userId = actor.userId;

  try {
    // 0. Moderation mute (admin panel): the account may read and react but not write until the date passes.
    const muted = await commentMuteError(ctx, userId);
    if (muted) return fail(muted);

    // 1. Resolve videoId if it's a slug
    let resolvedVideoId = videoId;
    if (!isUuid(videoId)) {
      const video = await prisma.video.findUnique({ where: { slug: videoId }, select: { id: true } });
      if (!video) return fail({ type: "NOT_FOUND", message: "Film nie istnieje." });
      resolvedVideoId = video.id;
    }

    // 2. Access Check
    const accessResult = await checkVideoAccess({ videoIdOrSlug: resolvedVideoId }, ctx);
    if (!accessResult.ok) return fail(commentDatabaseError("COMMENT_CREATE_ACCESS_ERROR", accessResult.error));

    if (!CommentPolicy.canCreateComment(actor, accessResult.data)) {
      // If not found, return NOT_FOUND to avoid leaking existence
      if (accessResult.data.reason === 'NOT_FOUND' || accessResult.data.reason === 'DELETED') {
        return fail({ type: "NOT_FOUND", message: "Film nie istnieje." });
      }
      // patron zone (docs/architecture/patron-zone.md): the composer says "become a patron to comment".
      if (accessResult.data.reason === 'PASS_REQUIRED') return fail({ type: "FORBIDDEN", code: "PASS_REQUIRED", message: "Zostań patronem, aby komentować ten film." });
      return fail({ type: "FORBIDDEN", message: "Brak uprawnień do komentowania." });
    }

    // 3. Validation
    if (countGraphemes(text) > 2000) {
      return fail({ type: "VALIDATION_ERROR", message: "Komentarz jest za długi (max 2000 znaków)." });
    }

    const repo = new CommentRepository(prisma);
    const video = await prisma.video.findUnique({
      where: { id: resolvedVideoId },
      select: { creatorId: true, commentsMode: true, creator: { select: { userId: true } } }
    });
    if (!video) return fail({ type: "NOT_FOUND", message: "Film nie istnieje." });

    const videoCreatorId = video.creator?.userId || null;
    const canModerate = await canModerateVideoComments(ctx, resolvedVideoId);

    // The channel's block list (Studio "Zablokuj użytkownika"): the viewer may watch but not comment or reply.
    // The reason and the end date are the creator's business and never reach the viewer.
    const banned = await channelBanError(ctx, video.creatorId, userId, canModerate);
    if (banned) return fail(banned);

    // The creator's choice per video (Studio "Komentarze"); owner and staff are not limited by it.
    const newStatus = CommentPolicy.statusForNewComment(video.commentsMode, canModerate);
    if (newStatus === null) {
      return fail({ type: "FORBIDDEN", code: "COMMENTS_DISABLED", message: "Komentarze pod tym filmem są wyłączone." });
    }

    let finalParentId: string | null = null;
    if (parentId) {
      const parent = await repo.findCommentById(parentId);
      if (!parent || parent.videoId !== resolvedVideoId) return fail(INVALID_PARENT);
      // A reply to a reply joins the same thread (one level of nesting).
      const threadRoot = parent.parentId ? await repo.findCommentById(parent.parentId) : parent;
      // Only a thread people can see accepts replies; a reply under a deleted, hidden or held
      // comment (or one of a deleted account) would be invisible to everyone.
      const rootIsVisible = !!threadRoot && threadRoot.status === CommentStatus.VISIBLE && threadRoot.author?.isDeleted !== true;
      if (!threadRoot || (!rootIsVisible && !canModerate) || threadRoot.status === CommentStatus.DELETED) {
        return fail(INVALID_PARENT);
      }
      finalParentId = threadRoot.id;
    }

    const newComment = await repo.create({
      authorId: userId,
      videoId: resolvedVideoId,
      creatorId: video.creatorId,
      text,
      parentId: finalParentId,
      status: newStatus,
    });

    await recordAuditEventSafe(ctx, {
      action: "COMMENT_CREATE",
      targetType: "COMMENT",
      targetId: newComment.id,
      metadata: { videoId: resolvedVideoId, parentId: finalParentId, ...(newStatus !== CommentStatus.VISIBLE ? { heldByCommentsMode: true } : {}) }
    });

    // An answer that people can see tells the author of the answered comment (best effort, never blocks the answer).
    if (parentId && newStatus === CommentStatus.VISIBLE) {
      await notifyCommentReply({ answeredCommentId: parentId, replierId: userId, replyText: text });
    }

    const commentWithRelations = await repo.findCommentForDto(newComment.id, userId, canModerate);
    if (!commentWithRelations) return fail(commentDatabaseError("COMMENT_CREATE_READBACK_ERROR", new Error("Created comment not found")));

    return ok(mapCommentToDto(commentWithRelations, { userId, canModerate, videoCreatorId, hasVideoAccess: accessResult.data.hasAccess }));
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_CREATE_ERROR", error));
  }
}
