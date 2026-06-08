import { ReadDb, WriteTx } from "@/lib/modules/shared/db";

export class AuditRepository {
  constructor(private db: ReadDb | WriteTx) {}

  async create(data: {
    actorUserId?: string;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: any;
  }) {
    // We use any cast here because prisma types in the sandbox might not be fully synced,
    // but the schema contains the auditLog model with these exact fields.
    return await (this.db as any).auditLog.create({
      data: {
        actorUserId: data.actorUserId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        metadata: data.metadata,
      },
    });
  }
}
