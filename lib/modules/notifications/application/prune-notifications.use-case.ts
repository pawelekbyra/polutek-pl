import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

/** Read notifications are history nobody opens after a quarter; unread ones get a year before they are let go. */
export const READ_NOTIFICATION_RETENTION_DAYS = 90;
export const UNREAD_NOTIFICATION_RETENTION_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Daily housekeeping: the notification table must not grow without bound (the bell only ever shows the latest). */
export async function pruneOldNotifications(options: { now?: Date; db?: Pick<PrismaClient, "notification"> } = {}) {
  const now = options.now ?? new Date();
  const db = options.db ?? defaultPrisma;
  const read = await db.notification.deleteMany({
    where: { read: true, createdAt: { lt: new Date(now.getTime() - READ_NOTIFICATION_RETENTION_DAYS * DAY_MS) } },
  });
  const unread = await db.notification.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - UNREAD_NOTIFICATION_RETENTION_DAYS * DAY_MS) } },
  });
  return { readDeleted: read.count, unreadDeleted: unread.count };
}
