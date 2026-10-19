import { CommentStatus } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { WriteTx } from "@/lib/modules/shared/db";
import { recordAuditEvent } from "@/lib/modules/audit";
import { authorize } from "@/lib/modules/authz";
import { countGraphemes } from "@/lib/utils/graphemes";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { notifyCommentReply, notifyCreatorLike } from "./comment-notifications";

export const CREATOR_REPLY_MAX_GRAPHEMES = 2000;
/** The same text under the same thread within this window is the same reply sent twice (double click, retry). */
const DUPLICATE_WINDOW_MS = 60_000;

/**
 * "Odpowiedz jako twórca". Two callers (CLAUDE.md 4.23):
 * - the channel owner (or a member whose role allows `comment.reply_as_creator`) in the Studio: the reply is written as
 *   that user, who is the author of the comment;
 * - platform staff from the admin panel (legacy): the panel account is not a site user, so the reply is written as the
 *   owner of the video's channel (`Creator.userId`). This is the only place staff speaks as a creator and it goes away
 *   once owners answer themselves (`LEGACY_STAFF_ALLOWED` in lib/modules/authz).
 * Either way the AUTHOR badge follows `Creator.userId`. A reply to a reply joins the thread of its root (one level of
 * nesting, like the public site). Only a visible comment can be answered. Optionally also puts the creator's heart on
 * the comment that was answered, in the same transaction.
 * Idempotent: an identical reply to the same thread within a minute returns the existing one.
 * The audit row and the comment commit together.
 */
export async function createCreatorReply(
  ctx: AppContext,
  input: { commentId: string; text: string; heart?: boolean },
): Promise<UseCaseResult<{ id: string; parentId: string; duplicate: boolean }, CommentError>> {
  if (ctx.actor.type !== "admin" && ctx.actor.type !== "user") return fail({ type: "UNAUTHORIZED", message: "Zaloguj się, aby odpowiedzieć." });
  const text = input.text.trim();
  if (!text) return fail({ type: "VALIDATION_ERROR", message: "Wpisz treść odpowiedzi." });
  if (countGraphemes(text) > CREATOR_REPLY_MAX_GRAPHEMES) return fail({ type: "VALIDATION_ERROR", message: `Odpowiedź jest za długa (najwyżej ${CREATOR_REPLY_MAX_GRAPHEMES} znaków).` });
  const now = ctx.now();

  try {
    const target = await ctx.prisma.comment.findUnique({
      where: { id: input.commentId },
      select: { id: true, status: true, parentId: true, videoId: true, isHearted: true, author: { select: { isDeleted: true } }, video: { select: { creatorId: true, creator: { select: { userId: true, status: true } } } } },
    });
    if (!target) return fail({ type: "NOT_FOUND", message: "Komentarz nie istnieje." });
    const creatorUserId = target.video?.creator?.userId;
    if (!creatorUserId || !target.video) return fail({ type: "CONFLICT", message: "Film nie ma przypisanego konta twórcy kanału." });

    const denied = await authorize(ctx, "comment.reply_as_creator", {
      channel: { id: target.video.creatorId, ownerUserId: creatorUserId, status: target.video.creator?.status },
    });
    if (denied) return fail({ type: "UNAUTHORIZED", message: denied.message });
    // A member answers as themselves; platform staff (legacy) answers as the channel owner.
    const authorId = ctx.actor.type === "user" ? ctx.actor.userId : creatorUserId;

    // Only after authorization: an unauthorized caller learns nothing about the comment's state.
    if (target.status !== CommentStatus.VISIBLE || target.author?.isDeleted) return fail({ type: "CONFLICT", message: "Odpowiedzieć można tylko na widoczny komentarz." });

    const root = target.parentId ? await ctx.prisma.comment.findUnique({ where: { id: target.parentId }, select: { id: true, status: true } }) : { id: target.id, status: target.status };
    if (!root || root.status !== CommentStatus.VISIBLE) return fail({ type: "CONFLICT", message: "Wątek nie jest już widoczny." });

    const outcome = await ctx.db.writeTransaction(async (tx: WriteTx) => {
      const existing = await tx.comment.findFirst({
        where: { parentId: root.id, authorId, text, status: { not: CommentStatus.DELETED }, createdAt: { gte: new Date(now.getTime() - DUPLICATE_WINDOW_MS) } },
        select: { id: true },
      });
      if (existing) return { id: existing.id, duplicate: true, hearted: false };
      const created = await tx.comment.create({
        data: { authorId, videoId: target.videoId, creatorId: target.video!.creatorId, text, parentId: root.id, status: CommentStatus.VISIBLE },
        select: { id: true },
      });
      const hearted = input.heart === true && !target.isHearted;
      if (hearted) await tx.comment.update({ where: { id: target.id }, data: { isHearted: true } });
      await recordAuditEvent(ctx, { action: "COMMENT_CREATOR_REPLY", targetType: "COMMENT", targetId: created.id, metadata: { replyTo: target.id, threadRoot: root.id, videoId: target.videoId, hearted, ...(ctx.actor.type === "admin" ? { onBehalfOf: creatorUserId } : {}) }, channelId: target.video!.creatorId }, tx);
      return { id: created.id, duplicate: false, hearted };
    });
    // The author of the answered comment hears about the answer and about the heart (best effort, once per answer).
    if (!outcome.duplicate) {
      await notifyCommentReply({ answeredCommentId: target.id, replierId: authorId, replyText: text });
      if (outcome.hearted) await notifyCreatorLike({ commentId: target.id });
    }
    return ok({ id: outcome.id, parentId: root.id, duplicate: outcome.duplicate });
  } catch (error) {
    return fail(commentDatabaseError("COMMENT_CREATOR_REPLY_ERROR", error));
  }
}
