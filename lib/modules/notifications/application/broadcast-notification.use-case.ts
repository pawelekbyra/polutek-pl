import { prisma } from "@/lib/prisma";

export type BroadcastAudience = "ALL" | "PATRONS";

export interface BroadcastNotificationInput {
  titlePl: string;
  titleEn: string;
  bodyPl: string;
  bodyEn: string;
  audience: BroadcastAudience;
  href?: string;
}

export async function broadcastNotification(input: BroadcastNotificationInput): Promise<{ recipientCount: number }> {
  const { titlePl, titleEn, bodyPl, bodyEn, audience, href } = input;

  const where = {
    isDeleted: false,
    ...(audience === "PATRONS" ? { patronGrants: { some: { revokedAt: null } } } : {}),
  };

  const recipients = await prisma.user.findMany({
    where,
    select: {
      id: true,
      notificationPreference: { select: { systemEnabled: true } },
    },
  });

  const targetUserIds = recipients
    .filter((u) => u.notificationPreference?.systemEnabled !== false)
    .map((u) => u.id);

  if (targetUserIds.length === 0) return { recipientCount: 0 };

  await prisma.notification.createMany({
    data: targetUserIds.map((userId) => ({
      userId,
      kind: "SYSTEM" as const,
      titlePl,
      titleEn,
      bodyPl,
      bodyEn,
      href: href || null,
    })),
  });

  return { recipientCount: targetUserIds.length };
}
