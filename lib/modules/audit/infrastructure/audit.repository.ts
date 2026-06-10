import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import { Prisma } from "@prisma/client";

export interface CreateAuditLogInput {
  actorUserId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
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
}
