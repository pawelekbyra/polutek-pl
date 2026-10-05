"use server";
/**
 * Writes of "Społeczność" for comments: moderation (one or many comments, one atomic request), the moderation
 * queue decisions with their "Cofnij", the creator's reply and heart. Each goes through runAdminAction
 * (requireAdmin -> zod strict -> rate limit -> step-up when final -> use case); the use case audits.
 * Deleting a comment is final, so it needs a fresh step-up like deleting a film.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  BULK_MODERATION_LIMIT,
  createCreatorReply,
  moderateCommentsBulk,
  setAdminCommentHeart,
  undoCommentModeration,
  type BulkModerationResult,
  type ReportHandling,
} from "@/lib/modules/comments";
import { domainError, runAdminAction } from "@admin/lib/actions/run";
import type { ActionResult } from "@admin/lib/actions/panel";

const id = z.string().min(1).max(64);
const status = z.enum(["VISIBLE", "HELD_FOR_REVIEW", "HIDDEN"]);

function refresh(videoSlug?: string) {
  revalidatePath("/spolecznosc");
  revalidatePath("/");
  if (videoSlug) revalidatePath(`/tresci/${videoSlug}/komentarze`);
}

const OP_MESSAGE = { hide: "ukryte", hold: "wstrzymane", approve: "zatwierdzone", restore: "przywrócone", delete: "usunięte" } as const;

const moderateSchema = z
  .object({ ids: z.array(id).min(1).max(BULK_MODERATION_LIMIT), op: z.enum(["hide", "hold", "approve", "restore", "delete"]), videoSlug: z.string().max(120).optional() })
  .strict();

/** Moderation of one or up to 50 comments from the lists: ONE request, all or nothing. */
export async function moderateCommentsAction(input: z.input<typeof moderateSchema>): Promise<ActionResult<BulkModerationResult>> {
  const op = (input as { op?: string } | null)?.op;
  return runAdminAction({
    path: "/spolecznosc?tab=komentarze",
    schema: moderateSchema,
    input,
    limit: { bucket: op === "delete" ? "comments-delete" : "comments-moderate", max: op === "delete" ? 30 : 120, windowMs: 60_000 },
    stepUp: op === "delete",
    run: async ({ data, ctx }) => {
      // Hiding or deleting a reported comment settles its reports as upheld (they are the reason it is hidden).
      const reports: ReportHandling = data.op === "hide" || data.op === "delete" ? "action" : "none";
      const res = await moderateCommentsBulk(ctx, { ids: data.ids, action: data.op, reports });
      if (!res.ok) return domainError(res.error);
      refresh(data.videoSlug);
      const n = res.data.changed.length;
      return { ok: true, data: res.data, message: n === 0 ? "Bez zmian: komentarze już były w tym stanie." : n === 1 ? `Komentarz ${OP_MESSAGE[data.op]}.` : `${n} komentarzy ${OP_MESSAGE[data.op]}.` };
    },
  });
}

const decideSchema = z.object({ commentId: id, decision: z.enum(["hide", "hold", "keep"]) }).strict();

/**
 * One decision from the moderation queue, atomic with its reports: "hide" and "hold" uphold the reports,
 * "keep" dismisses them (and approves a held comment). Returns what "Cofnij" needs.
 */
export async function decideQueueItemAction(input: z.input<typeof decideSchema>): Promise<ActionResult<BulkModerationResult>> {
  return runAdminAction({
    path: "/spolecznosc?tab=moderacja",
    schema: decideSchema,
    input,
    limit: { bucket: "comments-moderate", max: 120, windowMs: 60_000 },
    run: async ({ data, ctx }) => {
      const reports: ReportHandling = data.decision === "keep" ? "dismiss" : "action";
      const res = await moderateCommentsBulk(ctx, { ids: [data.commentId], action: data.decision, reports });
      if (!res.ok) return domainError(res.error);
      refresh();
      const message = data.decision === "hide" ? "Komentarz ukryty." : data.decision === "hold" ? "Komentarz wstrzymany do przeglądu." : "Komentarz zostaje, zgłoszenia zamknięte.";
      return { ok: true, data: res.data, message };
    },
  });
}

const undoSchema = z
  .object({
    changes: z.array(z.object({ commentId: id, from: status, to: status }).strict()).max(BULK_MODERATION_LIMIT),
    reports: z.array(z.object({ id, commentId: id }).strict()).max(BULK_MODERATION_LIMIT * 20),
  })
  .strict();

/** "Cofnij" after a decision or a hide: restores statuses and reopens the closed reports, or refuses if anything changed since. */
export async function undoModerationAction(input: z.input<typeof undoSchema>): Promise<ActionResult> {
  return runAdminAction({
    path: "/spolecznosc?tab=moderacja",
    schema: undoSchema,
    input,
    limit: { bucket: "comments-moderate", max: 120, windowMs: 60_000 },
    run: async ({ data, ctx }) => {
      const res = await undoCommentModeration(ctx, data);
      if (!res.ok) return domainError(res.error);
      refresh();
      return { ok: true, message: "Cofnięto." };
    },
  });
}

const replySchema = z.object({ commentId: id, text: z.string().max(4000), heart: z.boolean(), videoSlug: z.string().max(120).optional() }).strict();

/** "Odpowiedz jako twórca": writes the reply as the channel owner's account; optionally adds the heart. */
export async function replyAsCreatorAction(input: z.input<typeof replySchema>): Promise<ActionResult<{ id: string; duplicate: boolean }>> {
  return runAdminAction({
    path: "/spolecznosc?tab=komentarze",
    schema: replySchema,
    input,
    limit: { bucket: "comments-reply", max: 20, windowMs: 60_000 },
    run: async ({ data, ctx }) => {
      const res = await createCreatorReply(ctx, { commentId: data.commentId, text: data.text, heart: data.heart });
      if (!res.ok) return domainError(res.error);
      refresh(data.videoSlug);
      return { ok: true, data: { id: res.data.id, duplicate: res.data.duplicate }, message: res.data.duplicate ? "Ta odpowiedź już jest opublikowana." : "Odpowiedź opublikowana." };
    },
  });
}

const heartSchema = z.object({ commentId: id, hearted: z.boolean(), videoSlug: z.string().max(120).optional() }).strict();

export async function setHeartAction(input: z.input<typeof heartSchema>): Promise<ActionResult<{ isHearted: boolean }>> {
  return runAdminAction({
    path: "/spolecznosc?tab=komentarze",
    schema: heartSchema,
    input,
    limit: { bucket: "comments-heart", max: 60, windowMs: 60_000 },
    run: async ({ data, ctx }) => {
      const res = await setAdminCommentHeart(ctx, { commentId: data.commentId, hearted: data.hearted });
      if (!res.ok) return domainError(res.error);
      refresh(data.videoSlug);
      return { ok: true, data: { isHearted: res.data.isHearted }, message: res.data.isHearted ? "Serduszko dodane." : "Serduszko zdjęte." };
    },
  });
}
