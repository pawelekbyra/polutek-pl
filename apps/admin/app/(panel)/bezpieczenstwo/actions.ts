"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { revokeAdminSession, revokeOtherAdminSessions } from "@admin/lib/auth/security";
import { openGate } from "@admin/lib/actions/gate";
import { RATE } from "@admin/lib/actions/rate-limit";
import type { ActionResult } from "@admin/lib/actions/panel";

const idSchema = z.object({ sessionId: z.string().min(1).max(100) }).strict();

/** Ends another panel session. Ending access is always safe, so no step-up; the current session signs out normally. */
export async function revokeSessionAction(input: { sessionId: string }): Promise<ActionResult> {
  const gate = await openGate({ path: "/bezpieczenstwo", rate: RATE.security });
  if (!gate.ok) return gate.result;
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Niepoprawne żądanie." };
  const res = await revokeAdminSession({ sessionId: parsed.data.sessionId, actorUserId: gate.viewer.userId, currentSessionId: gate.viewer.sessionId, headers: await headers() });
  if (!res.ok) return { ok: false, message: res.reason === "current_session" ? "To jest Twoja bieżąca sesja: wyloguj się z menu konta." : "Ta sesja już nie istnieje." };
  revalidatePath("/bezpieczenstwo");
  return { ok: true, message: "Sesja zakończona." };
}

export async function revokeOtherSessionsAction(): Promise<ActionResult<{ count: number }>> {
  const gate = await openGate({ path: "/bezpieczenstwo", rate: RATE.security });
  if (!gate.ok) return gate.result;
  const count = await revokeOtherAdminSessions({ actorUserId: gate.viewer.userId, currentSessionId: gate.viewer.sessionId, headers: await headers() });
  revalidatePath("/bezpieczenstwo");
  return { ok: true, message: count ? `Zakończono ${count} innych sesji.` : "Nie było innych sesji.", data: { count } };
}
