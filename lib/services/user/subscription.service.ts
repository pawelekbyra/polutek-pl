import { prisma } from '@/lib/prisma';

export class UserSubscriptionService {
  static async getSubscriptionStatus(userId: string, creatorId: string) {
    const sub = await prisma.subscription.findUnique({
      where: { userId_creatorId: { userId, creatorId } },
      select: { id: true }
    });
    return !!sub;
  }

  static async toggleSubscription(userId: string, creatorId: string) {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.subscription.findUnique({
        where: { userId_creatorId: { userId, creatorId } },
        select: { id: true }
      });

      if (existing) {
        await tx.subscription.delete({ where: { id: existing.id } });
        await tx.creator.update({
          where: { id: creatorId },
          data: { subscribersCount: { decrement: 1 } }
        });
        return { subscribed: false };
      } else {
        await tx.subscription.create({
          data: { userId, creatorId }
        });
        await tx.creator.update({
          where: { id: creatorId },
          data: { subscribersCount: { increment: 1 } }
        });
        return { subscribed: true };
      }
    });
  }
}
