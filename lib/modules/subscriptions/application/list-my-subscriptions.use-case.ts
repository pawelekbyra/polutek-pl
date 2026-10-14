import { VideoStatus } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { MainChannelPolicy, resolveChannelAvatarUrl } from "@/lib/modules/channel";
import { SubscriptionRepository } from "../infrastructure/subscription.repository";

export interface MySubscriptionDto {
  creatorId: string;
  slug: string;
  handle: string | null;
  name: string;
  imageUrl: string | null;
  subscribersCount: number;
  /** The bell of this subscription. */
  notify: boolean;
  subscribedAt: Date;
  /** Public, published videos of the channel. */
  videosCount: number;
  lastVideoAt: Date | null;
  /** False for a suspended or banned channel: it is listed so it can be left, but not opened. */
  available: boolean;
}

/**
 * The viewer's own subscriptions with the facts the "My subscriptions" page shows. Reads only the
 * signed-in user's rows; channel data is the public subset (name, handle, avatar, counters).
 */
export class ListMySubscriptionsUseCase {
  static async execute(ctx: AppContext): Promise<MySubscriptionDto[]> {
    const userId = (ctx.actor.type === 'user' || ctx.actor.type === 'admin') ? ctx.actor.userId : null;
    if (!userId) {
      throw new AppError("Sign in to see your subscriptions.", 401, "UNAUTHORIZED");
    }

    const repo = new SubscriptionRepository(ctx.db.read);
    const rows = await repo.listForUser(userId);
    if (rows.length === 0) return [];

    const now = ctx.now();
    const stats = await ctx.prisma.video.groupBy({
      by: ['creatorId'],
      where: {
        creatorId: { in: rows.map((r) => r.creatorId) },
        status: VideoStatus.PUBLISHED,
        moderationStatus: { not: 'REMOVED' },
        OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
      },
      _count: { _all: true },
      _max: { publishedAt: true },
    });
    const statsByChannel = new Map(stats.map((s) => [s.creatorId, s]));

    return rows.map((row) => {
      const channel = row.creator;
      const stat = statsByChannel.get(row.creatorId);
      return {
        creatorId: channel.id,
        slug: channel.slug,
        handle: channel.handle ?? null,
        name: channel.name,
        imageUrl: resolveChannelAvatarUrl({ ownerImageUrl: channel.user?.imageUrl }),
        subscribersCount: channel.subscribersCount ?? 0,
        notify: row.notify,
        subscribedAt: row.createdAt,
        videosCount: stat?._count._all ?? 0,
        lastVideoAt: stat?._max.publishedAt ?? null,
        available: MainChannelPolicy.isPubliclyVisible(channel),
      };
    });
  }
}
