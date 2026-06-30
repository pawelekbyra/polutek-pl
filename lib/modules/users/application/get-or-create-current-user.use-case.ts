import { AppContext } from "@/lib/modules/shared/app-context";
import { getOrCreateUser, getOrCreateUserFromAuth } from "./sync-user.use-case";

/**
 * getOrCreateCurrentUser is a modular bridge use case.
 *
 * R5 legacy bridge: It currently delegates to sync-user.use-case
 * to leverage its complex conflict resolution and account merging logic.
 */
export async function getOrCreateCurrentUser(
  ctx: AppContext,
  clerkUserId: string,
  sessionClaims?: Record<string, unknown> | null | undefined
) {
  if (sessionClaims) {
    return await getOrCreateUserFromAuth(clerkUserId, sessionClaims);
  }
  // Delegate to modular sync use case
  return await getOrCreateUser(clerkUserId);
}
