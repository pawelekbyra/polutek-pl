import { AppContext } from "@/lib/modules/shared/app-context";
import { WriteTx } from "@/lib/modules/shared/db";
import { logger } from "@/lib/logger";
import { recordAuditEvent, RecordAuditEventInput } from "./record-audit-event.use-case";

/**
 * Best-effort variant of recordAuditEvent for mutations that cannot share a DB
 * transaction with the audit row (multi-step provider/cron work on ctx.prisma).
 * The mutation has already happened, so a failed audit write is logged instead
 * of turning a completed operation into an error. Prefer
 * recordAuditEvent(ctx, event, tx) whenever the mutation runs in a transaction.
 */
export async function recordAuditEventSafe(
  ctx: AppContext,
  input: RecordAuditEventInput,
  tx?: WriteTx
): Promise<void> {
  try {
    await recordAuditEvent(ctx, input, tx);
  } catch (error) {
    logger.error(`[Audit] Failed to record ${input.action}:`, error);
  }
}
