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

  /**
   * Idempotent subscribe. `INSERT ... ON CONFLICT DO NOTHING` (createMany + skipDuplicates) never aborts the
   * surrounding PostgreSQL transaction, unlike a caught P2002 where the following SELECT would fail with
   * "current transaction is aborted".
   */
  async createIfMissing(userId: string, creatorId: string, tx?: WriteTx) {
    const db = tx || (this.db as PrismaClient);
    const inserted = await db.subscription.createMany({
      data: [{ userId, creatorId }],
      skipDuplicates: true,
    });
    const subscription = await db.subscription.findUnique({
      where: { userId_creatorId: { userId, creatorId } },
      select: { id: true, createdAt: true, notify: true },
    });
    if (!subscription) throw new Error("Subscription row missing right after insert");
    return { subscription, created: inserted.count > 0 };
  }

  /**
   * Serialises the subscribe/unsubscribe transactions of one user (transaction-scoped advisory lock), so the
   * "last subscription gone" check that withdraws the global e-mail consent cannot be fooled by a concurrent
   * unsubscribe from another channel. Take it before any channel row lock to keep the lock order fixed.
   */
  async lockUser(userId: string, tx: WriteTx) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"subscriptions:user:" + userId}))`;
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
