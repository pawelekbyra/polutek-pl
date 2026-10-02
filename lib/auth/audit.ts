import { logger } from "@/lib/logger";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { recordAuditEventSafe } from "@/lib/modules/audit";

type AuthAuditInput = {
  action: string;
  userId: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

/**
 * Records an authentication event (sign-in/out, password change, ...) in the audit log. Best
 * effort and never throws: the auth flow must not fail because the audit write did. Metadata
 * carries ids and flags only, never tokens, passwords or e-mail bodies.
 */
export async function recordAuthAudit(input: AuthAuditInput): Promise<void> {
  try {
    const ctx = createAppContext(
      input.userId ? { type: "user", userId: input.userId } : { type: "system", reason: "auth" },
    );
    await recordAuditEventSafe(ctx, {
      action: input.action,
      targetType: "User",
      targetId: input.userId,
      ip: input.ip ?? null,
      userAgent: input.userAgent?.slice(0, 255) ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    logger.error("[auth-audit] failed", error instanceof Error ? error.message : String(error));
  }
}
