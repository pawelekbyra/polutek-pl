import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

/**
 * Deletes expired sign-in sessions (with their IP address and user agent) and expired one-time
 * e-mail tokens (verification, password reset, e-mail change; their identifier is an address).
 * Better Auth only drops such rows when it happens to read them, so without this job they would
 * stay for ever. An expired row is useless to Better Auth: it rejects it on read anyway.
 */
export async function pruneExpiredAuthRecords(options: { now?: Date; db?: Pick<PrismaClient, "session" | "verification"> } = {}) {
  const now = options.now ?? new Date();
  const db = options.db ?? defaultPrisma;
  const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  const verifications = await db.verification.deleteMany({ where: { expiresAt: { lt: now } } });
  return { sessionsDeleted: sessions.count, verificationsDeleted: verifications.count, expiredBefore: now.toISOString() };
}
