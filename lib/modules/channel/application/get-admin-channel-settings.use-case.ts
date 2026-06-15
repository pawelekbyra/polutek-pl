import { AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService } from "./main-channel.service";
import { PrismaClient } from "@prisma/client";
import { AppError } from "@/lib/modules/shared/app-error";
import { AdminChannelDto } from "../domain/channel.dto";

export async function getAdminChannelSettings(ctx: AppContext): Promise<AdminChannelDto> {
  if (ctx.actor.type !== 'admin') {
    throw new AppError("Only admins can access channel settings", 403, "FORBIDDEN");
  }

  const db = ctx.prisma as PrismaClient;
  const mainChannel = await MainChannelService.getRequired(ctx);

  const creator = await db.creator.findUnique({
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

  if (!creator) {
    throw new AppError("Main channel record vanished during retrieval", 500, "INTERNAL_ERROR");
  }

  return creator;
}
