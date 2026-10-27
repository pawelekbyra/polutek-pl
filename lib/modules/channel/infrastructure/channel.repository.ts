import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { MAIN_CHANNEL_SETTING_KEY } from "../domain/main-channel-setting";
import { PrismaClient } from "@prisma/client";

export class ChannelRepository {
  constructor(private db: ReadDb) {}

  private get creator() {
      // Internal cast for Prisma API access
      return (this.db as PrismaClient).creator;
  }

  /**
   * The platform's main channel: only the `main_channel_id` setting (CLAUDE.md 4.24). There is no fallback to a
   * slug variable or a flag on the row: a missing or dangling setting means "no main channel" (null).
   */
  async findMainChannel() {
    const setting = await (this.db as PrismaClient).appSetting.findUnique({ where: { key: MAIN_CHANNEL_SETTING_KEY } });
    const configuredId = setting?.value?.trim();
    if (!configuredId) return null;
    return await this.creator.findUnique({ where: { id: configuredId } });
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
    // Row lock first: concurrent subscribe/unsubscribe transactions of one channel recount one after the other,
    // so each COUNT sees the rows the previous transaction committed (READ COMMITTED) and nobody writes a stale
    // number. The lock is held until the surrounding transaction ends.
    await db.$queryRaw`SELECT "id" FROM "Creator" WHERE "id" = ${id} FOR UPDATE`;
    const realCount = await db.subscription.count({
      where: { creatorId: id },
    });

    return await db.creator.update({
      where: { id },
      data: { subscribersCount: realCount },
    });
  }

  async updateSubscribersCount(id: string, increment: number, tx?: WriteTx) {
    const db = tx || (this.db as any);

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
