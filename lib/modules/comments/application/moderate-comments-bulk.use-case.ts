import { randomUUID } from "crypto";
import { authorizeComments, moderatorId } from "./authorize-comments";
import { CommentDeletedReason, CommentReportStatus, CommentStatus } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { WriteTx } from "@/lib/modules/shared/db";
import { recordAuditEvent } from "@/lib/modules/audit";
import { CommentError, commentDatabaseError } from "../domain/comment.errors";
import { CommentPolicy, ModerationAction } from "../domain/comment.policy";

/** One request moderates at most this many comments (the old panel needed one request per comment). */
export const BULK_MODERATION_LIMIT = 50;

/**
 * "keep" ("Zostaw"): the comment stays as it is, except that a comment held for review is approved. It is the
 * decision "this is fine", paired with `reports: "dismiss"`.
 */
export type BulkModerationAction = ModerationAction | "keep";
/** What happens to the PENDING reports of the moderated comments: nothing, closed as upheld, closed as dismissed. */
export type ReportHandling = "none" | "action" | "dismiss";

export type StatusChange = { commentId: string; from: CommentStatus; to: CommentStatus };
export type BulkModerationResult = {
  /** Comments whose status moved. A client keeps this (with `resolvedReports`) to offer "Cofnij". */
  changed: StatusChange[];
  /** Comments already in the wanted state (a repeated request is a no-op, never an error). */
  unchanged: string[];
  resolvedReports: { id: string; commentId: string }[];
  batchId: string;
};

const TARGET: Record<Exclude<BulkModerationAction, "keep">, CommentStatus> = {
  hide: CommentStatus.HIDDEN,
  hold: CommentStatus.HELD_FOR_REVIEW,
  approve: CommentStatus.VISIBLE,
  restore: CommentStatus.VISIBLE,
  delete: CommentStatus.DELETED,
};

const AUDIT_ACTION: Record<Exclude<BulkModerationAction, "keep">, string> = {
  hide: "COMMENT_HIDE",
  hold: "COMMENT_HOLD",
  approve: "COMMENT_APPROVE",
  restore: "COMMENT_RESTORE",
  delete: "COMMENT_DELETE",
};

class BatchConflict extends Error {}

const conflict = (message: string): UseCaseResult<never, CommentError> => fail({ type: "CONFLICT", message });

/**
 * Moderates up to 50 comments in ONE transaction: either every comment that needs the change gets it, or none
 * does (a comment that vanished or is in a state the action forbids rejects the whole batch with CONFLICT;
 * nothing is half done). Comments already in the wanted state are reported as `unchanged`, so repeating the
 * request is harmless. `reports` lets the same transaction close the pending reports of these comments
 * (hide/delete = upheld, keep/approve = dismissed) and zeroes their counters. Every changed comment and every
 * closed report group gets an audit row with the batch id. The result carries what "Cofnij" needs
 * (`undoCommentModeration`); a delete is final and has no undo.
 */
export async function moderateCommentsBulk(
  ctx: AppContext,
  input: { ids: string[]; action: BulkModerationAction; reports?: ReportHandling },
): Promise<UseCaseResult<BulkModerationResult, CommentError>> {
  const ids = [...new Set(input.ids)];
  const denied = await authorizeComments(ctx, "comment.moderate", ids);
  if (denied) return fail(denied);
  const actorId = moderatorId(ctx);
  if (ids.length === 0) return fail({ type: "VALIDATION_ERROR", message: "Zaznacz co najmniej jeden komentarz." });
  if (ids.length > BULK_MODERATION_LIMIT) return fail({ type: "VALIDATION_ERROR", message: `Naraz można zmienić najwyżej ${BULK_MODERATION_LIMIT} komentarzy.` });
  const { action } = input;
  const reports: ReportHandling = input.reports ?? "none";
  const batchId = randomUUID();
  const now = ctx.now();

  try {
    const result = await ctx.db.writeTransaction(async (tx: WriteTx) => {
      const rows = await tx.comment.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } });
      if (rows.length !== ids.length) throw new BatchConflict("Część komentarzy już nie istnieje. Odśwież listę.");

      const changes: (StatusChange & { effective: Exclude<BulkModerationAction, "keep"> })[] = [];
      const unchanged: string[] = [];
      let forbidden = 0;
      for (const row of rows) {
        const effective = action === "keep" ? (row.status === CommentStatus.HELD_FOR_REVIEW ? "approve" : null) : action;
        if (effective === null || row.status === TARGET[effective]) unchanged.push(row.id);
        else if (CommentPolicy.canTransition(effective, row.status)) changes.push({ commentId: row.id, from: row.status, to: TARGET[effective], effective });
        else forbidden += 1;
      }
      if (forbidden) throw new BatchConflict(`${forbidden} z zaznaczonych komentarzy jest w stanie, który nie pozwala na tę czynność (np. już usunięty). Odśwież listę.`);

      // One conditional update per source status; a concurrent change makes the count differ and rolls everything back.
      const bySource = new Map<string, typeof changes>();
      for (const c of changes) bySource.set(`${c.effective}:${c.from}`, [...(bySource.get(`${c.effective}:${c.from}`) ?? []), c]);
      for (const group of bySource.values()) {
        const { effective, from } = group[0];
        const data =
          effective === "delete"
            ? { status: CommentStatus.DELETED, pinnedAt: null, deletedAt: now, deletedById: actorId, deletedReason: CommentDeletedReason.MODERATOR_DELETED }
            : { status: TARGET[effective], moderatedAt: now, moderatedById: actorId, ...(TARGET[effective] === CommentStatus.VISIBLE ? {} : { pinnedAt: null }) };
        const { count } = await tx.comment.updateMany({ where: { id: { in: group.map((c) => c.commentId) }, status: from }, data });
        if (count !== group.length) throw new BatchConflict("Któryś komentarz zmienił się w międzyczasie. Odśwież listę.");
      }

      let resolvedReports: { id: string; commentId: string }[] = [];
      if (reports !== "none") {
        const pending = await tx.commentReport.findMany({ where: { commentId: { in: ids }, status: CommentReportStatus.PENDING }, select: { id: true, commentId: true } });
        if (pending.length) {
          const status = reports === "action" ? CommentReportStatus.ACTION_TAKEN : CommentReportStatus.DISMISSED;
          const { count } = await tx.commentReport.updateMany({ where: { id: { in: pending.map((p) => p.id) }, status: CommentReportStatus.PENDING }, data: { status, resolvedAt: now, resolvedById: actorId } });
          if (count !== pending.length) throw new BatchConflict("Zgłoszenia zmieniły się w międzyczasie. Odśwież listę.");
          await tx.comment.updateMany({ where: { id: { in: [...new Set(pending.map((p) => p.commentId))] } }, data: { reportsCount: 0 } });
          resolvedReports = pending;
        }
      }

      for (const c of changes) {
        const metadata = { from: c.from, to: c.to, batchId, bulk: ids.length > 1, ...(c.effective === "delete" ? { reason: CommentDeletedReason.MODERATOR_DELETED } : {}) };
        await recordAuditEvent(ctx, { action: AUDIT_ACTION[c.effective], targetType: "COMMENT", targetId: c.commentId, metadata }, tx);
      }
      const byComment = new Map<string, string[]>();
      for (const r of resolvedReports) byComment.set(r.commentId, [...(byComment.get(r.commentId) ?? []), r.id]);
      for (const [commentId, reportIds] of byComment) {
        await recordAuditEvent(ctx, { action: reports === "action" ? "REPORT_ACTION_TAKEN" : "REPORT_DISMISSED", targetType: "COMMENT", targetId: commentId, metadata: { reportIds, batchId } }, tx);
      }
      return { changed: changes.map(({ commentId, from, to }) => ({ commentId, from, to })), unchanged, resolvedReports, batchId } satisfies BulkModerationResult;
    });
    return ok(result);
  } catch (error) {
    if (error instanceof BatchConflict) return conflict(error.message);
    return fail(commentDatabaseError("COMMENT_BULK_MODERATION_ERROR", error));
  }
}
