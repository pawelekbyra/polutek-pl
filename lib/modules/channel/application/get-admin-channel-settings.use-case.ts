import { AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService } from "./main-channel.service";
import { PrismaClient } from "@prisma/client";

export async function getAdminChannelSettings(ctx: AppContext) {
  if (ctx.actor.type !== 'admin') {
    throw new Error("Only admins can access channel settings");
  }

  const db = ctx.prisma as PrismaClient;
  const mainChannel = await MainChannelService.getRequired(ctx);

  return await db.creator.findUnique({
    where: { id: mainChannel.id },
    select: {
      id: true,
      slug: true,
      name: true,
      bio: true,
      bannerUrl: true,
      subscribersCount: true,
      displaySubscribersCount: true,
      user: { select: { id: true, email: true, name: true, imageUrl: true } },
    },
  });
}
