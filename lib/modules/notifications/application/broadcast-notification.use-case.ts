import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/modules/audit";
import { resolveAdminAuditContext } from "@/lib/modules/audit/application/resolve-admin-audit-context";

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

  const ctx = await resolveAdminAuditContext();

  await prisma.$transaction(async (tx) => {
    await tx.notification.createMany({
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

    // Counts and audience only: never the message text or recipient ids.
    await recordAuditEvent(ctx, {
      action: "NOTIFICATION_BROADCAST_SENT",
      targetType: "Notification",
      metadata: { audience, recipientCount: targetUserIds.length, hasHref: Boolean(href) },
    }, tx);
  });

  return { recipientCount: targetUserIds.length };
}
