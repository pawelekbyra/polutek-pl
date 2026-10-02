import { prisma } from "@/lib/prisma";

/** A Google-only account may delete itself only if the session was created this recently (the user just signed in again). */
export const RECENT_SIGN_IN_SECONDS = 10 * 60;

export type DeletionReauthResult = "ok" | "PASSWORD_REQUIRED" | "INVALID_PASSWORD" | "REAUTH_REQUIRED";

/**
 * Re-authentication gate for the irreversible account deletion (audit F-12). A stolen session cookie
 * alone must not be enough:
 * - accounts with a password must re-enter it;
 * - Google-only accounts must have signed in within the last few minutes (the UI sends them through
 *   Google again, which creates a new session).
 */
export async function checkDeletionReauth(input: {
  userId: string;
  sessionId: string | null;
  password?: string | null;
  now?: Date;
}): Promise<DeletionReauthResult> {
  const credential = await prisma.account.findFirst({
    where: { userId: input.userId, providerId: "credential" },
    select: { password: true },
  });
  if (credential?.password) {
    if (!input.password) return "PASSWORD_REQUIRED";
    // Loaded lazily: importing the Better Auth instance is heavy and not needed for Google-only accounts.
    const { auth } = await import("./auth");
    const context = await auth.$context;
    const valid = await context.password.verify({ hash: credential.password, password: input.password });
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
