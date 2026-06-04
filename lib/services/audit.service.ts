import { logger } from "@/lib/logger";
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function writeAuditLog({
  actorUserId,
  action,
  targetType,
  targetId,
  metadata,
}: {
  actorUserId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    return await prisma.auditLog.create({
      data: {
        actorUserId,
        action,
        targetType,
        targetId,
        metadata,
      },
    });
  } catch (error) {
    logger.error("[AUDIT_LOG_ERROR]", error);
  }
}
