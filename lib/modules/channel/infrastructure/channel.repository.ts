import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { flags } from "@/lib/feature-flags";
import { PrismaClient } from "@prisma/client";

export class ChannelRepository {
  constructor(private db: ReadDb) {}

  private get creator() {
      // Internal cast for Prisma API access
      return (this.db as PrismaClient).creator;
  }

  async findMainChannel() {
    const slug = flags.mainCreatorSlug;
    if (!slug) return null;

    return await this.creator.findUnique({
      where: { slug },
    });
  }

  async findById(id: string) {
    return await this.creator.findUnique({
      where: { id },
    });
  }

  async findAllCreators() {
    return await this.creator.findMany({
      select: { id: true },
    });
  }

  async syncSubscribersCount(id: string, tx?: WriteTx) {
    const db = tx || (this.db as PrismaClient);
    const realCount = await db.subscription.count({
      where: { creatorId: id },
    });

    return await db.creator.update({
      where: { id },
      data: { subscribersCount: realCount },
    });
  }

  async updateSubscribersCount(id: string, increment: number, tx?: WriteTx) {
    const db = tx || (this.db as
any);

    if (increment < 0) {
      return await db.creator.updateMany({
        where: { id, subscribersCount: { gt: 0 } },
        data: { subscribersCount: { increment } }
      });
    }

    return await db.creator.update({
      where: { id },
      data: { subscribersCount: { increment } }
    });
  }
}
