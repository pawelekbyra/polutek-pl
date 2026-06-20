import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { Prisma, PrismaClient } from "@prisma/client";

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

  async createIfMissing(userId: string, creatorId: string, tx?: WriteTx) {
    const db = tx || (this.db as PrismaClient);
    try {
      const subscription = await db.subscription.create({
        data: { userId, creatorId },
        select: { id: true, createdAt: true },
      });
      return { subscription, created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const subscription = await db.subscription.findUnique({
          where: { userId_creatorId: { userId, creatorId } },
          select: { id: true, createdAt: true },
        });
        if (subscription) return { subscription, created: false };
      }
      throw error;
    }
  }

  async countByCreatorId(creatorId: string, tx?: WriteTx) {
    const db = tx || (this.db as PrismaClient);
    return await db.subscription.count({ where: { creatorId } });
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
