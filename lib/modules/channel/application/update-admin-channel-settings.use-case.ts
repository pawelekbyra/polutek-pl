import { AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService } from "./main-channel.service";
import { PrismaClient } from "@prisma/client";
import { recordAuditEvent } from "@/lib/modules/audit";

export interface UpdateAdminChannelSettingsInput {
  name: string;
  bio?: string | null;
  bannerUrl?: string | null;
  displaySubscribersCount?: number | null;
}

export async function updateAdminChannelSettings(
  ctx: AppContext,
  input: UpdateAdminChannelSettingsInput
) {
  if (ctx.actor.type !== 'admin') {
    throw new Error("Only admins can update channel settings");
  }

  const db = ctx.prisma as PrismaClient;
  const mainChannel = await MainChannelService.getRequired(ctx);

  const updated = await db.creator.update({
    where: { id: mainChannel.id },
    data: input,
    include: {
      user: { select: { id: true, email: true, name: true, imageUrl: true } },
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
