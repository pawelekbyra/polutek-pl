import { AppContext, createAppContext } from "@/lib/modules/shared/app-context";
import { logger } from "@/lib/logger";

/**
 * Builds an AppContext for legacy admin use cases that are not handed a ctx by
 * their route (they call the global prisma client directly).
 *
 * - When the caller already knows the admin id, that is used as-is.
 * - Otherwise the admin is re-resolved from the current Clerk session, exactly
 *   like the route's own `requireAdminForApi` did.
 * - If neither works the event is still written, attributed to a system actor
 *   with an explicit reason, so the gap is visible rather than silently lost.
 */
export async function resolveAdminAuditContext(adminUserId?: string | null): Promise<AppContext> {
  if (adminUserId) {
    return createAppContext({ actor: { type: "admin", userId: adminUserId } });
  }

  try {
    const { requireAdminActor } = await import("@/lib/api/auth");
    const actor = await requireAdminActor();
    return createAppContext({ actor });
  } catch (error) {
    logger.warn("[Audit] Could not resolve admin session for audit event:", error);
    return createAppContext({ actor: { type: "system", reason: "admin_session_unresolved" } });
  }
}
