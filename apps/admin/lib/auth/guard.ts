import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_LOGOUT_PATH, getAdminAuthMode, isDevAuthBypassEnabled } from "@admin/lib/config";
import { accessSecondsLeft, isAccessTokenFresh, resolveAccessSession, type AccessSession } from "./access-session";
import { adminAuth } from "./auth";
import { recordAdminAuthEvent } from "./audit";
import { loadLanguageGrants, loadRole, normalizeRole, type AdminRole } from "./roles";
import { isAbsoluteExpired, isStepUpFresh, stepUpSecondsLeft } from "./session-rules";

/** What the panel pages know about the signed-in owner. Never contains secrets or tokens. */
export type AdminViewer = {
  userId: string;
  email: string;
  name: string;
  sessionCreatedAt: string;
  stepUpSecondsLeft: number;
  /** Id of the session behind this request (so the sessions list can mark "ta sesja"). */
  sessionId?: string;
  role: AdminRole;
  /** Translation languages a TRANSLATOR may write (empty for OWNER). */
  languages: string[];
  dev?: true;
  /** "access" = signed in by the verified Cloudflare Access token (default), "passkey" = legacy own login. */
  authMode?: "access" | "passkey";
  /** Where the account menu sends the person to sign out (access mode: the Cloudflare Access logout). */
  signOutHref?: string;
};

type RawSession = {
  session: { id?: string; token: string; createdAt: Date; stepUpAt?: Date | null };
  user: { id: string; email: string; name: string; role?: string | null; enrolledAt?: Date | null };
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
  role: "OWNER",
  languages: [],
  dev: true,
};

/**
 * Every panel page starts here. No session -> sign-in; unfinished enrollment -> enrollment screen;
 * older than 12 h since sign-in -> the session is revoked and the owner signs in again.
 */
async function readAccessSession(): Promise<AccessSession | null> {
  const result = await resolveAccessSession(await headers());
  return result.ok ? result.session : null;
}

function accessViewer(session: AccessSession, role: AdminRole, languages: string[]): AdminViewer {
  return {
    role,
    languages,
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    sessionCreatedAt: new Date((session.issuedAt ?? 0) * 1000).toISOString(),
    stepUpSecondsLeft: accessSecondsLeft(session),
    authMode: "access",
    signOutHref: ACCESS_LOGOUT_PATH,
    ...(session.dev ? { dev: true as const } : {}),
  };
}

export async function requireAdmin(nextPath: string = "/", opts: { roles?: readonly AdminRole[] } = {}): Promise<AdminViewer> {
  if (isDevAuthBypassEnabled()) return DEV_VIEWER;
  if (getAdminAuthMode() === "access") {
    const session = await readAccessSession();
    // /logowanie explains (never loops back here): it does not call requireAdmin.
    if (!session) redirect(`/logowanie?next=${encodeURIComponent(nextPath)}`);
    const role = session.user.role;
    if (!(opts.roles ?? ["OWNER"]).includes(role)) redirect(role === "TRANSLATOR" ? "/tlumaczenia" : "/logowanie");
    return accessViewer(session, role, role === "TRANSLATOR" ? await loadLanguageGrants(session.user.id) : []);
  }
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
  // Safe by default: a page or action that does not name the roles it admits is for the OWNER only.
  const role = current.user.role ? normalizeRole(current.user.role) : await loadRole(current.user.id);
  if (!(opts.roles ?? ["OWNER"]).includes(role)) redirect(role === "TRANSLATOR" ? "/tlumaczenia" : "/logowanie");
  return {
    role,
    languages: role === "TRANSLATOR" ? await loadLanguageGrants(current.user.id) : [],
    userId: current.user.id,
    email: current.user.email,
    name: current.user.name,
    sessionCreatedAt: new Date(current.session.createdAt).toISOString(),
    stepUpSecondsLeft: stepUpSecondsLeft(current.session),
    sessionId: current.session.id,
  };
}

/** Sensitive actions (phase 4: refunds, broadcasts, exports) call this first. Access mode: the Access token must be fresh (12 h). */
export async function requireStepUp(nextPath: string): Promise<AdminViewer> {
  const viewer = await requireAdmin(nextPath);
  if (viewer.dev) return viewer;
  if (viewer.authMode === "access") {
    if (!(await hasFreshStepUp())) redirect(`/potwierdz?next=${encodeURIComponent(nextPath)}`);
    return viewer;
  }
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
  if (getAdminAuthMode() === "access") {
    const session = await readAccessSession().catch(() => null);
    return !!session && isAccessTokenFresh(session);
  }
  const current = await readSession().catch(() => null);
  return !!current && !!current.user.enrolledAt && !isAbsoluteExpired(current.session) && isStepUpFresh(current.session);
}

/** For the sign-in and enrollment screens: who is signed in (if anyone), without redirecting. */
export async function peekAdminSession(): Promise<{ enrolled: boolean; email: string } | null> {
  if (isDevAuthBypassEnabled()) return null;
  if (getAdminAuthMode() === "access") {
    const session = await readAccessSession().catch(() => null);
    return session ? { enrolled: true, email: session.user.email } : null;
  }
  const current = await readSession().catch(() => null);
  if (!current || isAbsoluteExpired(current.session)) return null;
  return { enrolled: !!current.user.enrolledAt, email: current.user.email };
}
