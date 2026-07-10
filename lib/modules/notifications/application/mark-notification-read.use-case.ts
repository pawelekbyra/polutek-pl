import { prisma } from "@/lib/prisma";
import { NotificationDTO, toPublicKind } from "../domain/notification.dto";

export async function markNotificationRead(
  userId: string,
  notificationId: string,
  read: boolean,
): Promise<NotificationDTO | null> {
  const existing = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!existing || existing.userId !== userId) return null;

  const notification = await prisma.notification.update({
    where: { id: notificationId },
    data: { read },
  });

  return {
    id: notification.id,
    kind: toPublicKind(notification.kind),
    titlePl: notification.titlePl,
    titleEn: notification.titleEn,
    bodyPl: notification.bodyPl,
    bodyEn: notification.bodyEn,
    createdAt: notification.createdAt.toISOString(),
    read: notification.read,
    href: notification.href,
  };
}
