import { AppContext } from "@/lib/modules/shared/app-context";
import { DbClient } from "@/lib/modules/shared/db";
import { UseCaseResult, fail, ok } from "@/lib/modules/shared/result";
import { technicalDataCutoff } from "../domain/retention";

export interface TechnicalDataAnonymizationResult {
  cutoff: string;
  auditLogs: number;
  sessions: number;
  playbackSessions: number;
  views: number;
}

export type PrivacyJobError = { type: "UNAUTHORIZED" | "DATABASE_ERROR"; message: string };

/**
 * Daily retention job: clears IP addresses, user agents and their hashes older than
 * TECHNICAL_DATA_RETENTION_DAYS. Only those fields change; every row stays, so view counters
 * (`Video.views`, counted `VideoPlaybackSession`/`VideoView` rows), audit history and active
 * sign-ins keep working. Idempotent: rows already cleared are not touched again.
 */
export async function anonymizeOldTechnicalData(
  ctx: AppContext,
): Promise<UseCaseResult<TechnicalDataAnonymizationResult, PrivacyJobError>> {
  if (ctx.actor.type !== "system") return fail({ type: "UNAUTHORIZED", message: "System job only." });
  const cutoff = technicalDataCutoff(ctx.now());
  const db = ctx.prisma as DbClient;

  try {
    const auditLogs = await db.auditLog.updateMany({
      where: { createdAt: { lt: cutoff }, OR: [{ ip: { not: null } }, { userAgent: { not: null } }] },
      data: { ip: null, userAgent: null },
    });
    const sessions = await db.session.updateMany({
      where: { createdAt: { lt: cutoff }, OR: [{ ipAddress: { not: null } }, { userAgent: { not: null } }] },
      data: { ipAddress: null, userAgent: null },
    });
    const playbackSessions = await db.videoPlaybackSession.updateMany({
      where: { startedAt: { lt: cutoff }, OR: [{ ipHash: { not: null } }, { userAgentHash: { not: null } }] },
      data: { ipHash: null, userAgentHash: null },
    });
    const views = await db.videoView.updateMany({
      where: { createdAt: { lt: cutoff }, ipHash: { not: null } },
      data: { ipHash: null },
    });

    return ok({
      cutoff: cutoff.toISOString(),
      auditLogs: auditLogs.count,
      sessions: sessions.count,
      playbackSessions: playbackSessions.count,
      views: views.count,
    });
  } catch (error) {
    return fail({ type: "DATABASE_ERROR", message: error instanceof Error ? error.message : String(error) });
  }
}
