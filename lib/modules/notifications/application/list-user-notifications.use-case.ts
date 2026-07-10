import { prisma } from "@/lib/prisma";
import { NotificationDTO, toPublicKind } from "../domain/notification.dto";

export async function listUserNotifications(userId: string, limit = 10): Promise<NotificationDTO[]> {
  const boundedLimit = Math.min(Math.max(1, limit), 100);

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: boundedLimit,
  });

  return notifications.map((n) => ({
    id: n.id,
    kind: toPublicKind(n.kind),
    titlePl: n.titlePl,
    titleEn: n.titleEn,
    bodyPl: n.bodyPl,
    bodyEn: n.bodyEn,
    createdAt: n.createdAt.toISOString(),
    read: n.read,
    href: n.href,
  }));
}
