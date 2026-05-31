import { prisma } from '@/lib/prisma';

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
  metadata?: unknown;
}) {
  try {
    return await prisma.auditLog.create({
      data: {
        actorUserId,
        action,
        targetType,
        targetId,
        metadata: metadata as any,
      },
    });
  } catch (error) {
    console.error("[AUDIT_LOG_ERROR]", error);
  }
}
