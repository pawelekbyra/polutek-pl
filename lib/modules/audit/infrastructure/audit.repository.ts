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
