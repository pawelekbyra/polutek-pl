import { CommentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendNotification, notificationTemplates } from "@/lib/modules/notifications";

/**
 * In-app notifications for people whose comments get an answer or the creator's appreciation. All of them are
 * best-effort side effects: they run after the main action succeeded and never throw into it.
 */

const SNIPPET_LENGTH = 90;

function snippetOf(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > SNIPPET_LENGTH ? `${flat.slice(0, SNIPPET_LENGTH - 1)}…` : flat;
}

/** Language-neutral path of the video page with the comment anchored; the bell localizes it for the viewer. */
function commentHref(slug: string | null | undefined, commentId: string): string | undefined {
  return slug ? `/watch/${encodeURIComponent(slug)}#comment-${commentId}` : undefined;
}

/** An unread like notification for the same comment, or any within this window, absorbs the next one. */
const LIKE_NOTIFICATION_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Someone liked a comment: its author hears about it, but a comment that is liked again and again (or liked,
 * un-liked and liked in a few seconds) fills the bell only once: while a like notification for that comment is
 * unread, or was sent in the last hour, further likes add nothing.
 */
export async function notifyCommentLike(input: { commentId: string; likerId: string }): Promise<void> {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: input.commentId },
      select: { id: true, authorId: true, status: true, author: { select: { isDeleted: true } }, video: { select: { slug: true } } },
    });
    if (!comment || comment.authorId === input.likerId || comment.status !== CommentStatus.VISIBLE || comment.author?.isDeleted) return;
    const t = notificationTemplates.commentLike;
    const href = commentHref(comment.video?.slug, comment.id);
    const recent = await prisma.notification.findFirst({
      where: {
        userId: comment.authorId,
        kind: t.kind,
        titleEn: t.titleEn,
        ...(href ? { href } : {}),
        OR: [{ read: false }, { createdAt: { gte: new Date(Date.now() - LIKE_NOTIFICATION_COOLDOWN_MS) } }],
      },
      select: { id: true },
    });
    if (recent) return;
    await sendNotification({ userId: comment.authorId, kind: t.kind, titlePl: t.titlePl, titleEn: t.titleEn, bodyPl: t.bodyPl, bodyEn: t.bodyEn, href });
  } catch (error) {
    console.error("[COMMENT_LIKE_NOTIFICATION_ERROR]", error);
  }
}

/** Somebody answered `answeredCommentId`: its author hears about it (not when they answered themselves). */
export async function notifyCommentReply(input: { answeredCommentId: string; replierId: string; replyText: string }): Promise<void> {
  try {
    const answered = await prisma.comment.findUnique({
      where: { id: input.answeredCommentId },
      select: { id: true, authorId: true, author: { select: { isDeleted: true } }, video: { select: { slug: true } } },
    });
    if (!answered || answered.authorId === input.replierId || answered.author?.isDeleted) return;
    const replier = await prisma.user.findUnique({ where: { id: input.replierId }, select: { name: true } });
    const body = `${replier?.name ? `${replier.name}: ` : ""}${snippetOf(input.replyText)}`;
    const t = notificationTemplates.commentReply;
    await sendNotification({
      userId: answered.authorId,
      kind: t.kind,
      titlePl: t.titlePl,
      titleEn: t.titleEn,
      bodyPl: body,
      bodyEn: body,
      href: commentHref(answered.video?.slug, answered.id),
      // The like template an admin may edit must not overwrite this text.
      skipTemplate: true,
    });
  } catch (error) {
    console.error("[COMMENT_REPLY_NOTIFICATION_ERROR]", error);
  }
}

/**
 * The creator of the channel put a HEART on a comment (the creator's "like" is the heart only, never a plain like):
 * its author hears about it, once per comment (a heart that is taken back and given again does not notify twice).
 */
export async function notifyCreatorLike(input: { commentId: string }): Promise<void> {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: input.commentId },
      select: {
        id: true,
        authorId: true,
        status: true,
        author: { select: { isDeleted: true } },
        video: { select: { slug: true, creator: { select: { userId: true } } } },
      },
    });
    if (!comment || comment.status !== CommentStatus.VISIBLE || comment.author?.isDeleted) return;
    // The creator appreciating their own comment is no news.
    if (comment.video?.creator?.userId === comment.authorId) return;
    const t = notificationTemplates.creatorLike;
    const href = commentHref(comment.video?.slug, comment.id);
    const already = await prisma.notification.findFirst({
      where: { userId: comment.authorId, kind: t.kind, titleEn: t.titleEn, ...(href ? { href } : {}) },
      select: { id: true },
    });
    if (already) return;
    await sendNotification({ userId: comment.authorId, kind: t.kind, titlePl: t.titlePl, titleEn: t.titleEn, bodyPl: t.bodyPl, bodyEn: t.bodyEn, href, skipTemplate: true });
  } catch (error) {
    console.error("[CREATOR_LIKE_NOTIFICATION_ERROR]", error);
  }
}
