import { AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService } from "./main-channel.service";
import { PrismaClient } from "@prisma/client";
import { recordAuditEvent } from "@/lib/modules/audit";
import { AppError } from "@/lib/modules/shared/app-error";
import { invalidateDefaultThumbnailCache } from "@/lib/modules/media";
import { ADMIN_CHANNEL_CREATOR_SELECT } from "./get-admin-channel-settings.use-case";

export interface UpdateAdminChannelSettingsInput {
  name: string;
  bio?: string | null;
  defaultThumbnailUrl?: string | null;
  displaySubscribersCount?: number | null;
}

export async function updateAdminChannelSettings(
  ctx: AppContext,
  input: UpdateAdminChannelSettingsInput
) {
  if (ctx.actor.type !== 'admin') {
    throw new AppError("Only admins can update channel settings", 403, "FORBIDDEN");
  }

  const db = ctx.prisma as PrismaClient;
  const mainChannel = await MainChannelService.getRequired(ctx);

  // Only the editable columns are written, never whatever else a caller passes in.
  const data = {
    name: input.name,
    bio: input.bio,
    defaultThumbnailUrl: input.defaultThumbnailUrl,
    displaySubscribersCount: input.displaySubscribersCount,
  };
  const fields = (Object.keys(data) as Array<keyof typeof data>).filter((key) => data[key] !== undefined);

  const updated = await db.creator.update({
    where: { id: mainChannel.id },
    data,
    select: ADMIN_CHANNEL_CREATOR_SELECT,
  });

  await recordAuditEvent(ctx, {
    action: 'CHANNEL_UPDATED',
    targetType: 'CREATOR',
    targetId: updated.id,
    metadata: { slug: updated.slug, fields }
  });

  if (input.defaultThumbnailUrl !== undefined) invalidateDefaultThumbnailCache();

  return updated;
}
