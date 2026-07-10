import { prisma } from "@/lib/prisma";
import { AdminNotificationListItemDTO } from "../domain/notification.dto";

export async function listAdminNotifications(limit = 50): Promise<AdminNotificationListItemDTO[]> {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { email: true } } },
  });

  return notifications.map((n) => ({
    id: n.id,
    kind: n.kind,
    titlePl: n.titlePl,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
    userEmail: n.user?.email ?? null,
  }));
}
