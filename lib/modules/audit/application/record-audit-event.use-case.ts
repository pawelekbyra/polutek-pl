import { AppContext } from "@/lib/modules/shared/app-context";
import { AuditRepository, CreateAuditLogInput } from "../infrastructure/audit.repository";

export type RecordAuditEventInput = Omit<CreateAuditLogInput, 'actorUserId'>;

import { WriteTx } from "@/lib/modules/shared/db";

export async function recordAuditEvent(
  ctx: AppContext,
  input: RecordAuditEventInput,
  tx?: WriteTx
) {
  const repository = new AuditRepository(tx || ctx.prisma);

  const actorUserId = ctx.actor.type !== 'guest' && 'userId' in ctx.actor ? ctx.actor.userId : null;

  return await repository.create({
    ...input,
    actorUserId,
  });
}
