import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentPolicy } from "../domain/payment.policy";
import { PaymentError } from "../domain/payment.errors";
import { SupportedCurrency } from "@/lib/constants";
import { recordAuditEvent } from "@/lib/modules/audit";
import { CurrencyLimit, getPaymentCurrencyLimits } from "@/lib/payments/currency-settings";

export interface UpdatePaymentSettingsInput {
  /** The minimum tip per currency, in major units. */
  limits: Array<{ currency: SupportedCurrency; minAmount: number }>;
}

export async function updatePaymentSettings(
  input: UpdatePaymentSettingsInput,
  ctx: AppContext
): Promise<UseCaseResult<Record<SupportedCurrency, CurrencyLimit>, PaymentError>> {
  if (!PaymentPolicy.canManagePaymentSettings(ctx.actor)) {
    return fail(new PaymentError("Forbidden: Cannot manage payment settings"));
  }

  const repo = new PaymentRepository();
  // Audit "before": the effective minimums the owner saw when he edited (legacy columns included).
  const before = await getPaymentCurrencyLimits();

  await ctx.db.writeTransaction(async (tx) => {
    for (const limit of input.limits) {
      await repo.upsertCurrencyMinimum(limit.currency, Math.round(limit.minAmount * 100), tx);
    }

    await recordAuditEvent(ctx, {
      action: 'PAYMENT_SETTINGS_UPDATED',
      targetType: 'PaymentCurrencySetting',
      targetId: 'global',
      metadata: {
        minimums: input.limits.map((l) => ({ currency: l.currency, minAmount: l.minAmount })),
        before: input.limits.map((l) => ({ currency: l.currency, minAmount: before[l.currency]?.minAmount ?? null })),
      },
    }, tx);
  });

  return ok(await getPaymentCurrencyLimits());
}
