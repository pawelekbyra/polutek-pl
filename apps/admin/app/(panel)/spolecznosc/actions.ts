"use server";
/**
 * Writes of "Społeczność": comment moderation, reports, role change, account deletion. Same use cases as the
 * old /admin. Role change and deletion need a fresh step-up (passkey or TOTP in the last 5 minutes); deletion
 * also the account's e-mail typed back.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CommentReportStatus } from "@prisma/client";
import { z } from "zod";
import { approveHeldComment, deleteAdminComment, hideAdminComment, resolveCommentReport, restoreAdminComment } from "@/lib/modules/comments";
import { changeUserRoleFromPanel, deleteUserFromPanel } from "@/lib/modules/users";
import { hasFreshStepUp, requireAdmin } from "@admin/lib/auth/guard";
import { isDevFixturesEnabled } from "@admin/lib/config";
import { errorMessage, panelContext, sampleDataRefusal, type ActionResult } from "@admin/lib/actions/panel";

const STEP_UP: ActionResult = { ok: false, code: "STEP_UP_REQUIRED", message: "Najpierw potwierdź tożsamość (klucz dostępu albo TOTP)." };

const USER_MESSAGES: Record<string, string> = {
  LAST_ADMIN: "To ostatni administrator strony; najpierw nadaj rolę komuś innemu.",
  TARGET_IS_ADMIN: "Najpierw odbierz rolę administratora, potem usuń konto.",
  CONFIRM_EMAIL_MISMATCH: "Wpisany e-mail nie zgadza się z adresem konta.",
  EMAIL_NOT_VERIFIED: "Administratorem może zostać tylko konto z potwierdzonym e-mailem.",
  USER_ALREADY_DELETED: "To konto jest już usunięte.",
  USER_NOT_FOUND: "To konto nie istnieje.",
};

const userError = (error: unknown) => {
  const code = (error as { code?: string }).code;
  return { ok: false as const, code, message: (code && USER_MESSAGES[code]) || errorMessage(error).message };
};

function revalidateCommunity(userId?: string) {
  revalidatePath("/spolecznosc");
  if (userId) revalidatePath(`/spolecznosc/osoby/${userId}`);
  revalidatePath("/");
}

const commentOp = z.object({ commentId: z.string().min(1).max(64), op: z.enum(["hide", "restore", "approve", "delete"]) }).strict();

export async function moderateCommentAction(input: { commentId: string; op: "hide" | "restore" | "approve" | "delete" }): Promise<ActionResult> {
  const viewer = await requireAdmin("/spolecznosc");
  if (isDevFixturesEnabled()) return sampleDataRefusal();
  const parsed = commentOp.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Niepoprawne żądanie." };
  const ctx = await panelContext(viewer);
  const { commentId, op } = parsed.data;
  const res =
    op === "hide" ? await hideAdminComment(commentId, ctx) : op === "restore" ? await restoreAdminComment(commentId, ctx) : op === "approve" ? await approveHeldComment(commentId, ctx) : await deleteAdminComment({ commentId }, ctx);
  if (!res.ok) return { ok: false, message: res.error.message || "Nie udało się." };
  revalidateCommunity();
  return { ok: true, message: { hide: "Komentarz ukryty.", restore: "Komentarz przywrócony.", approve: "Komentarz zatwierdzony.", delete: "Komentarz usunięty (treść zostaje jako dowód w panelu)." }[op] };
}

const reportOp = z.object({ reportId: z.string().min(1).max(64), decision: z.enum(["dismiss", "act"]), commentId: z.string().min(1).max(64).optional() }).strict();

/** "act" = the report was right: the comment is hidden and the report closed as ACTION_TAKEN. */
export async function resolveReportAction(input: { reportId: string; decision: "dismiss" | "act"; commentId?: string }): Promise<ActionResult> {
  const viewer = await requireAdmin("/spolecznosc?tab=zgloszenia");
  if (isDevFixturesEnabled()) return sampleDataRefusal();
  const parsed = reportOp.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Niepoprawne żądanie." };
  const ctx = await panelContext(viewer);
  if (parsed.data.decision === "act" && parsed.data.commentId) {
    const hidden = await hideAdminComment(parsed.data.commentId, ctx);
    // Already hidden or deleted is fine: the decision still closes the report.
    if (!hidden.ok && hidden.error.type !== "CONFLICT") return { ok: false, message: hidden.error.message };
  }
  const res = await resolveCommentReport(parsed.data.reportId, parsed.data.decision === "act" ? CommentReportStatus.ACTION_TAKEN : CommentReportStatus.DISMISSED, ctx);
  if (!res.ok) return { ok: false, message: res.error.message };
  revalidateCommunity();
  return { ok: true, message: parsed.data.decision === "act" ? "Zgłoszenie uznane, komentarz ukryty." : "Zgłoszenie oddalone." };
}

const roleOp = z.object({ userId: z.string().min(1).max(64), role: z.enum(["ADMIN", "USER"]) }).strict();

export async function changeRoleAction(input: { userId: string; role: "ADMIN" | "USER" }): Promise<ActionResult> {
  const viewer = await requireAdmin("/spolecznosc");
  if (isDevFixturesEnabled()) return sampleDataRefusal();
  const parsed = roleOp.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Niepoprawne żądanie." };
  if (!(await hasFreshStepUp())) return STEP_UP;
  const res = await changeUserRoleFromPanel(await panelContext(viewer), { ...parsed.data, panelEmail: viewer.email });
  if (!res.ok) return userError(res.error);
  revalidateCommunity(parsed.data.userId);
  return { ok: true, message: !res.data.changed ? "Rola bez zmian." : res.data.role === "ADMIN" ? "Nadano rolę administratora strony." : "Odebrano rolę administratora strony." };
}

const deleteOp = z.object({ userId: z.string().min(1).max(64), confirmEmail: z.string().trim().min(3).max(320) }).strict();

export async function deleteUserAction(input: { userId: string; confirmEmail: string }): Promise<ActionResult> {
  const viewer = await requireAdmin("/spolecznosc");
  if (isDevFixturesEnabled()) return sampleDataRefusal();
  const parsed = deleteOp.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Wpisz adres e-mail konta." };
  if (!(await hasFreshStepUp())) return STEP_UP;
  const res = await deleteUserFromPanel(await panelContext(viewer), { ...parsed.data, panelEmail: viewer.email });
  if (!res.ok) return userError(res.error);
  revalidateCommunity(parsed.data.userId);
  redirect("/spolecznosc?usunieto=1");
}
