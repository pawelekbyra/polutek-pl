import { AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService } from "./main-channel.service";
import { PrismaClient } from "@prisma/client";
import { AppError } from "@/lib/modules/shared/app-error";
import { AdminChannelSettingsDTO } from "../domain/channel.dto";
import { MainChannelNotFoundError } from "../domain/channel.errors";

export async function getAdminChannelSettings(
  ctx: AppContext,
): Promise<AdminChannelSettingsDTO> {
  if (ctx.actor.type !== "admin") {
    throw new AppError(
      "Only admins can access channel settings",
      403,
      "FORBIDDEN",
    );
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
      user: { select: { name: true, imageUrl: true } },
    },
  });

  if (!creator) {
    throw new MainChannelNotFoundError(mainChannel.slug);
  }

  return creator as AdminChannelSettingsDTO;
}
