import { AppContext } from "@/lib/modules/shared/app-context";
import { AuditRepository } from "../infrastructure/audit.repository";

export interface RecordAuditEventInput {
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: any;
}

export async function recordAuditEvent(
  ctx: AppContext,
  input: RecordAuditEventInput
) {
  const repository = new AuditRepository(ctx.prisma);

  return await repository.create({
    userId: ctx.userId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    metadata: input.metadata,
  });
}
