import { AppContext } from "@/lib/modules/shared/app-context";
import { UserProfileService } from "@/lib/services/user/profile.service";

/**
 * getOrCreateCurrentUser is a modular bridge use case.
 *
 * R5 legacy bridge: It currently delegates to UserProfileService.getOrCreateUser
 * to leverage its complex conflict resolution, referral linking, and account merging logic.
 *
 * Future work: Move the core synchronization and conflict resolution logic into
 * the Users module and retire this bridge.
 */
export async function getOrCreateCurrentUser(
  ctx: AppContext,
  clerkUserId: string,
  sessionClaims?: Record<string, unknown> | null | undefined
) {
  if (sessionClaims) {
    return await UserProfileService.getOrCreateUserFromAuth(clerkUserId, sessionClaims);
  }
  // Delegate to legacy service while keeping the call site modular
  return await UserProfileService.getOrCreateUser(clerkUserId);
}
