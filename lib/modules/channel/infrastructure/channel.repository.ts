import { ReadDb } from "@/lib/modules/shared/db";
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

  async updateSubscribersCount(id: string, increment: number) {
     return await (this.db as any).creator.update({
         where: { id },
         data: { subscribersCount: { increment } }
     });
  }
}
