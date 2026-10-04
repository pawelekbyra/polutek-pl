import { APIError, getSessionFromCtx } from "better-auth/api";
import { prisma } from "@/lib/prisma";
import { recordAuthAudit } from "./audit";
import { PASSKEY_NAME_MAX_LENGTH, SESSION_FRESH_AGE_SECONDS } from "./config";

/**
 * Server-side rules for passkeys (Better Auth `@better-auth/passkey`), wired into the auth hooks
 * and the plugin options in auth.ts. See docs/architecture/auth-better-auth.md ("Passkeys").
 */

export const PASSKEY_PATHS = {
  registerOptions: "/passkey/generate-register-options",
  register: "/passkey/verify-registration",
  signInOptions: "/passkey/generate-authenticate-options",
  signIn: "/passkey/verify-authentication",
  remove: "/passkey/delete-passkey",
  rename: "/passkey/update-passkey",
} as const;

/** Device name as stored: control characters removed, trimmed, at most PASSKEY_NAME_MAX_LENGTH characters. */
export function normalizePasskeyName(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const clean = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return clean ? Array.from(clean).slice(0, PASSKEY_NAME_MAX_LENGTH).join("") : undefined;
}

// Before hooks cannot remove a field: Better Auth merges the returned context over the original
// one (defu), so an `undefined` or deleted key falls back to what the client sent. An empty string
// is kept, and the plugin treats it as "not given" (`name || fallback`).

/**
 * Body of `/passkey/verify-registration` as the endpoint may see it: the name normalized and
 * `createSession` forced off (adding a key to a signed-in account never needs a second session).
 */
export function sanitizePasskeyRegistrationBody(body: unknown): Record<string, unknown> {
  const source = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  return { ...source, name: normalizePasskeyName(source.name) ?? "", createSession: false };
}

/**
 * Query of `/passkey/generate-register-options` with `name` blanked: the plugin would otherwise use
 * the device name as the WebAuthn user name, and the password manager must list the account's e-mail.
 */
export function stripPasskeyOptionsName(query: unknown): Record<string, unknown> {
  const source = query && typeof query === "object" ? (query as Record<string, unknown>) : {};
  return { ...source, name: "" };
}

/** Same rule as Better Auth's freshSessionMiddleware: the session must have been created within `freshAge`. */
export function isSessionFresh(createdAt: Date | string, now: number = Date.now()): boolean {
  return now - new Date(createdAt).getTime() < SESSION_FRESH_AGE_SECONDS * 1000;
}

type SessionCtx = Parameters<typeof getSessionFromCtx>[0];

/**
 * Adding or removing a passkey on a signed-in account needs a fresh session (Better Auth `freshAge`).
 * The plugin cannot do it itself: registration runs with `requireSession: false` (passkey-first
 * sign-up) and delete only wants a plain session. No session: nothing to check here.
 */
export async function assertFreshSessionIfSignedIn(ctx: SessionCtx) {
  const session = await getSessionFromCtx(ctx);
  if (!session) return;
  if (!isSessionFresh(session.session.createdAt)) {
    throw new APIError("FORBIDDEN", { message: "SESSION_NOT_FRESH", code: "SESSION_NOT_FRESH" });
  }
}

/**
 * The plugin asks for user verification as "preferred" and does not enforce it. A passkey sign-in
 * replaces the password AND the TOTP step, so the authenticator must have verified the user
 * (biometrics or device PIN); a bare "touch" on a security key without a PIN is refused.
 */
export function assertPasskeyUserVerified(userVerified: boolean | undefined) {
  if (!userVerified) {
    throw new APIError("UNAUTHORIZED", {
      message: "PASSKEY_USER_VERIFICATION_REQUIRED",
      code: "PASSKEY_USER_VERIFICATION_REQUIRED",
    });
  }
}

type AfterHookCtx = {
  path: string;
  body?: unknown;
  context: {
    returned?: unknown;
    session?: { user?: { id?: string } } | null;
    newSession?: { user?: { id?: string } } | null;
  };
};

/** Audit events for passkeys (ids only, never the public key or the WebAuthn response). */
export async function auditPasskeyEvent(ctx: AfterHookCtx) {
  const returned = ctx.context.returned;
  if (!returned || returned instanceof Error) return;
  const body = (ctx.body ?? {}) as { id?: unknown; response?: { id?: unknown } };

  if (ctx.path === PASSKEY_PATHS.register) {
    const passkey = returned as { id?: string; userId?: string };
    if (passkey.id && passkey.userId) {
      await recordAuthAudit({ action: "AUTH_PASSKEY_ADDED", userId: passkey.userId, metadata: { passkeyId: passkey.id } });
    }
    return;
  }
  if (ctx.path === PASSKEY_PATHS.remove) {
    const userId = ctx.context.session?.user?.id;
    if (userId && typeof body.id === "string" && (returned as { status?: boolean }).status === true) {
      await recordAuthAudit({ action: "AUTH_PASSKEY_REMOVED", userId, metadata: { passkeyId: body.id } });
    }
    return;
  }
  if (ctx.path === PASSKEY_PATHS.signIn) {
    const userId = ctx.context.newSession?.user?.id ?? (returned as { user?: { id?: string } }).user?.id;
    if (!userId) return;
    const credentialID = typeof body.response?.id === "string" ? body.response.id : null;
    const passkey = credentialID
      ? await prisma.passkey.findUnique({ where: { credentialID }, select: { id: true } }).catch(() => null)
      : null;
    await recordAuthAudit({ action: "AUTH_PASSKEY_SIGN_IN", userId, metadata: { passkeyId: passkey?.id ?? null } });
  }
}
