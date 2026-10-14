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
        notify: true,
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
        select: { id: true, createdAt: true, notify: true },
      });
      return { subscription, created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const subscription = await db.subscription.findUnique({
          where: { userId_creatorId: { userId, creatorId } },
          select: { id: true, createdAt: true, notify: true },
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

  async countByUserId(userId: string, tx?: WriteTx) {
    const db = tx || (this.db as PrismaClient);
    return await db.subscription.count({ where: { userId } });
  }

  /** The bell of one subscription; `count` is 0 when the viewer does not subscribe to the channel. */
  async setNotify(userId: string, creatorId: string, notify: boolean, tx?: WriteTx) {
    const db = tx || (this.db as PrismaClient);
    return await db.subscription.updateMany({ where: { userId, creatorId }, data: { notify } });
  }

  /** Every subscription of a user with the channel facts the "My subscriptions" page shows, newest first. */
  async listForUser(userId: string) {
    return await this.subscription.findMany({
      where: { userId, creator: { deletedAt: null } },
      orderBy: { createdAt: "desc" },
      select: {
        creatorId: true,
        notify: true,
        createdAt: true,
        creator: {
          select: {
            id: true,
            slug: true,
            handle: true,
            name: true,
            status: true,
            deletedAt: true,
            subscribersCount: true,
            user: { select: { imageUrl: true } },
          },
        },
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
