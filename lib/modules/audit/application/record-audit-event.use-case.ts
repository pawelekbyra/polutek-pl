import { AppContext } from "@/lib/modules/shared/app-context";
import { AuditRepository } from "../infrastructure/audit.repository";

export interface RecordAuditEventInput {
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: any;
}

export async function recordAuditEvent(
  ctx: AppContext,
  input: RecordAuditEventInput
) {
  const repository = new AuditRepository(ctx.prisma);

  const actorUserId = ctx.actor.type !== 'guest' && 'userId' in ctx.actor ? ctx.actor.userId : undefined;

  return await repository.create({
    actorUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata,
  });
}
