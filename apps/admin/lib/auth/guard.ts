import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isDevAuthBypassEnabled } from "@admin/lib/config";
import { adminAuth } from "./auth";
import { recordAdminAuthEvent } from "./audit";
import { isAbsoluteExpired, isStepUpFresh, stepUpSecondsLeft } from "./session-rules";

/** What the panel pages know about the signed-in owner. Never contains secrets or tokens. */
export type AdminViewer = {
  userId: string;
  email: string;
  name: string;
  sessionCreatedAt: string;
  stepUpSecondsLeft: number;
  dev?: true;
};

type RawSession = {
  session: { token: string; createdAt: Date; stepUpAt?: Date | null };
  user: { id: string; email: string; name: string; enrolledAt?: Date | null };
};

async function readSession(): Promise<RawSession | null> {
  const h = await headers();
  return (await adminAuth.api.getSession({ headers: h })) as RawSession | null;
}

const DEV_VIEWER: AdminViewer = {
  userId: "dev",
  email: "dev@localhost",
  name: "Podgląd lokalny",
  sessionCreatedAt: new Date(0).toISOString(),
  stepUpSecondsLeft: 0,
  dev: true,
};

/**
 * Every panel page starts here. No session -> sign-in; unfinished enrollment -> enrollment screen;
 * older than 12 h since sign-in -> the session is revoked and the owner signs in again.
 */
export async function requireAdmin(nextPath: string = "/"): Promise<AdminViewer> {
  if (isDevAuthBypassEnabled()) return DEV_VIEWER;
  const current = await readSession();
  const next = encodeURIComponent(nextPath);
  if (!current) redirect(`/logowanie?next=${next}`);
  if (!current.user.enrolledAt) redirect("/rejestracja");
  if (isAbsoluteExpired(current.session)) {
    const h = await headers();
    await adminAuth.api.revokeSession({ headers: h, body: { token: current.session.token } }).catch(() => undefined);
    await recordAdminAuthEvent({ action: "ADMIN_SESSION_EXPIRED", outcome: "success", adminUserId: current.user.id, email: current.user.email, reason: "absolute_12h", headers: h });
    redirect(`/logowanie?next=${next}&powod=wygasla`);
  }
  return {
    userId: current.user.id,
    email: current.user.email,
    name: current.user.name,
    sessionCreatedAt: new Date(current.session.createdAt).toISOString(),
    stepUpSecondsLeft: stepUpSecondsLeft(current.session),
  };
}

/** Sensitive actions (phase 4: refunds, broadcasts, exports) call this first; phase 1 has the mechanism only. */
export async function requireStepUp(nextPath: string): Promise<AdminViewer> {
  const viewer = await requireAdmin(nextPath);
  if (viewer.dev) return viewer;
  const current = await readSession();
  if (!current || !isStepUpFresh(current.session)) redirect(`/potwierdz?next=${encodeURIComponent(nextPath)}`);
  return viewer;
}

/**
 * For Server Actions of sensitive operations (delete a film, change a role, delete an account): true only
 * when the owner signed in or confirmed TOTP in the last 5 minutes. The action then answers
 * `STEP_UP_REQUIRED` and the client sends the owner to /potwierdz first.
 */
export async function hasFreshStepUp(): Promise<boolean> {
  if (isDevAuthBypassEnabled()) return true;
  const current = await readSession().catch(() => null);
  return !!current && !!current.user.enrolledAt && !isAbsoluteExpired(current.session) && isStepUpFresh(current.session);
}

/** For the sign-in and enrollment screens: who is signed in (if anyone), without redirecting. */
export async function peekAdminSession(): Promise<{ enrolled: boolean; email: string } | null> {
  if (isDevAuthBypassEnabled()) return null;
  const current = await readSession().catch(() => null);
  if (!current || isAbsoluteExpired(current.session)) return null;
  return { enrolled: !!current.user.enrolledAt, email: current.user.email };
}
