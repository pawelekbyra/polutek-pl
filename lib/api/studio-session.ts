import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { createAppContext, type AppContext } from "@/lib/modules/shared/app-context";
import type { Actor } from "@/lib/modules/shared/actor";
import { listMyChannels, type ChannelSummaryDto } from "@/lib/modules/channel";

/**
 * Who is using the Studio and which channel they work on (CLAUDE.md 4.23, 4.24).
 *
 * The Studio always acts as a plain `user`, even when the account also has the legacy ADMIN role: platform
 * administration lives in the panel, and an administrator who owns a channel manages it like any other creator.
 * The channel comes from the user's own memberships; a requested channel id is honoured only if it is one of them,
 * and every use case still authorizes (a mistake here can never grant access).
 */
export interface StudioSession {
  ctx: AppContext;
  userId: string;
  channel: ChannelSummaryDto | null;
  channels: ChannelSummaryDto[];
}

export async function resolveStudioSession(options: { requestId?: string; channelId?: string | null } = {}): Promise<StudioSession | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isDeleted: true, onboardingPending: true },
  });
  if (!user || user.isDeleted) return null;

  const actor: Actor = user.onboardingPending ? { type: "user", userId, onboardingPending: true } : { type: "user", userId };
  const base = createAppContext({ actor, requestId: options.requestId });
  const channels = await listMyChannels(base);
  const channel = (options.channelId ? channels.find((c) => c.id === options.channelId) : undefined) ?? channels[0] ?? null;
  const ctx = createAppContext({ actor, requestId: options.requestId, channelId: channel?.id });
  return { ctx, userId, channel, channels };
}
