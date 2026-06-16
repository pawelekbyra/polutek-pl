import { AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService } from "./main-channel.service";
import { PrismaClient } from "@prisma/client";
import { recordAuditEvent } from "@/lib/modules/audit";
import { AppError } from "@/lib/modules/shared/app-error";
import { AdminChannelSettingsDTO } from "../domain/channel.dto";

export interface UpdateAdminChannelSettingsInput {
  name: string;
  bio?: string | null;
  bannerUrl?: string | null;
  displaySubscribersCount?: number | null;
}

export async function updateAdminChannelSettings(
  ctx: AppContext,
  input: UpdateAdminChannelSettingsInput,
): Promise<AdminChannelSettingsDTO> {
  if (ctx.actor.type !== "admin") {
    throw new AppError(
      "Only admins can update channel settings",
      403,
      "FORBIDDEN",
    );
  }

  const db = ctx.prisma as PrismaClient;
  const mainChannel = await MainChannelService.getRequired(ctx);

  const updated = await db.creator.update({
    where: { id: mainChannel.id },
    data: input,
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

  await recordAuditEvent(ctx, {
    action: 'CHANNEL_UPDATED',
    targetType: 'CREATOR',
    targetId: updated.id,
    metadata: { slug: updated.slug, fields: Object.keys(input) }
  });

  return updated;
}
