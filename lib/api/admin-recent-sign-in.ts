import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { isRecentSignIn, RECENT_SIGN_IN_SECONDS } from "@/lib/auth/reauth";

export const ADMIN_REAUTH_REQUIRED_MESSAGE =
  `Ta operacja wymaga świeżego logowania (w ciągu ostatnich ${RECENT_SIGN_IN_SECONDS / 60} minut). ` +
  "Wyloguj się, zaloguj ponownie i powtórz operację.";

/**
 * Step-up gate for destructive admin actions on other accounts (deleting a user, changing a role): a
 * stolen admin session cookie alone must not be enough. The admin must have signed in (password or
 * Google, plus 2FA when enabled) within the last RECENT_SIGN_IN_SECONDS. The body carries no password
 * on purpose: the admin UI tells the admin to sign out and back in, which creates a new session.
 * Returns a 403 `REAUTH_REQUIRED` response, or null when the session is fresh. Fails closed.
 */
export async function requireRecentAdminSignIn(adminUserId: string, now: Date = new Date()): Promise<NextResponse | null> {
  const session = await auth({ fresh: true });
  const fresh = session.userId === adminUserId && (await isRecentSignIn(session.sessionId, now));
  if (fresh) return null;
  return NextResponse.json({ error: "REAUTH_REQUIRED", message: ADMIN_REAUTH_REQUIRED_MESSAGE }, { status: 403 });
}
