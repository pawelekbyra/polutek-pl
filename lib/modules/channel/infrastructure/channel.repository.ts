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
   * The platform's main channel: the `main_channel_id` setting (CLAUDE.md 4.24). Two emergency fallbacks keep the
   * site up on a database where the stage 8 backfill has not run yet (deployment A); both go away in deployment B.
   */
  async findMainChannel() {
    const setting = await (this.db as PrismaClient).appSetting.findUnique({ where: { key: MAIN_CHANNEL_SETTING_KEY } });
    const configuredId = setting?.value?.trim();
    if (configuredId) {
      const configured = await this.creator.findUnique({ where: { id: configuredId } });
      if (configured) return configured;
    }

    // Fallback 1: the old MAIN_CREATOR_SLUG variable. usunąć we wdrożeniu B (docs/architecture/stage-8-deploy-B.md).
    const legacySlug = process.env.MAIN_CREATOR_SLUG?.trim();
    if (legacySlug) {
      const bySlug = await this.creator.findUnique({ where: { slug: legacySlug } });
      if (bySlug) return bySlug;
    }

    // Fallback 2: the old isPrimary flag (read only, never written). usunąć we wdrożeniu B (docs/architecture/stage-8-deploy-B.md).
    return await this.creator.findFirst({ where: { isPrimary: true, deletedAt: null }, orderBy: { createdAt: "asc" } });
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
