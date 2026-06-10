import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { PrismaClient } from "@prisma/client";

export class SubscriptionRepository {
  constructor(private db: ReadDb) {}

  private get subscription() {
    return (this.db as PrismaClient).subscription;
  }

  async findSubscription(userId: string, creatorId: string) {
    return await this.subscription.findUnique({
      where: {
        userId_creatorId: {
          userId,
          creatorId,
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
    });
  }

  async createSubscription(tx: WriteTx, userId: string, creatorId: string) {
    return await tx.subscription.create({
      data: {
        userId,
        creatorId,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });
  }

  async deleteSubscription(tx: WriteTx, userId: string, creatorId: string) {
    return await tx.subscription.deleteMany({
      where: {
        userId,
        creatorId,
      },
    });
  }
}
