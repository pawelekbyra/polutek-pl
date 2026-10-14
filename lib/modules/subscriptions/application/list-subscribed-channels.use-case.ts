import type { AppContext } from "@/lib/modules/shared/app-context";

export type SubscribedChannel = { id: string; slug: string; handle: string | null; name: string };

/**
 * The publicly visible channels the signed-in user follows, newest subscription first (side menu).
 * Own data only: the caller passes the signed-in user's id, nothing else is readable through this.
 */
export async function listSubscribedChannels(ctx: AppContext, userId: string, limit = 50): Promise<SubscribedChannel[]> {
  const rows = await ctx.prisma.subscription.findMany({
    where: {
      userId,
      creator: { deletedAt: null, status: { in: ["ACTIVE", "LIMITED"] } },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
    select: { creator: { select: { id: true, slug: true, handle: true, name: true } } },
  });
  return rows.map((r) => r.creator);
}
