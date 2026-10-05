import { CommentReportStatus, CommentStatus } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { WriteTx } from "@/lib/modules/shared/db";
import { recordAuditEvent } from "@/lib/modules/audit";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { BULK_MODERATION_LIMIT, type StatusChange } from "./moderate-comments-bulk.use-case";

/** Statuses an undo may move a comment between. DELETED is final and can never be produced or left by an undo. */
const REVERSIBLE: readonly CommentStatus[] = [CommentStatus.VISIBLE, CommentStatus.HELD_FOR_REVIEW, CommentStatus.HIDDEN];

class UndoConflict extends Error {}

/**
 * "Cofnij" for a moderation decision (`moderateCommentsBulk` result): moves every comment from `to` back to
 * `from` and reopens the reports that decision closed, in one transaction. All or nothing: if any comment is no
 * longer in the status the decision left it in (someone moderated it again), nothing is undone (CONFLICT), so an
 * undo can never overwrite a newer decision. Only reports closed by this same admin are reopened. A delete has no
 * undo (`DELETED` is rejected).
 */
export async function undoCommentModeration(
  ctx: AppContext,
  input: { changes: StatusChange[]; reports: { id: string; commentId: string }[] },
): Promise<UseCaseResult<{ restored: number; reopened: number }, CommentError>> {
  if (ctx.actor.type !== "admin") return fail({ type: "UNAUTHORIZED", message: "Brak uprawnień administratora." });
  const actorId = ctx.actor.userId;
  const { changes, reports } = input;
  const valid = changes.every((c) => REVERSIBLE.includes(c.from) && REVERSIBLE.includes(c.to) && c.from !== c.to);
  if (!valid || new Set(changes.map((c) => c.commentId)).size !== changes.length || changes.length > BULK_MODERATION_LIMIT || reports.length > BULK_MODERATION_LIMIT * 20) {
    return fail({ type: "VALIDATION_ERROR", message: "Tej zmiany nie da się cofnąć." });
  }
  if (changes.length === 0 && reports.length === 0) return ok({ restored: 0, reopened: 0 });
  const now = ctx.now();

  try {
    const result = await ctx.db.writeTransaction(async (tx: WriteTx) => {
      const groups = new Map<string, StatusChange[]>();
      for (const c of changes) groups.set(`${c.to}>${c.from}`, [...(groups.get(`${c.to}>${c.from}`) ?? []), c]);
      for (const group of groups.values()) {
        const { to, from } = group[0];
        const { count } = await tx.comment.updateMany({
          where: { id: { in: group.map((c) => c.commentId) }, status: to },
          data: from === CommentStatus.VISIBLE ? { status: from, moderatedAt: null, moderatedById: null } : { status: from, moderatedAt: now, moderatedById: actorId },
        });
        if (count !== group.length) throw new UndoConflict("Komentarz został w międzyczasie zmieniony: nie cofam, żeby nie nadpisać nowszej decyzji.");
      }

      let reopened = 0;
      if (reports.length) {
        const mine = await tx.commentReport.findMany({
          where: { id: { in: reports.map((r) => r.id) }, status: { not: CommentReportStatus.PENDING }, resolvedById: actorId },
          select: { id: true, commentId: true },
        });
        const claimed = new Map(reports.map((r) => [r.id, r.commentId]));
        const toReopen = mine.filter((r) => claimed.get(r.id) === r.commentId);
        if (toReopen.length !== reports.length) throw new UndoConflict("Zgłoszenia zmieniły się w międzyczasie: nie cofam.");
        await tx.commentReport.updateMany({ where: { id: { in: toReopen.map((r) => r.id) } }, data: { status: CommentReportStatus.PENDING, resolvedAt: null, resolvedById: null } });
        const perComment = new Map<string, number>();
        for (const r of toReopen) perComment.set(r.commentId, (perComment.get(r.commentId) ?? 0) + 1);
        for (const commentId of perComment.keys()) {
          const pending = await tx.commentReport.count({ where: { commentId, status: CommentReportStatus.PENDING } });
          await tx.comment.update({ where: { id: commentId }, data: { reportsCount: pending } });
        }
        reopened = toReopen.length;
      }

      const touched = new Set([...changes.map((c) => c.commentId), ...reports.map((r) => r.commentId)]);
      for (const commentId of touched) {
        const change = changes.find((c) => c.commentId === commentId);
        await recordAuditEvent(
          ctx,
          { action: "COMMENT_MODERATION_UNDONE", targetType: "COMMENT", targetId: commentId, metadata: { ...(change ? { from: change.to, to: change.from } : {}), reopenedReports: reports.filter((r) => r.commentId === commentId).map((r) => r.id) } },
          tx,
        );
      }
      return { restored: changes.length, reopened };
    });
    return ok(result);
  } catch (error) {
    if (error instanceof UndoConflict) return fail({ type: "CONFLICT", message: error.message });
    return fail(commentDatabaseError("COMMENT_UNDO_MODERATION_ERROR", error));
  }
}
