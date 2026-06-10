import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok } from "@/lib/modules/shared/result";
import { AuditRepository } from "../infrastructure/audit.repository";

export type GetAuditLogsInput = {
  targetType: string;
  targetId: string;
  limit?: number;
};

export async function getAuditLogs(
  input: GetAuditLogsInput,
  ctx: AppContext
): Promise<UseCaseResult<any[]>> {
  const repository = new AuditRepository(ctx.db.read);

  const logs = await repository.findManyByTarget(
    input.targetType,
    input.targetId,
    input.limit
  );

  return ok(logs);
}
