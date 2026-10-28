import { AppContext } from "@/lib/modules/shared/app-context";
import { canModerateVideoComments } from "./authorize-comments";
import { channelBanError, commentMuteError } from "./comment-write-guard";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { CommentDto, mapCommentToDto } from "../domain/comment.dto";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
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

  try {
    const comment = await repo.findCommentById(commentId);
    if (!comment) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });

    // Comments inherit the video's access rules.
    const accessResult = await checkVideoAccess({ videoIdOrSlug: comment.videoId }, ctx);
    if (!accessResult.ok) return fail(commentDatabaseError("COMMENT_UPDATE_ACCESS_ERROR", accessResult.error));
    if (!accessResult.data.hasAccess) return fail({ type: "FORBIDDEN", message: "Brak dostępu." });

    if (!CommentPolicy.canUpdateComment(actor, comment.authorId)) {
      return fail({ type: "FORBIDDEN", message: "Nie masz uprawnień do edycji tego komentarza." });
    }

    // Moderated or deleted comments cannot be edited.
    if (comment.status !== CommentStatus.VISIBLE) {
      return fail({ type: "CONFLICT", message: "Nie można edytować moderowanych lub usuniętych komentarzy." });
    }

    if (countGraphemes(text) > 2000) {
      return fail({ type: "VALIDATION_ERROR", message: "Komentarz jest za długi (max 2000 znaków)." });
    }

    // An edit puts new words under the video, so it follows the same rules as adding a comment (audit W17):
    // the moderation mute, the channel block and the video's comments mode.
    const muted = await commentMuteError(ctx, userId);
    if (muted) return fail(muted);

    const video = await prisma.video.findUnique({
      where: { id: comment.videoId },
      select: { creatorId: true, commentsMode: true, creator: { select: { userId: true } } },
    });
    if (!video) return fail({ type: "NOT_FOUND", message: "Film nie istnieje." });

    const videoCreatorId = video.creator?.userId || null;
    const canModerate = await canModerateVideoComments(ctx, comment.videoId);

    const banned = await channelBanError(ctx, video.creatorId, userId, canModerate);
    if (banned) return fail(banned);

    // OFF: no new text under this video, and a rewrite is new text. HELD: the new text waits for review again
    // instead of replacing the approved one unseen. The owner and moderators of the channel are not limited.
    const newStatus = CommentPolicy.statusForNewComment(video.commentsMode, canModerate);
    if (newStatus === null) {
      return fail({ type: "FORBIDDEN", code: "COMMENTS_DISABLED", message: "Komentarze pod tym filmem są wyłączone." });
    }

    // Saving the same words again is not an edit: no mark, no second review.
    if (text !== comment.text) {
      const stored = await repo.updateTextIfVisible(commentId, userId, { text, editedAt: ctx.now(), status: newStatus });
      if (!stored) return fail({ type: "CONFLICT", message: "Nie można edytować moderowanych lub usuniętych komentarzy." });
    }

    const fullComment = await repo.findCommentForDto(commentId, userId, canModerate);
    if (!fullComment) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });

    return ok(mapCommentToDto(fullComment, { userId, canModerate, videoCreatorId, hasVideoAccess: true }));
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_UPDATE_ERROR", error));
  }
}
