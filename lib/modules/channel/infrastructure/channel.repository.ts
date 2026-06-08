import { DbClient } from "@/lib/modules/shared/db";
import { flags } from "@/lib/feature-flags";
import { PrismaClient } from "@prisma/client";

export class ChannelRepository {
  constructor(private db: DbClient) {}

  async findMainChannel() {
    const slug = flags.mainCreatorSlug;
    if (!slug) return null;

    return await (this.db as PrismaClient).creator.findUnique({
      where: { slug },
    });
  }

  async findById(id: string) {
    return await (this.db as PrismaClient).creator.findUnique({
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
