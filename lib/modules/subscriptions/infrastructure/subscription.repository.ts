import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { PrismaClient } from "@prisma/client";

export class SubscriptionRepository {
  constructor(private db: ReadDb) {}

  private get subscription() {
    return (this.db as PrismaClient).subscription;
  }

  async findByUserIdAndCreatorId(userId: string, creatorId: string) {
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

  async create(userId: string, creatorId: string, tx?: WriteTx) {
    const db = tx || (this.db as PrismaClient);
    return await db.subscription.create({
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

  async deleteByUserIdAndCreatorId(userId: string, creatorId: string, tx?: WriteTx) {
    const db = tx || (this.db as PrismaClient);
    return await db.subscription.deleteMany({
      where: {
        userId,
        creatorId,
      },
    });
  }

  async findManyByUserId(userId: string) {
    return await this.subscription.findMany({
      where: { userId },
      include: { creator: true }
    });
  }
}
