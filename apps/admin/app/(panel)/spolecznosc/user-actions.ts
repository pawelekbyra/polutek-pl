"use server";
/**
 * Writes of "Społeczność" for people: supporter marker, role, account deletion, mute, sign out everywhere,
 * "view as person". Role change and account deletion need a fresh step-up (passkey or TOTP in the last 5 minutes);
 * deletion also needs the account's e-mail typed back (checked in the use case, case-insensitive).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { viewAsPerson, type AccessExplanation } from "@/lib/modules/admin-community";
import { adminSetSupporter } from "@/lib/modules/patron";
import { changeUserRoleFromPanel, deleteUserFromPanel, muteUserCommenting, revokeUserSessions, unmuteUserCommenting, MUTE_DAYS } from "@/lib/modules/users";
import { domainError, runAdminAction } from "@admin/lib/actions/run";
import type { ActionResult } from "@admin/lib/actions/panel";

const userId = z.string().min(1).max(64);
const reason = z.string().trim().min(3, "Podaj powód (co najmniej 3 znaki).").max(300, "Najwyżej 300 znaków.");

function refresh(id?: string) {
  revalidatePath("/spolecznosc");
  if (id) revalidatePath(`/spolecznosc/u/${id}`);
  revalidatePath("/");
}

const supporterSchema = z.object({ userId, action: z.enum(["grant", "revoke"]), reason }).strict();

export async function setSupporterAction(input: z.input<typeof supporterSchema>): Promise<ActionResult> {
  return runAdminAction({
    path: "/spolecznosc",
    schema: supporterSchema,
    input,
    limit: { bucket: "supporter", max: 20, windowMs: 60_000 },
    run: async ({ data, ctx }) => {
      const res = await adminSetSupporter(ctx, data);
      if (!res.ok) return domainError(res.error);
      refresh(data.userId);
      if (!res.data.changed) return { ok: true, message: data.action === "grant" ? "Znacznik już był nadany." : "Ta osoba nie miała aktywnego znacznika." };
      return { ok: true, message: data.action === "grant" ? "Znacznik wspierającego nadany." : "Znacznik wspierającego cofnięty." };
    },
  });
}

const roleSchema = z.object({ userId, role: z.enum(["ADMIN", "USER"]) }).strict();

export async function changeRoleAction(input: z.input<typeof roleSchema>): Promise<ActionResult> {
  return runAdminAction({
    path: "/spolecznosc",
    schema: roleSchema,
    input,
    limit: { bucket: "user-role", max: 10, windowMs: 10 * 60_000 },
    stepUp: true,
    run: async ({ data, ctx, viewer }) => {
      const res = await changeUserRoleFromPanel(ctx, { ...data, panelEmail: viewer.email });
      if (!res.ok) return domainError(res.error);
      refresh(data.userId);
      return { ok: true, message: !res.data.changed ? "Rola bez zmian." : res.data.role === "ADMIN" ? "Nadano rolę administratora strony." : "Odebrano rolę administratora strony." };
    },
  });
}

const deleteSchema = z.object({ userId, confirmEmail: z.string().trim().min(3).max(320) }).strict();

export async function deleteUserAction(input: z.input<typeof deleteSchema>): Promise<ActionResult> {
  const result = await runAdminAction({
    path: "/spolecznosc",
    schema: deleteSchema,
    input,
    limit: { bucket: "user-delete", max: 5, windowMs: 10 * 60_000 },
    stepUp: true,
    run: async ({ data, ctx, viewer }) => {
      const res = await deleteUserFromPanel(ctx, { ...data, panelEmail: viewer.email });
      if (!res.ok) return domainError(res.error);
      refresh(data.userId);
      return { ok: true, message: "Konto usunięte i zanonimizowane." };
    },
  });
  if (result.ok) redirect("/spolecznosc?tab=uzytkownicy&usunieto=1");
  return result;
}

const muteSchema = z.object({ userId, days: z.number().int().refine((d) => (MUTE_DAYS as readonly number[]).includes(d), "Wybierz 1, 7, 30 albo 365 dni."), reason }).strict();

export async function muteUserAction(input: z.input<typeof muteSchema>): Promise<ActionResult> {
  return runAdminAction({
    path: "/spolecznosc",
    schema: muteSchema,
    input,
    limit: { bucket: "user-mute", max: 30, windowMs: 60_000 },
    run: async ({ data, ctx }) => {
      const res = await muteUserCommenting(ctx, data);
      if (!res.ok) return domainError(res.error);
      refresh(data.userId);
      return { ok: true, message: `Komentowanie wyciszone na ${data.days === 365 ? "rok" : `${data.days} ${data.days === 1 ? "dzień" : "dni"}`}.` };
    },
  });
}

const unmuteSchema = z.object({ userId }).strict();

export async function unmuteUserAction(input: z.input<typeof unmuteSchema>): Promise<ActionResult> {
  return runAdminAction({
    path: "/spolecznosc",
    schema: unmuteSchema,
    input,
    limit: { bucket: "user-mute", max: 30, windowMs: 60_000 },
    run: async ({ data, ctx }) => {
      const res = await unmuteUserCommenting(ctx, data);
      if (!res.ok) return domainError(res.error);
      refresh(data.userId);
      return { ok: true, message: res.data.changed ? "Wyciszenie zdjęte." : "Ta osoba nie była wyciszona." };
    },
  });
}

const sessionsSchema = z.object({ userId, sessionId: z.string().min(1).max(128).optional() }).strict();

/** Signs the person out of one session or of every device. Takes effect at the next request (up to 60 s for an open tab). */
export async function revokeSessionsAction(input: z.input<typeof sessionsSchema>): Promise<ActionResult> {
  return runAdminAction({
    path: "/spolecznosc",
    schema: sessionsSchema,
    input,
    limit: { bucket: "user-sessions", max: 30, windowMs: 60_000 },
    run: async ({ data, ctx }) => {
      const res = await revokeUserSessions(ctx, data);
      if (!res.ok) return domainError(res.error);
      refresh(data.userId);
      return { ok: true, message: res.data.revoked === 0 ? "Ta osoba nie ma aktywnych sesji." : data.sessionId ? "Sesja zakończona." : `Wylogowano ze wszystkich urządzeń (${res.data.revoked}).` };
    },
  });
}

const viewAsSchema = z.object({ userId }).strict();

/** "Podgląd jako ta osoba": read-only explanation, audited as ADMIN_VIEW_AS each time it is opened. */
export async function viewAsPersonAction(input: z.input<typeof viewAsSchema>): Promise<ActionResult<AccessExplanation>> {
  return runAdminAction({
    path: "/spolecznosc",
    schema: viewAsSchema,
    input,
    limit: { bucket: "view-as", max: 30, windowMs: 60_000 },
    run: async ({ data, ctx }) => {
      const res = await viewAsPerson(ctx, data.userId);
      if (!res.ok) return domainError(res.error);
      return { ok: true, data: res.data };
    },
  });
}
