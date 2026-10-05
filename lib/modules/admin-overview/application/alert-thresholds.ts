import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { recordAuditEvent } from "@/lib/modules/audit";
import { ALERT_THRESHOLDS_SETTING_KEY, parseStoredThresholds, validateThresholds, type LimitThresholds } from "../domain/alert-thresholds";

export type StoredThresholds = { limits: LimitThresholds; updatedAt: string | null; custom: boolean };

export async function getAlertThresholds(ctx: Pick<AppContext, "prisma">): Promise<StoredThresholds> {
  const row = await ctx.prisma.appSetting.findUnique({ where: { key: ALERT_THRESHOLDS_SETTING_KEY } });
  return { limits: parseStoredThresholds(row?.value), updatedAt: row?.updatedAt.toISOString() ?? null, custom: !!row };
}

export class ThresholdValidationError extends AppError {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super("Popraw zaznaczone progi.", 400, "THRESHOLDS_INVALID");
  }
}

export async function saveAlertThresholds(ctx: AppContext, input: LimitThresholds): Promise<UseCaseResult<LimitThresholds, AppError>> {
  if (ctx.actor.type !== "admin") return fail(new AppError("Tylko administrator zmienia progi alertów.", 403, "FORBIDDEN"));
  const errors = validateThresholds(input);
  if (Object.keys(errors).length) return fail(new ThresholdValidationError(errors));
  const before = await getAlertThresholds(ctx);
  const value = JSON.stringify({ disk: input.disk, memoryUsed: input.memoryUsed, swap: input.swap });
  const updatedBy = ctx.actor.userId;
  await ctx.db.writeTransaction(async (tx) => {
    await tx.appSetting.upsert({
      where: { key: ALERT_THRESHOLDS_SETTING_KEY },
      create: { key: ALERT_THRESHOLDS_SETTING_KEY, value, updatedBy },
      update: { value, updatedBy },
    });
    await recordAuditEvent(ctx, { action: "ALERT_THRESHOLDS_UPDATED", targetType: "AppSetting", targetId: ALERT_THRESHOLDS_SETTING_KEY, metadata: { before: before.limits, after: input } }, tx);
  });
  return ok(input);
}

/** Restores the built-in thresholds (deletes the row). */
export async function resetAlertThresholds(ctx: AppContext): Promise<UseCaseResult<{ reset: boolean }, AppError>> {
  if (ctx.actor.type !== "admin") return fail(new AppError("Tylko administrator zmienia progi alertów.", 403, "FORBIDDEN"));
  const before = await getAlertThresholds(ctx);
  if (!before.custom) return ok({ reset: false });
  await ctx.db.writeTransaction(async (tx) => {
    await tx.appSetting.delete({ where: { key: ALERT_THRESHOLDS_SETTING_KEY } });
    await recordAuditEvent(ctx, { action: "ALERT_THRESHOLDS_RESET", targetType: "AppSetting", targetId: ALERT_THRESHOLDS_SETTING_KEY, metadata: { before: before.limits } }, tx);
  });
  return ok({ reset: true });
}
