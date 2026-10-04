import { prisma } from "@/lib/prisma";

/** A Google-only account may do a sensitive action only if the session was created this recently (the user just signed in again). */
export const RECENT_SIGN_IN_SECONDS = 10 * 60;

export type ReauthResult = "ok" | "PASSWORD_REQUIRED" | "INVALID_PASSWORD" | "REAUTH_REQUIRED";

type VerifyPassword = (input: { hash: string; password: string }) => Promise<boolean>;

async function defaultVerifyPassword(input: { hash: string; password: string }) {
  // Loaded lazily: importing the Better Auth instance is heavy and not needed for Google-only accounts.
  const { auth } = await import("./auth");
  const context = await auth.$context;
  return context.password.verify(input);
}

/**
 * Re-authentication gate for actions a stolen session cookie alone must not be able to do: deleting
 * the account (audit F-12) and changing its e-mail address (audit AUTH-02/SEC-04).
 * - accounts with a password must re-enter it;
 * - Google-only accounts must have signed in within the last few minutes (the UI sends them through
 *   Google again, which creates a new session).
 * `verifyPassword` lets callers that already hold the Better Auth context (auth hooks) skip the import.
 */
export async function checkSensitiveReauth(input: {
  userId: string;
  sessionId: string | null;
  password?: string | null;
  now?: Date;
  verifyPassword?: VerifyPassword;
}): Promise<ReauthResult> {
  const credential = await prisma.account.findFirst({
    where: { userId: input.userId, providerId: "credential" },
    select: { password: true },
  });
  if (credential?.password) {
    if (!input.password) return "PASSWORD_REQUIRED";
    const verify = input.verifyPassword ?? defaultVerifyPassword;
    const valid = await verify({ hash: credential.password, password: input.password });
    return valid ? "ok" : "INVALID_PASSWORD";
  }
  const session = input.sessionId
    ? await prisma.session.findUnique({ where: { id: input.sessionId }, select: { createdAt: true } })
    : null;
  const now = (input.now ?? new Date()).getTime();
  if (session && now - session.createdAt.getTime() < RECENT_SIGN_IN_SECONDS * 1000) return "ok";
  return "REAUTH_REQUIRED";
}

/** True when `userId` is the only remaining (non-deleted) administrator. */
export async function isLastAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== "ADMIN") return false;
  const others = await prisma.user.count({ where: { role: "ADMIN", isDeleted: false, id: { not: userId } } });
  return others === 0;
}
