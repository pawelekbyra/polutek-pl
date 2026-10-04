import { AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService } from "./main-channel.service";
import { PrismaClient } from "@prisma/client";
import { AppError } from "@/lib/modules/shared/app-error";

export type AdminChannelCreatorDto = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  defaultThumbnailUrl: string | null;
  subscribersCount: number;
  displaySubscribersCount: number | null;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    imageUrl: string | null;
  } | null;
};

/** The only Creator columns the admin channel settings read or return. */
export const ADMIN_CHANNEL_CREATOR_SELECT = {
  id: true,
  slug: true,
  name: true,
  bio: true,
  defaultThumbnailUrl: true,
  subscribersCount: true,
  displaySubscribersCount: true,
  user: { select: { id: true, email: true, name: true, imageUrl: true } },
} as const;

export type AdminChannelDiagnosticsDto = {
  mainChannelConfigured: boolean;
  mainChannelSlug: string | null;
  creatorLoaded: boolean;
  userLoaded: boolean;
};

export type AdminChannelSettingsDto = {
  creator: AdminChannelCreatorDto | null;
  diagnostics: AdminChannelDiagnosticsDto;
};

export async function getAdminChannelSettings(
  ctx: AppContext,
): Promise<AdminChannelSettingsDto> {
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
    select: ADMIN_CHANNEL_CREATOR_SELECT,
  });

  return {
    creator,
    diagnostics: {
      mainChannelConfigured: true,
      mainChannelSlug: mainChannel.slug,
      creatorLoaded: creator !== null,
      userLoaded: creator?.user !== null && creator?.user !== undefined,
    },
  };
}
