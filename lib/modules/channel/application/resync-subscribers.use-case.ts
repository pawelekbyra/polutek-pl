import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok as success, fail as failure } from "@/lib/modules/shared/result";
import { AppError } from "@/lib/modules/shared/app-error";
import { ChannelRepository } from "../infrastructure/channel.repository";
import { recordAuditEventSafe } from "@/lib/modules/audit/application/record-audit-event-safe";

export interface ResyncSubscribersResult {
  updated: { creatorId: string; subscribersCount: number }[];
}

export async function resyncSubscribers(
  ctx: AppContext
): Promise<UseCaseResult<ResyncSubscribersResult, AppError>> {
  if (ctx.actor.type !== 'admin') {
    return failure(new AppError("Only admins can resync subscribers", 403, "FORBIDDEN"));
  }

  const repository = new ChannelRepository(ctx.prisma);
  const creators = await repository.findAllCreators();

  const results = await Promise.all(
    creators.map(async (creator) => {
      const updatedCreator = await repository.syncSubscribersCount(creator.id);
      return {
        creatorId: creator.id,
        subscribersCount: updatedCreator.subscribersCount,
      };
    })
  );

  await recordAuditEventSafe(ctx, {
    action: "SUBSCRIBERS_RESYNCED",
    targetType: "Creator",
    metadata: { creatorCount: results.length, subscribersCounts: results.map((r) => r.subscribersCount) },
  });

  return success({ updated: results });
}
