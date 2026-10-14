import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { Prisma } from "@prisma/client";

export interface CreateAuditLogInput {
  actorUserId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
  /** guest | user | admin | system, taken from the AppContext actor. */
  actorType?: string | null;
  /** The reason carried by a system actor (e.g. "stripe_webhook"). */
  systemReason?: string | null;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  /** Channel the event concerns; lets the panel filter per channel. Absent = platform-wide. */
  channelId?: string | null;
}

export class AuditRepository {
  constructor(private db: ReadDb | WriteTx) {}

  async create(data: CreateAuditLogInput) {
    // Use type casting to any because of Prisma's complex union types for TransactionClient
    // but keep the interface clean and typed for the caller.
    return await (this.db as any).auditLog.create({
      data: {
        actorUserId: data.actorUserId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        metadata: data.metadata ?? Prisma.JsonNull,
        actorType: data.actorType ?? null,
        systemReason: data.systemReason ?? null,
        requestId: data.requestId ?? null,
        ip: data.ip ?? null,
        userAgent: data.userAgent ?? null,
        ...(data.channelId ? { channelId: data.channelId } : {}),
      },
    });
  }

  async findManyByTarget(targetType: string, targetId: string, limit: number = 50) {
    return await (this.db as any).auditLog.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findUserAuditLogs(userId: string, limit: number = 100) {
    return await (this.db as any).auditLog.findMany({
      where: {
        OR: [
          { targetType: 'User', targetId: userId },
          { actorUserId: userId }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
