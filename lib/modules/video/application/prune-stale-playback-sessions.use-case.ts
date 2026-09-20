import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok } from "@/lib/modules/shared/result";

/**
 * VideoPlaybackSession rows are created by AppPreloadProvider's hover/idle
 * prefetch, not just real playback, so the table grows with page traffic
 * rather than only with views. Sessions that were never counted as a view
 * (countedAsView: false) carry no downstream value once they age out — no
 * admin diagnostics, patron read model, or Stripe dispute logic reads this
 * table (checked 2026-09-20).
 */
export const STALE_PLAYBACK_SESSION_RETENTION_DAYS = 30;

export type PruneStalePlaybackSessionsInput = {
  olderThanDays?: number;
};

export type PruneStalePlaybackSessionsOutput = {
  deletedCount: number;
  cutoff: Date;
};

export async function pruneStalePlaybackSessions(
  input: PruneStalePlaybackSessionsInput,
  ctx: AppContext
): Promise<UseCaseResult<PruneStalePlaybackSessionsOutput, never>> {
  const olderThanDays = input.olderThanDays ?? STALE_PLAYBACK_SESSION_RETENTION_DAYS;
  const cutoff = new Date(ctx.now().getTime() - olderThanDays * 24 * 60 * 60 * 1000);

  const result = await ctx.prisma.videoPlaybackSession.deleteMany({
    where: {
      countedAsView: false,
      startedAt: { lt: cutoff },
    },
  });

  return ok({ deletedCount: result.count, cutoff });
}
